import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getFriendEdgeSafe, removeFriendSafe } from "@/lib/models";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Одна операция на три смысла: отклонить входящую, отменить исходящую,
 * удалить друга. Различает их текущий статус ребра — клиенту незачем это знать.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const edge = await getFriendEdgeSafe(session.userId, id);
  if (!edge) {
    return NextResponse.json({ error: "Связь не найдена" }, { status: 404 });
  }

  await removeFriendSafe(session.userId, id);
  return NextResponse.json({ ok: true, was: edge.status });
}
