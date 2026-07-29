/**
 * Метрики живут в Redis, а не в памяти процесса. Причина не в масштабировании:
 * route handler-ы Next и сокет-сервер собираются в разные модульные графы
 * одного процесса, и общая переменная между ними попросту не видна.
 */
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";
import type { FinishReason } from "@/lib/net/protocol";

/** Счётчики за сутки. Имя попадает в ключ, поэтому список закрыт. */
export type Counter =
  | "conn.total"
  | "queue.match"
  | "lobby.created"
  | "lobby.join.ok"
  | "lobby.join.fail"
  | "reconnect.ok"
  | "reconnect.fail"
  | "cas.conflict"
  | `match.end.${FinishReason}`;

/** Сколько замеров RTT держим для среднего. */
const RTT_WINDOW = 50;

/** Заведомо больше интервала сердцебиения, которое его продлевает. */
const CONN_GAUGE_TTL_SEC = 60;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Метрика не вправе задерживать игровое действие и тем более ронять его,
 * поэтому запись не ожидается и ошибки глотаются.
 */
export function bump(name: Counter, by = 1): void {
  void (async () => {
    const key = K.stat(name, today());
    await kv().incrby(key, by);
    await kv().expire(key, TTL.STAT_SEC);
  })().catch(() => {});
}

async function read(name: string): Promise<number> {
  const raw = await kv().get(K.stat(name, today()));
  return Number(raw ?? 0) || 0;
}

/* ------------------------------------------------------------------ *
 * Мгновенные значения
 * ------------------------------------------------------------------ */

/**
 * Текущее число сокетов плюс дневной пик. У счётчика есть TTL: если процесс
 * умрёт жёстко, мониторинг не будет вечно показывать призрачные соединения —
 * значение продлевается сердцебиением реестра.
 */
export function setConnections(current: number): void {
  void (async () => {
    await kv().set(K.gauge("conn.current"), String(current), {
      ex: CONN_GAUGE_TTL_SEC,
    });

    const peakKey = K.stat("conn.peak", today());
    const peak = Number((await kv().get(peakKey)) ?? 0);
    if (current <= peak) return;

    await kv().set(peakKey, String(current), { ex: TTL.STAT_SEC });
  })().catch(() => {});
}

export function recordRtt(ms: number): void {
  void (async () => {
    await kv().lpush(K.rttSamples(), String(Math.round(ms)));
    await kv().ltrim(K.rttSamples(), 0, RTT_WINDOW - 1);
  })().catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Живые множества
 * ------------------------------------------------------------------ */

export function trackMatch(matchId: string, alive: boolean): void {
  void (alive
    ? kv().sadd(K.liveMatches(), matchId)
    : kv().srem(K.liveMatches(), matchId)
  ).catch(() => {});
}

export function trackLobby(code: string, alive: boolean): void {
  void (alive
    ? kv().sadd(K.liveLobbies(), code)
    : kv().srem(K.liveLobbies(), code)
  ).catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Чтение для /api/metrics
 * ------------------------------------------------------------------ */

export interface MetricsSnapshot {
  connections: { current: number; peak24h: number; totalToday: number };
  queue: {
    searching: number;
    avgWaitMs: number;
    p95WaitMs: number;
    matchesToday: number;
  };
  lobbies: { active: number; createdToday: number; joinRate: number };
  matches: {
    inProgress: number;
    finishedToday: number;
    byReason: Record<FinishReason, number>;
  };
  reliability: {
    reconnectSuccessRate: number;
    avgRttMs: number;
    casConflicts: number;
  };
}

const REASONS: FinishReason[] = [
  "hp",
  "surrender",
  "disconnect_timeout",
  "turn_timeout",
];

export async function snapshot(queueSize: number): Promise<MetricsSnapshot> {
  const [waits, byReasonValues] = await Promise.all([
    kv()
      .lrange(K.queueStats(), 0, -1)
      .then((raw) => raw.map(Number).filter(Number.isFinite)),
    Promise.all(REASONS.map((r) => read(`match.end.${r}`))),
  ]);

  const [
    current,
    peak24h,
    totalToday,
    matchesToday,
    createdToday,
    joinOk,
    joinFail,
    reconnectOk,
    reconnectFail,
    casConflicts,
    liveMatches,
    liveLobbies,
    rtt,
  ] = await Promise.all([
    kv()
      .get(K.gauge("conn.current"))
      .then((v) => Number(v ?? 0) || 0),
    read("conn.peak"),
    read("conn.total"),
    read("queue.match"),
    read("lobby.created"),
    read("lobby.join.ok"),
    read("lobby.join.fail"),
    read("reconnect.ok"),
    read("reconnect.fail"),
    read("cas.conflict"),
    kv().scard(K.liveMatches()),
    kv().scard(K.liveLobbies()),
    kv()
      .lrange(K.rttSamples(), 0, -1)
      .then((raw) => raw.map(Number).filter(Number.isFinite)),
  ]);

  const byReason = Object.fromEntries(
    REASONS.map((r, i) => [r, byReasonValues[i]]),
  ) as Record<FinishReason, number>;

  return {
    connections: { current, peak24h, totalToday },
    queue: {
      searching: queueSize,
      avgWaitMs: Math.round(mean(waits) * 1000),
      p95WaitMs: Math.round(percentile(waits, 0.95) * 1000),
      matchesToday,
    },
    lobbies: {
      active: liveLobbies,
      createdToday,
      joinRate: ratio(joinOk, joinOk + joinFail),
    },
    matches: {
      inProgress: liveMatches,
      finishedToday: byReasonValues.reduce((sum, n) => sum + n, 0),
      byReason,
    },
    reliability: {
      reconnectSuccessRate: ratio(reconnectOk, reconnectOk + reconnectFail),
      avgRttMs: Math.round(mean(rtt)),
      casConflicts,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Внутреннее
 * ------------------------------------------------------------------ */

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[index];
}

/** Доля от нуля событий — не ноль процентов, а «данных нет»: отдаём 1. */
function ratio(part: number, total: number): number {
  if (total === 0) return 1;
  return Math.round((part / total) * 100) / 100;
}
