import type { PresenceStatus } from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";

/**
 * Присутствие живёт на TTL: если процесс умер жёстко, ключи истекут сами за
 * 45 секунд и друзья увидят «не в сети» без ручной уборки.
 */
export async function touch(
  userId: string,
  status: PresenceStatus,
): Promise<void> {
  await kv().set(K.presence(userId), status, { ex: TTL.PRESENCE_SEC });
}

export async function drop(userId: string): Promise<void> {
  await kv().del(K.presence(userId));
}

export async function read(userId: string): Promise<PresenceStatus> {
  return normalize(await kv().get(K.presence(userId)));
}

/** Один MGET на всех, а не N запросов — френд-панель обновляется часто. */
export async function readMany(
  userIds: string[],
): Promise<Map<string, PresenceStatus>> {
  const result = new Map<string, PresenceStatus>();
  if (!userIds.length) return result;

  const values = await kv().mget(userIds.map((id) => K.presence(id)));
  userIds.forEach((id, i) => result.set(id, normalize(values[i])));

  return result;
}

export async function isOnline(userId: string): Promise<boolean> {
  return (await read(userId)) !== "offline";
}

function normalize(raw: string | null): PresenceStatus {
  switch (raw) {
    case "online":
    case "in_lobby":
    case "in_match":
      return raw;
    default:
      return "offline";
  }
}
