import { MM } from "@/lib/game/matchmaking-rules";
import { ProtocolError } from "@/lib/net/errors";
import { log, logError } from "@/lib/net/log";
import type { ClientPayload } from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";
import { getUserMatch } from "@/lib/redis/match-store";
import * as presence from "@/lib/redis/presence-store";
import * as queue from "@/lib/redis/queue-store";
import { leaveCurrentLobby } from "@/server/ws/handlers/lobby";
import { startMatch } from "@/server/ws/start-match";
import { registry, type Conn } from "@/server/ws/registry";

/* ------------------------------------------------------------------ *
 * Хендлеры
 * ------------------------------------------------------------------ */

export async function onFindMatch(
  conn: Conn,
  payload: ClientPayload<"find_match">,
): Promise<void> {
  const activeMatch = await getUserMatch(conn.userId);
  if (activeMatch) throw new ProtocolError("ALREADY_IN_MATCH");

  // Поиск случайного соперника означает отказ от текущей комнаты.
  if (conn.scope.kind === "lobby") await leaveCurrentLobby(conn, "left");

  // Ник и рейтинг берутся из тикета, а не из payload: клиенту тут веры нет.
  await queue.enqueue({
    userId: conn.userId,
    nickname: conn.nickname,
    rating: conn.rating,
    characterId: payload.characterId,
    ...(payload.deckId ? { deckId: payload.deckId } : {}),
    connId: conn.id,
    joinedAt: Date.now(),
    ...(await lastOpponentOf(conn.userId)),
  });

  conn.scope = { kind: "queue" };
  await presence.touch(conn.userId, "online");
  await pushQueueState(conn);
}

export async function onCancelMatchmaking(conn: Conn): Promise<void> {
  const removed = await queue.dequeue(conn.userId);

  if (conn.scope.kind === "queue") conn.scope = { kind: "none" };

  // Не удалось снять — пару уже забрал popPair, матч сейчас придёт сам.
  registry.send(conn, "queue_left", {
    reason: removed ? "cancelled" : "matched",
  });
}

/** Уборка при разрыве связи — иначе в очереди остаются призраки. */
export async function dropFromQueue(conn: Conn): Promise<void> {
  if (conn.scope.kind !== "queue") return;
  await queue.dequeue(conn.userId);
}

/* ------------------------------------------------------------------ *
 * Тик матчмейкера
 * ------------------------------------------------------------------ */

let ticker: NodeJS.Timeout | null = null;
let ticking = false;

export function startMatchmaker(): void {
  if (ticker) return;

  ticker = setInterval(() => {
    // Тик длиннее секунды не должен наслаиваться сам на себя.
    if (ticking) return;
    ticking = true;

    void tick()
      .catch((err) => logError("matchmaker", err))
      .finally(() => {
        ticking = false;
      });
  }, MM.TICK_MS);

  ticker.unref();
}

export function stopMatchmaker(): void {
  if (!ticker) return;
  clearInterval(ticker);
  ticker = null;
}

/**
 * Один проход подбора. Кандидаты собираются по всем активным бакетам, потому
 * что окно поиска со временем перерастает ширину бакета, и игроки из соседних
 * обязаны становиться доступными друг другу.
 */
async function tick(): Promise<void> {
  const buckets = await queue.activeBuckets();
  if (!buckets.length) return;

  const pool = (await Promise.all(buckets.map((b) => queue.listBucket(b))))
    .flat()
    .sort((a, b) => a.joinedAt - b.joinedAt);

  // Ждущий дольше всех идёт первым и «тянет» окно к своему рейтингу.
  for (const anchor of pool) {
    await pairWith(anchor, pool);
  }

  await broadcastQueueStates();
}

async function pairWith(
  anchor: queue.QueueEntry,
  pool: queue.QueueEntry[],
): Promise<void> {
  const waitedSec = Math.floor((Date.now() - anchor.joinedAt) / 1000);
  const window = queue.currentWindow(waitedSec);

  const opponent = pickOpponent(anchor, pool, window);
  if (!opponent) return;

  // Забираем обоих по очереди: если второй достался чужому тику, первого
  // возвращаем в очередь — иначе он молча выпадет из поиска.
  if (!(await queue.claim(anchor))) return;

  if (!(await queue.claim(opponent))) {
    await queue.enqueue(anchor);
    return;
  }

  remove(pool, anchor);
  remove(pool, opponent);

  try {
    await Promise.all([
      queue.recordWait(Date.now() - anchor.joinedAt),
      queue.recordWait(Date.now() - opponent.joinedAt),
    ]);

    for (const entry of [anchor, opponent]) {
      const conn = registry.forUser(entry.userId);
      if (!conn) continue;

      conn.scope = { kind: "none" };
      registry.send(conn, "queue_left", { reason: "matched" });
    }

    log({
      evt: "queue.match",
      waitMs: Date.now() - anchor.joinedAt,
      ratingDelta: Math.abs(anchor.rating - opponent.rating),
      window: window === Infinity ? -1 : window,
    });

    await startMatch(toSide(anchor), toSide(opponent), "queue");
    await Promise.all([
      rememberOpponent(anchor.userId, opponent.userId),
      rememberOpponent(opponent.userId, anchor.userId),
    ]);
  } catch (err) {
    logError("matchmaker", err);
    for (const entry of [anchor, opponent]) {
      registry.sendTo(entry.userId, "queue_left", { reason: "error" });
    }
  }
}

/**
 * Ближайший по рейтингу из тех, кто попадает в окно. Недавнего соперника
 * пропускаем, но только если есть кем его заменить — иначе реванш лучше,
 * чем бесконечный поиск.
 */
function pickOpponent(
  anchor: queue.QueueEntry,
  pool: queue.QueueEntry[],
  window: number,
): queue.QueueEntry | null {
  const eligible = pool.filter(
    (e) =>
      e.userId !== anchor.userId &&
      // Заявка могла пережить разрыв связи: свести живого с призраком нельзя.
      registry.isOnline(e.userId) &&
      Math.abs(e.rating - anchor.rating) <= window,
  );

  if (!eligible.length) return null;

  const fresh = eligible.filter(
    (e) => e.lastOpponent !== anchor.userId && anchor.lastOpponent !== e.userId,
  );

  const pick = (fresh.length ? fresh : eligible).sort(
    (a, b) => Math.abs(a.rating - anchor.rating) - Math.abs(b.rating - anchor.rating),
  );

  return pick[0];
}

function remove(pool: queue.QueueEntry[], entry: queue.QueueEntry): void {
  const index = pool.findIndex((e) => e.userId === entry.userId);
  if (index >= 0) pool.splice(index, 1);
}

async function broadcastQueueStates(): Promise<void> {
  const total = await queue.queueSize();
  if (!total) return;

  for (const conn of registry.all()) {
    if (conn.scope.kind !== "queue") continue;
    await pushQueueState(conn, total);
  }
}

async function pushQueueState(conn: Conn, knownTotal?: number): Promise<void> {
  const entry = await queue.readEntry(conn.userId);
  if (!entry) return;

  const elapsedSeconds = Math.floor((Date.now() - entry.joinedAt) / 1000);
  const window = queue.currentWindow(elapsedSeconds);

  registry.send(conn, "queue_state", {
    position: await positionOf(entry.rating, entry.userId),
    etaSeconds: await queue.estimateEta(elapsedSeconds),
    // Infinity в JSON превратится в null — отдаём -1 как «без ограничений».
    searchWindow: window === Infinity ? -1 : window,
    elapsedSeconds,
    playersSearching: knownTotal ?? (await queue.queueSize()),
    offerAi: elapsedSeconds >= MM.MAX_QUEUE_SEC,
  });
}

/* ------------------------------------------------------------------ *
 * Внутреннее
 * ------------------------------------------------------------------ */

function toSide(entry: queue.QueueEntry) {
  return {
    userId: entry.userId,
    nickname: entry.nickname,
    rating: entry.rating,
    characterId: entry.characterId,
  };
}

/** Позиция в очереди по времени ожидания: кто раньше встал, тот выше. */
async function positionOf(rating: number, userId: string): Promise<number> {
  const entries = await queue.listBucket(queue.bucketOf(rating));
  const index = entries.findIndex((e) => e.userId === userId);

  return index < 0 ? 1 : index + 1;
}

async function rememberOpponent(userId: string, opponentId: string): Promise<void> {
  await kv().set(K.lastOpponent(userId), opponentId, {
    ex: MM.REMATCH_COOLDOWN_SEC,
  });
}

async function lastOpponentOf(
  userId: string,
): Promise<{ lastOpponent?: string }> {
  const value = await kv().get(K.lastOpponent(userId));
  return value ? { lastOpponent: value } : {};
}

/** Фоновая уборка заявок, переживших падение процесса. */
export function startQueueSweeper(): void {
  // Живость берём из Redis, а не из локального реестра: очередь общая, и
  // процесс, не знающий о чужих сокетах, вычистил бы живых игроков.
  const sweep = () =>
    void queue
      .sweepStale(
        async (userId) =>
          registry.isOnline(userId) || presence.isOnline(userId),
      )
      .then((removed) => {
        if (removed) log({ evt: "queue.sweep", removed });
      })
      .catch((err) => logError("queue-sweeper", err));

  // Сразу на старте: очередь после перезапуска полна заявок мёртвых сессий.
  sweep();

  setInterval(sweep, TTL.PRESENCE_SEC * 1000).unref();
}
