/**
 * Структурные логи: одна строка JSON на событие.
 * Никаких персональных данных и никаких карт — только идентификаторы и тайминги.
 */
export type LogEvent =
  | { evt: "ws.listen"; port: number }
  | { evt: "ws.connect"; userId: string; connId: string }
  | { evt: "ws.close"; connId: string; code: number; durationMs: number }
  | {
      evt: "ws.reject";
      reason: "auth" | "origin" | "protocol" | "rate" | "path";
    }
  | {
      evt: "ws.rate_limited";
      userId: string;
      type: string;
      retryAfterMs: number;
    }
  | { evt: "queue.join"; userId: string; rating: number; bucket: number }
  | {
      evt: "queue.match";
      waitMs: number;
      ratingDelta: number;
      window: number;
    }
  | { evt: "queue.cancel"; userId: string; waitMs: number }
  | { evt: "queue.sweep"; removed: number }
  | { evt: "lobby.create"; code: string; userId: string }
  | { evt: "lobby.join"; code: string; userId: string; ok: boolean }
  | { evt: "lobby.close"; code: string; reason: string }
  | {
      evt: "match.start";
      matchId: string;
      source: "queue" | "lobby" | "rematch";
    }
  | { evt: "match.timeout"; matchId: string; playerNum: 1 | 2 }
  | {
      evt: "match.grace";
      matchId: string;
      playerNum: 1 | 2;
      phase: "start" | "end" | "expired";
    }
  | { evt: "match.action"; matchId: string; type: string; latencyMs: number }
  | {
      evt: "match.end";
      matchId: string;
      reason: string;
      turns: number;
      durationMs: number;
    }
  | { evt: "match.cas_conflict"; matchId: string; attempt: number }
  | { evt: "reconnect.ok"; userId: string; downtimeMs: number }
  | { evt: "reconnect.fail"; userId: string; downtimeMs: number }
  | { evt: "redis.degraded"; error: string }
  | { evt: "redis.ready" }
  | { evt: "shutdown"; signal: string };

export function log(e: LogEvent): void {
  console.log(JSON.stringify({ ts: Date.now(), ...e }));
}

export function warn(scope: string, message: string): void {
  console.warn(JSON.stringify({ ts: Date.now(), level: "warn", scope, message }));
}

export function logError(scope: string, err: unknown): void {
  console.error(
    JSON.stringify({
      ts: Date.now(),
      level: "error",
      scope,
      message: err instanceof Error ? err.message : String(err),
    }),
  );
}
