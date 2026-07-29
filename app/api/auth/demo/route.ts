import { NextResponse } from "next/server";
import {
  createSession,
  generateGuestNickname,
  generateId,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { createUserSafe } from "@/lib/models";
import { toUserPublic, type UserRecord } from "@/lib/schema";
import { grantStarterKit } from "@/lib/shop/models";
import { ECONOMY } from "@/lib/shop/economy";
import { economyDefaults } from "@/lib/shop/userDefaults";

export async function POST() {
  const now = new Date().toISOString();
  const userId = generateId("guest");
  const nickname = generateGuestNickname();

  const user: UserRecord = {
    userId,
    email: `${userId}@guest.local`,
    nickname,
    passwordHash: "",
    isGuest: true,
    rating: 1000,
    wins: 0,
    losses: 0,
    level: 1,
    xp: 0,
    ...economyDefaults(),
    createdAt: now,
    updatedAt: now,
  };

  await createUserSafe(user);
  await grantStarterKit(user.userId);
  const fresh = {
    ...user,
    starterGranted: true,
    credits: ECONOMY.STARTING_CREDITS,
  };

  const token = createSession({
    userId: user.userId,
    email: user.email,
    nickname: user.nickname,
  });

  const response = NextResponse.json({ user: toUserPublic(fresh) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
