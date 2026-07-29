import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionPayload } from "@/lib/auth";
import {
  findUserByIdSafe,
  findUsersByIdsSafe,
  getFriendEdgeSafe,
  listFriendsSafe,
  sendFriendRequestSafe,
} from "@/lib/models";
import type { PresenceStatus } from "@/lib/net/protocol";
import { readMany } from "@/lib/redis/presence-store";
import type { FriendRecord, UserRecord } from "@/lib/schema";
import { evaluateFriendRequest } from "@/lib/social/friend-rules";

const sendRequestSchema = z.object({ friendId: z.string().min(1).max(64) });

function canInvite(status: PresenceStatus): boolean {
  return status === "online" || status === "in_lobby";
}

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const edges = await listFriendsSafe(session.userId);
  const accepted = edges.filter((e) => e.status === "accepted");
  const incomingEdges = edges.filter((e) => e.status === "pending_in");
  const outgoingEdges = edges.filter((e) => e.status === "pending_out");

  // Один BatchGet на всех и один MGET presence — вместо запроса на каждую строку.
  const users = await findUsersByIdsSafe(
    [...accepted, ...incomingEdges, ...outgoingEdges].map((e) => e.friendId)
  );
  const byId = new Map<string, UserRecord>(users.map((u) => [u.userId, u]));
  const presence = await readMany(accepted.map((e) => e.friendId));

  const nicknameOf = (edge: FriendRecord) =>
    byId.get(edge.friendId)?.nickname ?? edge.friendNickname;
  const ratingOf = (edge: FriendRecord) => byId.get(edge.friendId)?.rating ?? 0;

  return NextResponse.json({
    friends: accepted.map((edge) => {
      const status = presence.get(edge.friendId) ?? "offline";
      return {
        userId: edge.friendId,
        nickname: nicknameOf(edge),
        rating: ratingOf(edge),
        status,
        canInvite: canInvite(status),
      };
    }),
    incoming: incomingEdges.map((edge) => ({
      userId: edge.friendId,
      nickname: nicknameOf(edge),
      rating: ratingOf(edge),
      createdAt: edge.createdAt,
    })),
    outgoing: outgoingEdges.map((edge) => ({
      userId: edge.friendId,
      nickname: nicknameOf(edge),
      rating: ratingOf(edge),
      createdAt: edge.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const parsed = sendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Не указан игрок, которого нужно добавить" },
      { status: 400 }
    );
  }

  const { friendId } = parsed.data;
  const me = await findUserByIdSafe(session.userId);
  if (!me) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
  }

  const [target, myEdges, theirEdge] = await Promise.all([
    findUserByIdSafe(friendId),
    listFriendsSafe(session.userId),
    getFriendEdgeSafe(friendId, session.userId),
  ]);

  const decision = evaluateFriendRequest({
    me,
    targetId: friendId,
    target,
    myEdges,
    theirEdge,
  });

  if (decision.kind === "reject") {
    return NextResponse.json(
      { error: decision.error },
      { status: decision.httpStatus }
    );
  }
  if (decision.kind === "noop") {
    return NextResponse.json({ ok: true, status: decision.status });
  }

  await sendFriendRequestSafe(me, decision.target);
  return NextResponse.json({ ok: true, status: "pending_out" });
}
