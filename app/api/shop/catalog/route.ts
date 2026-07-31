import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { findUserByIdSafe } from "@/lib/models";
import { normalizeUser, toUserPublic } from "@/lib/schema";
import { BOOSTER_CATALOG } from "@/lib/shop/catalog";
import { grantStarterKit } from "@/lib/shop/models";

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let user = await findUserByIdSafe(session.userId);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!normalizeUser(user).starterGranted) {
    await grantStarterKit(user.userId);
    user = (await findUserByIdSafe(session.userId)) ?? user;
  }

  const n = normalizeUser(user);
  const today = new Date().toISOString().slice(0, 10);
  const dailyAvailable = n.lastDailyGrantAt !== today;
  return NextResponse.json({
    skus: BOOSTER_CATALOG,
    credits: n.credits,
    pity: n.legendaryPity,
    dailyAvailable,
    user: toUserPublic(n),
  });
}
