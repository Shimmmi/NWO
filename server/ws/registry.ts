import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { Match } from "@/lib/game/types";
import { toPlayerView } from "@/lib/game/view";
import { CLOSE } from "@/lib/net/close-codes";
import { buildError, type ProtocolErrorPayload } from "@/lib/net/errors";
import { log } from "@/lib/net/log";
import {
  encode,
  HEAVY_ACTIONS,
  type ClientMessageType,
  type PlayerNum,
  type PresenceStatus,
  type ServerMessageType,
  type ServerPayload,
} from "@/lib/net/protocol";
import * as metrics from "@/lib/redis/metrics-store";
import * as presence from "@/lib/redis/presence-store";

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

const LIMITS = {
  bucketSize: 20,
  refillPerSec: 10,
  /** Тяжёлые операции пишут в Redis — им отдельный, строгий интервал. */
  heavyIntervalMs: 2_000,
  banMs: 30_000,
} as const;

/** Идемпотентность по id кадра: столько живёт запись о виденном сообщении. */
const SEEN_TTL_MS = 120_000;

export type ConnScope =
  | { kind: "none" }
  | { kind: "queue" }
  | { kind: "lobby"; code: string }
  | { kind: "match"; matchId: string; playerNum: PlayerNum };

export interface Conn {
  readonly id: string;
  readonly ws: WebSocket;
  readonly userId: string;
  nickname: string;
  rating: number;
  /** Unix-миллисекунды истечения сессии из тикета (ЧАСТЬ 5.5 ТЗ). */
  sessionExpMs: number;
  resumeToken: string;
  /** Схема и хост из заголовков апгрейда — инвайт-ссылки строятся от него. */
  readonly origin: string;
  readonly connectedAt: number;

  scope: ConnScope;
  presenceSubscribed: boolean;

  lastPongAt: number;
  rttMs: number | null;

  outSeq: number;
  /** Разрыв во входящем seq означает потерю кадров — клиент запросит снапшот. */
  inSeq: number;

  tokens: number;
  lastRefillAt: number;
  lastHeavyAt: number;
  firstOverflowAt: number | null;

  seen: Map<string, number>;
}

export type LimitVerdict =
  | { ok: true }
  | { ok: false; retryAfterMs: number; kill: boolean };

export type DisconnectHandler = (conn: Conn) => Promise<void>;

/**
 * Реестр живых сокетов: адресация, heartbeat, rate-limit и рассылка.
 * Единственное место, которое знает про объект WebSocket, — всё остальное
 * работает с Conn.
 */
export class SocketRegistry {
  private readonly byId = new Map<string, Conn>();
  private readonly byUser = new Map<string, Conn>();
  private timer: NodeJS.Timeout | null = null;
  private onDisconnect: DisconnectHandler = async () => {};

  /* ---------------------------------------------------------------- *
   * Жизненный цикл
   * ---------------------------------------------------------------- */

  handleDisconnectWith(handler: DisconnectHandler): void {
    this.onDisconnect = handler;
  }

  create(
    ws: WebSocket,
    identity: {
      userId: string;
      nickname: string;
      rating: number;
      sessionExpMs: number;
      resumeToken: string;
      origin: string;
    },
  ): Conn {
    const now = Date.now();
    return {
      id: randomUUID(),
      ws,
      userId: identity.userId,
      nickname: identity.nickname,
      rating: identity.rating,
      sessionExpMs: identity.sessionExpMs,
      resumeToken: identity.resumeToken,
      origin: identity.origin,
      connectedAt: now,
      scope: { kind: "none" },
      presenceSubscribed: false,
      lastPongAt: now,
      rttMs: null,
      outSeq: 0,
      inSeq: -1,
      tokens: LIMITS.bucketSize,
      lastRefillAt: now,
      lastHeavyAt: 0,
      firstOverflowAt: null,
      seen: new Map(),
    };
  }

  /** Вторая вкладка вытесняет первую: два сокета одного игрока — гарантированный рассинхрон. */
  add(conn: Conn): Conn | null {
    const previous = this.byUser.get(conn.userId);
    if (previous && previous.id !== conn.id) {
      this.send(previous, "error", buildError("AUTH_INVALID"));
      previous.ws.close(CLOSE.REPLACED, "replaced");
      this.byId.delete(previous.id);
    }

    this.byId.set(conn.id, conn);
    this.byUser.set(conn.userId, conn);
    log({ evt: "ws.connect", userId: conn.userId, connId: conn.id });
    metrics.bump("conn.total");
    metrics.setConnections(this.byId.size);

    return previous ?? null;
  }

  /**
   * Удаление до вызова обработчика: он не должен видеть себя живым.
   * Вытесненное соединение здесь уже удалено из byId, и это намеренно —
   * для него уборка не нужна, игрок остался онлайн на новом сокете.
   */
  async remove(conn: Conn, code: number): Promise<void> {
    if (!this.byId.delete(conn.id)) return;
    if (this.byUser.get(conn.userId)?.id === conn.id) {
      this.byUser.delete(conn.userId);
    }

    log({
      evt: "ws.close",
      connId: conn.id,
      code,
      durationMs: Date.now() - conn.connectedAt,
    });
    metrics.setConnections(this.byId.size);

    await this.onDisconnect(conn);
  }

  get(connId: string): Conn | undefined {
    return this.byId.get(connId);
  }

  forUser(userId: string): Conn | undefined {
    return this.byUser.get(userId);
  }

  isOnline(userId: string): boolean {
    return this.byUser.has(userId);
  }

  all(): Conn[] {
    return [...this.byId.values()];
  }

  size(): number {
    return this.byId.size;
  }

  /* ---------------------------------------------------------------- *
   * Отправка
   * ---------------------------------------------------------------- */

  send<T extends ServerMessageType>(
    conn: Conn,
    type: T,
    payload: ServerPayload<T>,
  ): void {
    if (conn.ws.readyState !== conn.ws.OPEN) return;
    conn.ws.send(encode(type, payload, conn.outSeq++, randomUUID()));
  }

  sendTo<T extends ServerMessageType>(
    userId: string,
    type: T,
    payload: ServerPayload<T>,
  ): boolean {
    const conn = this.byUser.get(userId);
    if (!conn) return false;

    this.send(conn, type, payload);
    return true;
  }

  ack(conn: Conn, id: string, error?: ProtocolErrorPayload): void {
    this.send(conn, "ack", { id, ok: !error, ...(error ? { error } : {}) });
  }

  fail(conn: Conn, id: string, error: ProtocolErrorPayload): void {
    this.ack(conn, id, error);
    this.send(conn, "error", error);
  }

  /**
   * Каждый игрок получает свою проекцию — единственный путь состояния матча
   * наружу (инвариант 3 ТЗ).
   */
  pushMatchState(match: Match, version: number): void {
    for (const [playerNum, player] of [
      [1, match.player1],
      [2, match.player2],
    ] as const) {
      if (player.isAi) continue;

      const conn = this.byUser.get(player.id);
      if (!conn) continue;

      this.send(conn, "game_state", {
        matchId: match.id,
        playerNum,
        version,
        view: toPlayerView(match, playerNum),
      });
    }
  }

  pushMatchStateTo(conn: Conn, match: Match, version: number): void {
    const playerNum: PlayerNum = match.player1.id === conn.userId ? 1 : 2;
    this.send(conn, "game_state", {
      matchId: match.id,
      playerNum,
      version,
      view: toPlayerView(match, playerNum),
    });
  }

  /** Соперник по матчу, если он сейчас подключён. */
  opponentOf(match: Match, userId: string): Conn | undefined {
    const opponentId =
      match.player1.id === userId ? match.player2.id : match.player1.id;
    return this.byUser.get(opponentId);
  }

  /* ---------------------------------------------------------------- *
   * Rate-limit и идемпотентность
   * ---------------------------------------------------------------- */

  consume(conn: Conn, type: ClientMessageType): LimitVerdict {
    const now = Date.now();

    const elapsedSec = (now - conn.lastRefillAt) / 1000;
    conn.tokens = Math.min(
      LIMITS.bucketSize,
      conn.tokens + elapsedSec * LIMITS.refillPerSec,
    );
    conn.lastRefillAt = now;

    if (HEAVY_ACTIONS.has(type)) {
      const since = now - conn.lastHeavyAt;
      if (since < LIMITS.heavyIntervalMs) {
        return {
          ok: false,
          retryAfterMs: LIMITS.heavyIntervalMs - since,
          kill: false,
        };
      }
      conn.lastHeavyAt = now;
    }

    if (conn.tokens < 1) {
      // Второе превышение в течение минуты — это уже не всплеск, а бот.
      const repeat =
        conn.firstOverflowAt !== null && now - conn.firstOverflowAt < 60_000;
      conn.firstOverflowAt ??= now;

      return { ok: false, retryAfterMs: LIMITS.banMs, kill: repeat };
    }

    conn.tokens -= 1;
    return { ok: true };
  }

  /** false — кадр с таким id уже обработан, повторять действие нельзя. */
  markSeen(conn: Conn, msgId: string): boolean {
    const now = Date.now();

    for (const [id, at] of conn.seen) {
      if (now - at > SEEN_TTL_MS) conn.seen.delete(id);
    }

    if (conn.seen.has(msgId)) return false;

    conn.seen.set(msgId, now);
    return true;
  }

  /* ---------------------------------------------------------------- *
   * Heartbeat
   * ---------------------------------------------------------------- */

  startHeartbeat(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      const now = Date.now();

      for (const conn of this.all()) {
        if (now - conn.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
          // terminate, а не close: ответа от мёртвого сокета не дождаться.
          conn.ws.terminate();
          void this.remove(conn, CLOSE.GOING_AWAY);
          continue;
        }

        this.send(conn, "ping", { echo: now });
        this.refreshPresence(conn);
      }

      metrics.setConnections(this.byId.size);
    }, HEARTBEAT_INTERVAL_MS);

    this.timer.unref();
  }

  /**
   * Присутствие живёт 45 секунд, а сессия — часами. Без продления игрок в
   * лобби или в очереди становится «не в сети» для друзей и для уборщика.
   */
  private refreshPresence(conn: Conn): void {
    const status: PresenceStatus =
      conn.scope.kind === "lobby"
        ? "in_lobby"
        : conn.scope.kind === "match"
          ? "in_match"
          : "online";

    void presence.touch(conn.userId, status).catch(() => {});
  }

  notePong(conn: Conn, echo: number): void {
    conn.lastPongAt = Date.now();
    conn.rttMs = Math.max(0, Date.now() - echo);
    metrics.recordRtt(conn.rttMs);
  }

  stopHeartbeat(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Закрытие с кодом 4503 — клиент по нему знает, что надо переподключиться. */
  closeAll(code: number, reason: string): void {
    for (const conn of this.all()) {
      if (conn.ws.readyState === conn.ws.OPEN) conn.ws.close(code, reason);
    }
  }

  /**
   * Клиент может не ответить на close-кадр, и тогда сокет держит http-сервер
   * открытым, а деплой — висящим. После вежливого закрытия рвём принудительно.
   */
  terminateAll(): void {
    for (const conn of this.all()) conn.ws.terminate();
    this.byId.clear();
    this.byUser.clear();
  }
}

export const registry = new SocketRegistry();
