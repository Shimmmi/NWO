import Redis from "ioredis";
import { log, warn } from "@/lib/net/log";
import { SCRIPTS, type ScriptName } from "@/lib/redis/scripts";

/**
 * Узкий фасад над Redis. Ровно те операции, которые нужны сторам.
 *
 * Инвариант 4 из ТЗ: отсутствие Redis не роняет процесс. MemoryKV реализует
 * тот же интерфейс, поэтому `npm run dev` без Redis работает полностью.
 */
export interface KV {
  isReady(): boolean;
  backend(): "redis" | "memory";

  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number; nx?: boolean },
  ): Promise<boolean>;
  getdel(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, seconds: number): Promise<void>;
  incr(key: string): Promise<number>;
  incrby(key: string, by: number): Promise<number>;
  mget(keys: string[]): Promise<(string | null)[]>;

  hset(key: string, values: Record<string, string | number>): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;

  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zrangebyscore(
    key: string,
    min: number,
    max: number,
    limit?: number,
  ): Promise<string[]>;
  zcard(key: string): Promise<number>;

  sadd(key: string, ...members: string[]): Promise<void>;
  srem(key: string, ...members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  scard(key: string): Promise<number>;

  lpush(key: string, value: string): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;

  script(name: ScriptName, keys: string[], args: string[]): Promise<unknown>;

  dbsize(): Promise<number>;
  quit(): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * Redis-бэкенд
 * ------------------------------------------------------------------ */

type ScriptedRedis = Redis & Record<string, (...a: unknown[]) => Promise<unknown>>;

class RedisKV implements KV {
  private ready = false;
  /** Соединение оборвалось или не установилось — только тогда уходим в память. */
  private failed = false;

  constructor(private readonly client: Redis) {
    for (const [name, def] of Object.entries(SCRIPTS)) {
      client.defineCommand(name, {
        numberOfKeys: def.numberOfKeys,
        lua: def.lua,
      });
    }
    client.on("ready", () => {
      this.ready = true;
      this.failed = false;
      log({ evt: "redis.ready" });
    });
    client.on("end", () => {
      this.ready = false;
    });
    client.on("error", (e: Error) => {
      if (this.ready) log({ evt: "redis.degraded", error: e.message });
      this.ready = false;
      this.failed = true;
    });
  }

  isReady() {
    return this.ready && this.client.status === "ready";
  }

  /**
   * Пока соединение только устанавливается, ioredis сам придерживает команды и
   * выполнит их после ready. Подменять его памятью в этом окне нельзя: первые
   * секунды жизни процесса писались бы мимо общего хранилища и пропали бы.
   */
  isUsable() {
    return !this.failed && this.client.status !== "end";
  }
  backend() {
    // Оборванное соединение — это работа на памяти, как бы ни звался бэкенд.
    return this.isUsable() ? ("redis" as const) : ("memory" as const);
  }

  get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    let res: string | null;
    if (opts?.ex !== undefined && opts.nx) {
      res = await this.client.set(key, value, "EX", opts.ex, "NX");
    } else if (opts?.ex !== undefined) {
      res = await this.client.set(key, value, "EX", opts.ex);
    } else if (opts?.nx) {
      res = await this.client.set(key, value, "NX");
    } else {
      res = await this.client.set(key, value);
    }
    return res === "OK";
  }

  async getdel(key: string) {
    // GETDEL появился в Redis 6.2; на всякий случай — фолбэк транзакцией.
    try {
      return await this.client.getdel(key);
    } catch {
      const [[, value]] = (await this.client
        .multi()
        .get(key)
        .del(key)
        .exec()) as [[Error | null, string | null], unknown];
      return value ?? null;
    }
  }

  del(...keys: string[]) {
    return keys.length ? this.client.del(...keys) : Promise.resolve(0);
  }

  async exists(key: string) {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, seconds: number) {
    await this.client.expire(key, seconds);
  }

  incr(key: string) {
    return this.client.incr(key);
  }

  incrby(key: string, by: number) {
    return this.client.incrby(key, by);
  }

  mget(keys: string[]) {
    return keys.length ? this.client.mget(keys) : Promise.resolve([]);
  }

  async hset(key: string, values: Record<string, string | number>) {
    await this.client.hset(key, values);
  }

  hget(key: string, field: string) {
    return this.client.hget(key, field);
  }

  hgetall(key: string) {
    return this.client.hgetall(key);
  }

  async zadd(key: string, score: number, member: string) {
    await this.client.zadd(key, score, member);
  }

  zrem(key: string, ...members: string[]) {
    return members.length
      ? this.client.zrem(key, ...members)
      : Promise.resolve(0);
  }

  zrangebyscore(key: string, min: number, max: number, limit?: number) {
    const lo = Number.isFinite(min) ? String(min) : "-inf";
    const hi = Number.isFinite(max) ? String(max) : "+inf";
    return limit === undefined
      ? this.client.zrangebyscore(key, lo, hi)
      : this.client.zrangebyscore(key, lo, hi, "LIMIT", 0, limit);
  }

  zcard(key: string) {
    return this.client.zcard(key);
  }

  async sadd(key: string, ...members: string[]) {
    if (members.length) await this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]) {
    if (members.length) await this.client.srem(key, ...members);
  }

  smembers(key: string) {
    return this.client.smembers(key);
  }

  scard(key: string) {
    return this.client.scard(key);
  }

  async lpush(key: string, value: string) {
    await this.client.lpush(key, value);
  }

  async ltrim(key: string, start: number, stop: number) {
    await this.client.ltrim(key, start, stop);
  }

  lrange(key: string, start: number, stop: number) {
    return this.client.lrange(key, start, stop);
  }

  script(name: ScriptName, keys: string[], args: string[]) {
    const scripted = this.client as ScriptedRedis;
    return scripted[name](...keys, ...args);
  }

  dbsize() {
    return this.client.dbsize();
  }

  async quit() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

/* ------------------------------------------------------------------ *
 * Память — полноценный фолбэк для dev и для деградации
 * ------------------------------------------------------------------ */

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

class MemoryKV implements KV {
  private store = new Map<string, Entry>();

  isReady() {
    return true;
  }
  backend() {
    return "memory" as const;
  }

  private read<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private write(key: string, value: unknown, ex?: number): void {
    const prev = this.store.get(key);
    const expiresAt =
      ex !== undefined
        ? Date.now() + ex * 1000
        : (prev?.expiresAt ?? null);
    this.store.set(key, { value, expiresAt });
  }

  private ensure<T>(key: string, make: () => T): T {
    const existing = this.read<T>(key);
    if (existing !== undefined) return existing;
    const created = make();
    this.store.set(key, { value: created, expiresAt: null });
    return created;
  }

  async get(key: string) {
    return this.read<string>(key) ?? null;
  }

  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    if (opts?.nx && this.read(key) !== undefined) return false;
    // NX-запись всегда ставит свой TTL, а не наследует чужой.
    this.store.set(key, {
      value,
      expiresAt: opts?.ex !== undefined ? Date.now() + opts.ex * 1000 : null,
    });
    return true;
  }

  async getdel(key: string) {
    const value = this.read<string>(key) ?? null;
    this.store.delete(key);
    return value;
  }

  async del(...keys: string[]) {
    let n = 0;
    for (const key of keys) if (this.store.delete(key)) n++;
    return n;
  }

  async exists(key: string) {
    return this.read(key) !== undefined;
  }

  async expire(key: string, seconds: number) {
    const entry = this.store.get(key);
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
  }

  async incr(key: string) {
    return this.incrby(key, 1);
  }

  async incrby(key: string, by: number) {
    const next = Number(this.read<string>(key) ?? "0") + by;
    this.write(key, String(next));
    return next;
  }

  async mget(keys: string[]) {
    return keys.map((k) => this.read<string>(k) ?? null);
  }

  async hset(key: string, values: Record<string, string | number>) {
    const hash = this.ensure(key, () => new Map<string, string>());
    for (const [f, v] of Object.entries(values)) hash.set(f, String(v));
  }

  async hget(key: string, field: string) {
    return this.read<Map<string, string>>(key)?.get(field) ?? null;
  }

  async hgetall(key: string) {
    const hash = this.read<Map<string, string>>(key);
    return hash ? Object.fromEntries(hash) : {};
  }

  async zadd(key: string, score: number, member: string) {
    this.ensure(key, () => new Map<string, number>()).set(member, score);
  }

  async zrem(key: string, ...members: string[]) {
    const zset = this.read<Map<string, number>>(key);
    if (!zset) return 0;
    let n = 0;
    for (const m of members) if (zset.delete(m)) n++;
    return n;
  }

  async zrangebyscore(key: string, min: number, max: number, limit?: number) {
    const zset = this.read<Map<string, number>>(key);
    if (!zset) return [];
    const sorted = [...zset.entries()]
      .filter(([, s]) => s >= min && s <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([m]) => m);
    return limit === undefined ? sorted : sorted.slice(0, limit);
  }

  async zcard(key: string) {
    return this.read<Map<string, number>>(key)?.size ?? 0;
  }

  async sadd(key: string, ...members: string[]) {
    const set = this.ensure(key, () => new Set<string>());
    for (const m of members) set.add(m);
  }

  async srem(key: string, ...members: string[]) {
    const set = this.read<Set<string>>(key);
    if (set) for (const m of members) set.delete(m);
  }

  async smembers(key: string) {
    return [...(this.read<Set<string>>(key) ?? [])];
  }

  async scard(key: string) {
    return this.read<Set<string>>(key)?.size ?? 0;
  }

  async lpush(key: string, value: string) {
    this.ensure(key, () => [] as string[]).unshift(value);
  }

  async ltrim(key: string, start: number, stop: number) {
    const list = this.read<string[]>(key);
    if (list) this.store.set(key, { value: list.slice(start, stop + 1), expiresAt: null });
  }

  async lrange(key: string, start: number, stop: number) {
    const list = this.read<string[]>(key) ?? [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async script(name: ScriptName, keys: string[], args: string[]) {
    switch (name) {
      case "casMatch": {
        const current = Number(this.read<string>(keys[1]) ?? "0");
        if (current !== Number(args[0])) return 0;
        const ttl = Number(args[2]);
        await this.set(keys[0], args[1], { ex: ttl });
        await this.set(keys[1], String(current + 1), { ex: ttl });
        return 1;
      }
      case "joinLobby": {
        const hash = this.read<Map<string, string>>(keys[0]);
        if (!hash) return [-1];
        const host = hash.get("hostId") ?? "";
        if (host === args[0]) return [-3, host];
        const guest = hash.get("guestId");
        if (guest) return [-2];
        hash.set("guestId", args[0]);
        hash.set("guestNick", args[1]);
        hash.set("guestRating", args[2]);
        hash.set("guestChar", args[3]);
        hash.set("guestConn", args[4]);
        hash.set("guestReady", "0");
        return [1, host];
      }
    }
  }

  async dbsize() {
    let n = 0;
    for (const key of this.store.keys()) if (this.read(key) !== undefined) n++;
    return n;
  }

  async quit() {
    this.store.clear();
  }
}

/* ------------------------------------------------------------------ *
 * Выбор бэкенда
 * ------------------------------------------------------------------ */

let instance: KV | null = null;
let redisKv: RedisKV | null = null;
const memoryKv = new MemoryKV();

export function kv(): KV {
  if (instance) {
    // Redis отвалился — прозрачно уходим в память, не роняя процесс.
    if (redisKv && !redisKv.isUsable()) return memoryKv;
    return instance;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    warn("redis", "REDIS_URL не задан — работаем на in-memory сторе");
    instance = memoryKv;
    return instance;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times: number) => Math.min(times * 200, 3000),
  });

  redisKv = new RedisKV(client);
  instance = withMemoryFallback(redisKv, memoryKv);
  return instance;
}

/**
 * Команда, отправленная до того, как процесс узнал о падении Redis, обязана
 * доиграть в памяти: узнаём мы об обрыве из события, а оно приходит уже после
 * отправки. Дальше подмену делает сам kv() — сюда попадают только эти гонки.
 */
function withMemoryFallback(redis: RedisKV, memory: KV): KV {
  return new Proxy(redis, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const call = value as (...a: unknown[]) => unknown;
        const spare = (memory as unknown as Record<string, typeof call>)[
          prop as string
        ];

        try {
          const result = call.apply(target, args);
          if (!(result instanceof Promise) || !spare) return result;

          return result.catch((err: unknown) => {
            if (target.isUsable()) throw err;
            return spare.apply(memory, args);
          });
        } catch (err) {
          if (!spare || target.isUsable()) throw err;
          return spare.apply(memory, args);
        }
      };
    },
  }) as KV;
}

/** true, если работаем не на настоящем Redis. Для /api/health. */
export function isDegraded(): boolean {
  return kv().backend() === "memory";
}

export async function closeKv(): Promise<void> {
  if (redisKv) await redisKv.quit();
  instance = null;
  redisKv = null;
}
