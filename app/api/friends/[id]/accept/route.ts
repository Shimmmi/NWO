import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { acceptFriendRequestSafe, getFriendEdgeSafe } from "@/lib/models";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const edge = await getFriendEdgeSafe(session.userId, id);

  if (!edge) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  // Повторное «Принять» по уже принятой заявке — не ошибка, кнопка могла залипнуть.
  if (edge.status === "accepted") {
    return NextResponse.json({ ok: true, status: "accepted" });
  }
  if (edge.status !== "pending_in") {
    return NextResponse.json(
      { error: "Эту заявку нельзя принять" },
      { status: 409 }
    );
  }

  await acceptFriendRequestSafe(session.userId, id);
  return NextResponse.json({ ok: true, status: "accepted" });
}
