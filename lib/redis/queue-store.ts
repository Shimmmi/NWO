import { MM } from "@/lib/game/matchmaking-rules";
import { log } from "@/lib/net/log";
import { kv } from "@/lib/redis/client";
import { K } from "@/lib/redis/keys";

export interface QueueEntry {
  userId: string;
  nickname: string;
  rating: number;
  characterId: string;
  deckId?: string;
  connId: string;
  joinedAt: number;
  lastOpponent?: string;
}

/** Сколько замеров ожидания храним для ETA (ЧАСТЬ 6.4 ТЗ). */
const STATS_WINDOW = 20;
const MIN_SAMPLES = 3;

/** Моложе этого возраста заявка считается заведомо живой. */
const STALE_MIN_AGE_MS = 60_000;

export function bucketOf(rating: number): number {
  return Math.floor(rating / MM.BUCKET_SIZE);
}

/** Ширина окна по времени ожидания. После 60 секунд — Infinity, «кто угодно». */
export function currentWindow(waitedSec: number): number {
  let window = MM.WINDOW_SCHEDULE[0].window as number;
  for (const step of MM.WINDOW_SCHEDULE) {
    if (waitedSec >= step.afterSec) window = step.window;
  }
  return window;
}

/** Повторный find_match обновляет запись, а не создаёт дубль. */
export async function enqueue(entry: QueueEntry): Promise<void> {
  const bucket = bucketOf(entry.rating);

  // Рейтинг мог измениться после прошлой заявки — иначе игрок останется в двух бакетах.
  const previous = await kv().hget(K.queueMeta(entry.userId), "bucket");
  if (previous && Number(previous) !== bucket) {
    await kv().zrem(K.queue(Number(previous)), entry.userId);
  }

  await kv().sadd(K.queueBuckets(), String(bucket));
  await kv().zadd(K.queue(bucket), entry.rating, entry.userId);
  await kv().hset(K.queueMeta(entry.userId), {
    userId: entry.userId,
    nickname: entry.nickname,
    rating: entry.rating,
    characterId: entry.characterId,
    deckId: entry.deckId ?? "",
    connId: entry.connId,
    joinedAt: entry.joinedAt,
    bucket,
    lastOpponent: entry.lastOpponent ?? "",
  });

  log({ evt: "queue.join", userId: entry.userId, rating: entry.rating, bucket });
}

/** false — игрока уже забрал матчмейкер, отмена опоздала и матч создан. */
export async function dequeue(userId: string): Promise<boolean> {
  const meta = await kv().hgetall(K.queueMeta(userId));
  if (!meta.bucket) return false;

  // Порядок важен: сначала ZREM, потом DEL меты.
  const removed = await kv().zrem(K.queue(Number(meta.bucket)), userId);
  await kv().del(K.queueMeta(userId));

  log({
    evt: "queue.cancel",
    userId,
    waitMs: Date.now() - Number(meta.joinedAt ?? Date.now()),
  });

  return removed === 1;
}

export async function readEntry(userId: string): Promise<QueueEntry | null> {
  const meta = await kv().hgetall(K.queueMeta(userId));
  return meta.userId ? toEntry(meta) : null;
}

/** Заявки бакета в порядке ожидания: кто встал раньше, тот первым в списке. */
export async function listBucket(bucket: number): Promise<QueueEntry[]> {
  const ids = await kv().zrangebyscore(K.queue(bucket), -Infinity, Infinity);
  if (!ids.length) return [];

  const entries = await Promise.all(ids.map((id) => readEntry(id)));

  return entries
    .filter((e): e is QueueEntry => e !== null)
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * Забирает игрока из очереди под матч. ZREM атомарен, поэтому единица в
 * ответе означает «этот игрок достался именно нам» — двух матчей на одного
 * не получится даже при параллельных тиках.
 */
export async function claim(entry: QueueEntry): Promise<boolean> {
  const removed = await kv().zrem(K.queue(bucketOf(entry.rating)), entry.userId);
  if (removed !== 1) return false;

  await kv().del(K.queueMeta(entry.userId));
  return true;
}

export async function activeBuckets(): Promise<number[]> {
  const members = await kv().smembers(K.queueBuckets());
  return members.map(Number).sort((a, b) => a - b);
}

export async function queueSize(): Promise<number> {
  const buckets = await activeBuckets();
  const sizes = await Promise.all(buckets.map((b) => kv().zcard(K.queue(b))));
  return sizes.reduce((sum, n) => sum + n, 0);
}

/** Замеры храним в секундах — в них же считается ETA. */
export async function recordWait(waitMs: number): Promise<void> {
  await kv().lpush(K.queueStats(), String(Math.round(waitMs / 1000)));
  await kv().ltrim(K.queueStats(), 0, STATS_WINDOW - 1);
}

/** null — замеров меньше трёх: честнее не показывать число вовсе. */
export async function estimateEta(waitedSec: number): Promise<number | null> {
  const samples = await kv().lrange(K.queueStats(), 0, STATS_WINDOW - 1);
  const values = samples
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (values.length < MIN_SAMPLES) return null;

  const median = values[Math.floor(values.length / 2)];
  // Прождал больше медианы — остаток считаем по 75-му перцентилю.
  const p75 = values[Math.floor(values.length * 0.75)] ?? median;

  return Math.max(5, Math.ceil((waitedSec > median ? p75 : median) - waitedSec));
}

/**
 * Уборка заявок, переживших падение процесса. Возвращает число удалённых.
 *
 * Свежие заявки не трогаем: между записью в очередь и появлением присутствия
 * проходит несколько запросов, и уборщик, поспевший в эту щель, выкинул бы из
 * поиска живого игрока. Обломок падения по определению не свежий.
 */
export async function sweepStale(
  isOnline: (userId: string) => Promise<boolean>,
  minAgeMs = STALE_MIN_AGE_MS,
): Promise<number> {
  let removed = 0;
  const now = Date.now();

  for (const bucket of await activeBuckets()) {
    const ids = await kv().zrangebyscore(K.queue(bucket), -Infinity, Infinity);

    for (const userId of ids) {
      const entry = await readEntry(userId);

      // Заявка без меты — обломок: восстанавливать нечего, чистим сразу.
      if (!entry) {
        if ((await kv().zrem(K.queue(bucket), userId)) === 1) removed++;
        continue;
      }

      if (now - entry.joinedAt < minAgeMs) continue;
      if (await isOnline(userId)) continue;
      if (await dequeue(userId)) removed++;
    }
  }

  return removed;
}

/* ------------------------------------------------------------------ *
 * Внутреннее
 * ------------------------------------------------------------------ */

function toEntry(meta: Record<string, string>): QueueEntry {
  return {
    userId: meta.userId,
    nickname: meta.nickname ?? "",
    rating: Number(meta.rating ?? 0),
    characterId: meta.characterId ?? "",
    ...(meta.deckId ? { deckId: meta.deckId } : {}),
    connId: meta.connId ?? "",
    joinedAt: Number(meta.joinedAt ?? 0),
    ...(meta.lastOpponent ? { lastOpponent: meta.lastOpponent } : {}),
  };
}
