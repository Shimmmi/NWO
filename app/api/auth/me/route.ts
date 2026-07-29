import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { findUserByIdSafe } from "@/lib/models";
import { normalizeUser, toUserPublic } from "@/lib/schema";
import { grantStarterKit } from "@/lib/shop/models";

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  let user = await findUserByIdSafe(session.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const n = normalizeUser(user);
  if (!n.starterGranted) {
    await grantStarterKit(user.userId);
    user = (await findUserByIdSafe(session.userId)) ?? {
      ...n,
      starterGranted: true,
    };
  }

  return NextResponse.json({ user: toUserPublic(user) });
}
