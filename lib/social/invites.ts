import { generateId } from "@/lib/auth";
import { ProtocolError } from "@/lib/net/errors";
import type { PlayerBrief } from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";

export interface LobbyInvite {
  inviteId: string;
  code: string;
  fromUserId: string;
  fromNickname: string;
  toUserId: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Приглашение живёт только на TTL: если хост ушёл, не дождавшись ответа,
 * запись истечёт сама и «Принять» в тосте перестанет что-либо делать.
 */
export async function createInvite(
  from: PlayerBrief,
  toUserId: string,
  code: string
): Promise<LobbyInvite> {
  if (await kv().exists(K.inviteCooldown(from.userId, toUserId))) {
    throw new ProtocolError("ILLEGAL_ACTION");
  }
  if (await kv().exists(K.invitePair(from.userId, toUserId))) {
    throw new ProtocolError("ILLEGAL_ACTION");
  }

  const createdAt = Date.now();
  const invite: LobbyInvite = {
    inviteId: generateId("inv"),
    code,
    fromUserId: from.userId,
    fromNickname: from.nickname,
    toUserId,
    createdAt,
    expiresAt: createdAt + TTL.INVITE_SEC * 1000,
  };

  await kv().set(K.invite(invite.inviteId), JSON.stringify(invite), {
    ex: TTL.INVITE_SEC,
  });
  await kv().set(K.invitePair(from.userId, toUserId), invite.inviteId, {
    ex: TTL.INVITE_SEC,
  });

  return invite;
}

export async function readInvite(inviteId: string): Promise<LobbyInvite | null> {
  return parse(await kv().get(K.invite(inviteId)));
}

/** Возвращает приглашение только адресату и только один раз. */
export async function consumeInvite(
  inviteId: string,
  byUserId: string
): Promise<LobbyInvite | null> {
  const invite = await readInvite(inviteId);
  if (!invite || invite.toUserId !== byUserId) return null;

  await kv().del(
    K.invite(inviteId),
    K.invitePair(invite.fromUserId, invite.toUserId)
  );
  return invite;
}

/** Отказ ставит кулдаун — иначе отклонённого можно звать бесконечно. */
export async function markDeclined(inviteId: string): Promise<void> {
  const invite = await readInvite(inviteId);
  if (!invite) return;

  await kv().del(
    K.invite(inviteId),
    K.invitePair(invite.fromUserId, invite.toUserId)
  );
  await kv().set(K.inviteCooldown(invite.fromUserId, invite.toUserId), "1", {
    ex: TTL.INVITE_COOLDOWN_SEC,
  });
}

function parse(raw: string | null): LobbyInvite | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LobbyInvite;
  } catch {
    return null;
  }
}
