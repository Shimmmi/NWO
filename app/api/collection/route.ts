import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { listCollectionSafe, grantStarterKit } from "@/lib/shop/models";
import { findUserByIdSafe } from "@/lib/models";
import { normalizeUser } from "@/lib/schema";

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await findUserByIdSafe(session.userId);
  if (user && !normalizeUser(user).starterGranted) {
    await grantStarterKit(session.userId);
  }

  const items = await listCollectionSafe(session.userId);
  return NextResponse.json({ items });
}
