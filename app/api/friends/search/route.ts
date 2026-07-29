import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  listFriendsSafe,
  searchUsersByNicknameSafe,
  SEARCH_MAX_RESULTS,
  SEARCH_MIN_CHARS,
} from "@/lib/models";
import type { FriendStatus } from "@/lib/schema";

type Relation = "none" | FriendStatus;

export async function GET(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < SEARCH_MIN_CHARS) {
    return NextResponse.json({
      results: [],
      error: `Введите минимум ${SEARCH_MIN_CHARS} символа`,
    });
  }

  const [found, edges] = await Promise.all([
    searchUsersByNicknameSafe(query, SEARCH_MAX_RESULTS),
    listFriendsSafe(session.userId),
  ]);

  const relations = new Map<string, Relation>(
    edges.map((e) => [e.friendId, e.status])
  );

  // Email в поиске не отдаём: ник ищут по нику, почта тут ни при чём.
  const results = found
    .filter((user) => user.userId !== session.userId)
    .map((user) => ({
      userId: user.userId,
      nickname: user.nickname,
      rating: user.rating,
      level: user.level,
      relation: relations.get(user.userId) ?? "none",
    }));

  return NextResponse.json({ results });
}
