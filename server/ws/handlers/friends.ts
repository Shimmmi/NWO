import { ProtocolError } from "@/lib/net/errors";
import { logError } from "@/lib/net/log";
import type { ClientPayload, PresenceStatus } from "@/lib/net/protocol";
import * as presence from "@/lib/redis/presence-store";
import {
  acceptedFriendIds,
  buildInvite,
  presenceSnapshot,
  respondToInvite,
} from "@/server/ws/handlers/social";
import { onJoinLobby } from "@/server/ws/handlers/lobby";
import { registry, type Conn } from "@/server/ws/registry";

/* ------------------------------------------------------------------ *
 * Приглашения в лобби
 * ------------------------------------------------------------------ */

export async function onInviteFriend(
  conn: Conn,
  payload: ClientPayload<"invite_friend">,
): Promise<void> {
  if (conn.scope.kind !== "lobby") throw new ProtocolError("LOBBY_NOT_FOUND");

  const { code } = conn.scope;
  const from = {
    userId: conn.userId,
    nickname: conn.nickname,
    rating: conn.rating,
  };

  const { inviteId, expiresAt } = await buildInvite(from, payload.friendId, code);

  registry.sendTo(payload.friendId, "friend_invite", {
    inviteId,
    from,
    code,
    expiresAt,
  });
}

export async function onInviteRespond(
  conn: Conn,
  payload: ClientPayload<"invite_respond">,
): Promise<void> {
  const result = await respondToInvite(
    payload.inviteId,
    conn.userId,
    payload.accept,
  );

  if (!payload.accept || !result) return;

  // Принятие приглашения — это тот же вход в комнату, включая все его проверки.
  await onJoinLobby(conn, { code: result.code });
}

/* ------------------------------------------------------------------ *
 * Присутствие
 * ------------------------------------------------------------------ */

export async function onSubscribePresence(conn: Conn): Promise<void> {
  conn.presenceSubscribed = true;

  const friends = await acceptedFriendIds(conn.userId);
  if (!friends.length) return;

  registry.send(conn, "presence_update", await presenceSnapshot(friends));
}

/**
 * Рассылка своего статуса подписанным друзьям. Вызывается при входе, смене
 * экрана и разрыве связи — френд-панель не опрашивает сервер поллингом.
 */
export async function announcePresence(
  userId: string,
  status: PresenceStatus,
): Promise<void> {
  try {
    if (status === "offline") await presence.drop(userId);
    else await presence.touch(userId, status);

    const friends = await acceptedFriendIds(userId);
    const update = [{ userId, status }];

    for (const friendId of friends) {
      const conn = registry.forUser(friendId);
      if (conn?.presenceSubscribed) {
        registry.send(conn, "presence_update", update);
      }
    }
  } catch (err) {
    // Френд-панель — не критичный путь: её сбой не должен ломать вход в игру.
    logError("friends", err);
  }
}
