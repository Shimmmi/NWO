import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { findUserByIdSafe } from "@/lib/models";
import { buildError } from "@/lib/net/errors";
import { issueTicket } from "@/lib/redis/ticket-store";

/**
 * Обмен httpOnly-куки на одноразовый тикет для WS-хендшейка (ЧАСТЬ 5.2 ТЗ).
 * Сама кука в JavaScript и в DOM не попадает никогда.
 */
export async function POST() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json(buildError("AUTH_REQUIRED"), { status: 401 });
  }

  const user = await findUserByIdSafe(session.userId);

  // Ник и рейтинг проставляет сервер: клиент не должен иметь возможности
  // представиться кем-то другим при постановке в очередь.
  const ticket = await issueTicket({
    userId: session.userId,
    nickname: user?.nickname ?? session.nickname,
    rating: user?.rating ?? 1000,
    expMs: session.exp,
  });

  return NextResponse.json({ ticket });
}
