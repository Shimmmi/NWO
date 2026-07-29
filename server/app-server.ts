import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { CLOSE } from "@/lib/net/close-codes";
import { log, logError } from "@/lib/net/log";
import { closeKv } from "@/lib/redis/client";
import { attachWebSocket } from "@/server/ws/attach";
import {
  startMatchmaker,
  startQueueSweeper,
  stopMatchmaker,
} from "@/server/ws/handlers/queue";
import { stopLobbyTimers } from "@/server/ws/handlers/lobby";
import { stopAllTimers } from "@/server/ws/match-hub";
import { registry } from "@/server/ws/registry";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/nwo";

/** Сколько ждём, пока клиенты сами закроют сокеты после кода 4503. */
const SOCKET_DRAIN_MS = 1_500;

/** Крайний срок остановки: дальше процесс выходит в любом случае. */
const SHUTDOWN_DEADLINE_MS = 8_000;

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((req, res) => {
    void handle(req, res, parse(req.url ?? "/", true));
  });

  // HTTP и WebSocket в одном процессе: клиенту больше не нужен отдельный порт,
  // а значит и вшитый в билд адрес (ЧАСТЬ 1.1 ТЗ).
  attachWebSocket(server, {
    path: `${basePath}/ws`,
    allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  });

  // Порт занят — процесс обязан умереть. Живой сервер без слушателя всё равно
  // крутит матчмейкер и уборщик очереди, то есть вычищает игроков соседа.
  server.on("error", (err) => {
    logError("app-server", err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    log({ evt: "ws.listen", port });

    startMatchmaker();
    startQueueSweeper();
    installShutdown(server);
  });
}

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Деплой не должен обрывать матчи: состояние уже в Redis, поэтому достаточно
 * закрыть сокеты кодом 4503 — клиент по нему переподключается сам.
 */
function installShutdown(server: ReturnType<typeof createServer>): void {
  let shuttingDown = false;

  const stop = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log({ evt: "shutdown", signal });

    registry.closeAll(CLOSE.SERVER_SHUTDOWN, "server restart");
    registry.stopHeartbeat();
    stopMatchmaker();
    stopLobbyTimers();
    stopAllTimers();

    // Крайний срок: порт обязан освободиться, иначе следующий инстанс не встанет.
    setTimeout(() => process.exit(0), SHUTDOWN_DEADLINE_MS).unref();

    setTimeout(() => {
      registry.terminateAll();
      server.close(() => {
        void closeKv().finally(() => process.exit(0));
      });
    }, SOCKET_DRAIN_MS).unref();
  };

  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

main().catch((err) => {
  logError("app-server", err);
  process.exit(1);
});
