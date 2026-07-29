import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { listPacks } from "@/lib/shop/models";

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const packs = await listPacks(session.userId);
  return NextResponse.json({ packs });
}
