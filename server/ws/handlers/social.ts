import { getFriendEdgeSafe, listFriendsSafe } from "@/lib/models";
import { ProtocolError } from "@/lib/net/errors";
import type { PlayerBrief, PresenceStatus } from "@/lib/net/protocol";
import { readMany } from "@/lib/redis/presence-store";
import { createInvite, consumeInvite, markDeclined } from "@/lib/social/invites";

/**
 * Здесь только чистые функции: реестр сокетов не импортируется намеренно,
 * чтобы рассылку мог делать любой владелец соединений.
 */

const FRIEND_CACHE_TTL_MS = 60_000;

interface CacheEntry {
  ids: string[];
  expiresAt: number;
}

const friendCache = new Map<string, CacheEntry>();

/** Список userId принятых друзей. Кешируется на 60 секунд — иначе каждый вход-выход бьёт в DynamoDB. */
export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const cached = friendCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;

  const edges = await listFriendsSafe(userId);
  const ids = edges
    .filter((edge) => edge.status === "accepted")
    .map((edge) => edge.friendId);

  friendCache.set(userId, { ids, expiresAt: Date.now() + FRIEND_CACHE_TTL_MS });
  return ids;
}

export function invalidateFriendCache(userId: string): void {
  friendCache.delete(userId);
}

export async function buildInvite(
  from: PlayerBrief,
  toUserId: string,
  code: string
): Promise<{ inviteId: string; expiresAt: number }> {
  const presence = await readMany([toUserId]);
  if ((presence.get(toUserId) ?? "offline") === "offline") {
    const edge = await getFriendEdgeSafe(from.userId, toUserId);
    throw new ProtocolError("FRIEND_OFFLINE", {
      nickname: edge?.friendNickname ?? "",
    });
  }

  const invite = await createInvite(from, toUserId, code);
  return { inviteId: invite.inviteId, expiresAt: invite.expiresAt };
}

/** При отказе возвращает null: звать в лобби некого, но кулдаун уже поставлен. */
export async function respondToInvite(
  inviteId: string,
  byUserId: string,
  accept: boolean
): Promise<{ code: string } | null> {
  if (!accept) {
    await markDeclined(inviteId);
    return null;
  }

  const invite = await consumeInvite(inviteId, byUserId);
  return invite ? { code: invite.code } : null;
}

export async function presenceSnapshot(
  userIds: string[]
): Promise<{ userId: string; status: PresenceStatus }[]> {
  const statuses = await readMany(userIds);
  return userIds.map((userId) => ({
    userId,
    status: statuses.get(userId) ?? "offline",
  }));
}
