import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { findUserByIdSafe } from "@/lib/models";
import { normalizeUser, toUserPublic } from "@/lib/schema";
import { ECONOMY } from "@/lib/shop/economy";
import {
  adjustCredits,
  updateUserEconomySafe,
  writeLedger,
} from "@/lib/shop/models";

export async function POST() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await findUserByIdSafe(session.userId);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const n = normalizeUser(user);
  const today = new Date().toISOString().slice(0, 10);
  if (n.lastDailyGrantAt === today) {
    return NextResponse.json({
      credits: n.credits,
      granted: false,
      error: "daily_already_claimed",
      user: toUserPublic(n),
    });
  }

  const credits = await adjustCredits(
    session.userId,
    ECONOMY.DAILY_GRANT_CREDITS,
    { requireNonNegative: false },
  );
  await updateUserEconomySafe(session.userId, { lastDailyGrantAt: today });
  await writeLedger(
    session.userId,
    "daily_grant",
    ECONOMY.DAILY_GRANT_CREDITS,
  );

  const fresh = (await findUserByIdSafe(session.userId)) ?? {
    ...n,
    credits,
    lastDailyGrantAt: today,
  };

  return NextResponse.json({
    credits: normalizeUser(fresh).credits,
    granted: true,
    user: toUserPublic(fresh),
  });
}
