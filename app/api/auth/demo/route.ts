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
    createdAt: now,
    updatedAt: now,
  };

  await createUserSafe(user);

  const token = createSession({
    userId: user.userId,
    email: user.email,
    nickname: user.nickname,
  });

  const response = NextResponse.json({ user: toUserPublic(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
