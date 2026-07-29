import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { CLOSE } from "@/lib/net/close-codes";
import { buildError } from "@/lib/net/errors";
import { log, logError } from "@/lib/net/log";
import {
  decodeEnvelope,
  parseClientPayload,
  PROTOCOL_VERSION,
  type ResumeInto,
} from "@/lib/net/protocol";
import { getUserLobby } from "@/lib/redis/lobby-store";
import { getUserMatch } from "@/lib/redis/match-store";
import * as metrics from "@/lib/redis/metrics-store";
import { readEntry } from "@/lib/redis/queue-store";
import {
  consumeTicket,
  issueResumeToken,
  readResumeToken,
} from "@/lib/redis/ticket-store";
import { announcePresence } from "@/server/ws/handlers/friends";
import { leaveCurrentLobby } from "@/server/ws/handlers/lobby";
import { onMatchDisconnect, resumeIntoMatch } from "@/server/ws/handlers/match";
import { dropFromQueue } from "@/server/ws/handlers/queue";
import { route } from "@/server/ws/router";
import { registry, type Conn } from "@/server/ws/registry";

/** 64 КБ на кадр: игровое сообщение на два порядка меньше. */
const MAX_FRAME_BYTES = 64 * 1024;

export interface AttachOptions {
  path: string;
  /** Пусто — проверка Origin отключена (dev). В проде список обязателен. */
  allowedOrigins: string[];
}

export function attachWebSocket(
  server: HttpServer,
  options: AttachOptions,
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_FRAME_BYTES,
  });

  server.on("upgrade", (req, socket, head) => {
    void handleUpgrade(wss, options, req, socket, head);
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, conn: Conn) => {
    bind(ws, conn);
  });

  registry.handleDisconnectWith(handleDisconnect);
  registry.startHeartbeat();

  return wss;
}

/* ------------------------------------------------------------------ *
 * Апгрейд
 * ------------------------------------------------------------------ */

async function handleUpgrade(
  wss: WebSocketServer,
  options: AttachOptions,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname !== options.path) {
    log({ evt: "ws.reject", reason: "path" });
    socket.destroy();
    return;
  }

  // WebSocket не защищён Same-Origin Policy: без этой проверки любой сайт
  // откроет сокет с кукой пользователя (ЧАСТЬ 5.4 ТЗ).
  if (!originAllowed(req, options.allowedOrigins)) {
    log({ evt: "ws.reject", reason: "origin" });
    socket.destroy();
    return;
  }

  const ticket = url.searchParams.get("t");
  if (!ticket) {
    log({ evt: "ws.reject", reason: "auth" });
    reject(socket, 401);
    return;
  }

  const identity = await consumeTicket(ticket);
  if (!identity) {
    log({ evt: "ws.reject", reason: "auth" });
    reject(socket, 401);
    return;
  }

  const resumeToken = await issueResumeToken(identity.userId);
  const origin = originOf(req);

  wss.handleUpgrade(req, socket, head, (ws) => {
    const conn = registry.create(ws, {
      userId: identity.userId,
      nickname: identity.nickname,
      rating: identity.rating,
      sessionExpMs: identity.expMs,
      resumeToken,
      origin,
    });
    wss.emit("connection", ws, req, conn);
  });
}

function originOf(req: IncomingMessage): string {
  const proto = header(req, "x-forwarded-proto") ?? "http";
  const host = header(req, "x-forwarded-host") ?? req.headers.host ?? "localhost";
  return `${proto}://${host}`;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(",")[0]?.trim();
}

function originAllowed(req: IncomingMessage, allowed: string[]): boolean {
  const origin = req.headers.origin;

  // Нативные клиенты Origin не шлют, браузеры шлют всегда.
  if (!origin) return true;
  if (!allowed.length) return true;
  if (allowed.includes(origin)) return true;

  // Тот же хост, что и у запроса, — всегда свой.
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function reject(socket: Duplex, status: number): void {
  socket.write(`HTTP/1.1 ${status} Unauthorized\r\n\r\n`);
  socket.destroy();
}

/* ------------------------------------------------------------------ *
 * Жизненный цикл соединения
 * ------------------------------------------------------------------ */

function bind(ws: WebSocket, conn: Conn): void {
  registry.add(conn);

  ws.on("message", (raw: Buffer) => {
    void onMessage(conn, raw.toString());
  });

  ws.on("close", (code: number) => {
    void registry.remove(conn, code);
  });

  ws.on("error", (err: Error) => {
    logError("ws", err);
  });

  void greet(conn).catch((err) => logError("greet", err));
}

async function greet(conn: Conn): Promise<void> {
  // Даже если хранилище сейчас недоступно, hello уйти обязан: клиент без него
  // висит до таймаута, не понимая, подключился он или нет.
  let resumeInto: ResumeInto = { kind: "none" };
  try {
    resumeInto = await whereToReturn(conn.userId);
  } catch (err) {
    logError("greet", err);
  }

  registry.send(conn, "hello", {
    userId: conn.userId,
    nickname: conn.nickname,
    rating: conn.rating,
    protocolVersion: PROTOCOL_VERSION,
    resumeToken: conn.resumeToken,
    serverTime: Date.now(),
    resumeInto,
  });

  try {
    await announcePresence(
      conn.userId,
      resumeInto.kind === "match"
        ? "in_match"
        : resumeInto.kind === "lobby"
          ? "in_lobby"
          : "online",
    );

    // Игрок, у которого оборвалась связь в бою, возвращается в бой сам.
    if (resumeInto.kind === "match") {
      await resumeIntoMatch(conn, resumeInto.matchId);
    } else if (resumeInto.kind === "lobby") {
      conn.scope = { kind: "lobby", code: resumeInto.code };
    } else if (resumeInto.kind === "queue") {
      conn.scope = { kind: "queue" };
    }
  } catch (err) {
    // Соединение уже установлено — падать нельзя, клиент дозапросит снапшот.
    logError("greet", err);
  }
}

/** Порядок важен: незаконченный матч приоритетнее лобби и очереди. */
async function whereToReturn(userId: string): Promise<ResumeInto> {
  const matchId = await getUserMatch(userId);
  if (matchId) return { kind: "match", matchId };

  const code = await getUserLobby(userId);
  if (code) return { kind: "lobby", code };

  if (await readEntry(userId)) return { kind: "queue" };

  return { kind: "none" };
}

async function onMessage(conn: Conn, raw: string): Promise<void> {
  const decoded = decodeEnvelope(raw);

  if (!decoded.ok) {
    if (decoded.reason === "version") {
      log({ evt: "ws.reject", reason: "protocol" });
      registry.send(conn, "error", buildError("PROTOCOL_VERSION"));
      conn.ws.close(CLOSE.PROTOCOL_MISMATCH, "protocol mismatch");
      return;
    }

    registry.send(conn, "error", buildError("ILLEGAL_ACTION"));
    return;
  }

  const { envelope } = decoded;

  if (envelope.type === "resume") {
    await onResume(conn, envelope.payload);
    return;
  }

  conn.inSeq = envelope.seq;
  await route(conn, envelope);
}

/**
 * Клиент предъявляет resume-token после разрыва. Токен подтверждает, что это
 * та же сессия, и позволяет вернуть игрока туда, где он был.
 */
async function onResume(conn: Conn, payload: unknown): Promise<void> {
  const parsed = parseClientPayload("resume", payload);
  if (!parsed.success) return;

  const userId = await readResumeToken(parsed.data.resumeToken);
  if (userId !== conn.userId) {
    log({
      evt: "reconnect.fail",
      userId: conn.userId,
      downtimeMs: Date.now() - conn.connectedAt,
    });
    metrics.bump("reconnect.fail");
    registry.send(conn, "error", buildError("AUTH_INVALID"));
    return;
  }

  log({
    evt: "reconnect.ok",
    userId,
    downtimeMs: Date.now() - conn.connectedAt,
  });
  metrics.bump("reconnect.ok");

  const resumeInto = await whereToReturn(conn.userId);
  if (resumeInto.kind === "match") await resumeIntoMatch(conn, resumeInto.matchId);
}

/* ------------------------------------------------------------------ *
 * Разрыв связи
 * ------------------------------------------------------------------ */

/**
 * То, чего не делала прежняя реализация вовсе: убрать из очереди, закрыть или
 * освободить лобби, запустить grace в матче и погасить presence.
 */
async function handleDisconnect(conn: Conn): Promise<void> {
  try {
    await dropFromQueue(conn);
    await leaveCurrentLobby(conn, "left");
    await onMatchDisconnect(conn);
    await announcePresence(conn.userId, "offline");
  } catch (err) {
    logError("disconnect", err);
  }
}
