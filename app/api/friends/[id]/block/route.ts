import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { blockUserSafe } from "@/lib/models";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json(
      { error: "Нельзя заблокировать самого себя" },
      { status: 400 }
    );
  }

  await blockUserSafe(session.userId, id);
  return NextResponse.json({ ok: true, status: "blocked" });
}
