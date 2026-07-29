import { NextResponse } from "next/server";
import {
  createSession,
  generateId,
  hashPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { createUserSafe, findUserByEmailSafe, findUserByIdSafe } from "@/lib/models";
import { toUserPublic, type UserRecord } from "@/lib/schema";
import { ECONOMY } from "@/lib/shop/economy";
import { grantStarterKit } from "@/lib/shop/models";
import { economyDefaults } from "@/lib/shop/userDefaults";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, password, nickname } = parsed.data;

  const existing = await findUserByEmailSafe(email);
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const user: UserRecord = {
    userId: generateId("user"),
    email,
    nickname,
    passwordHash: await hashPassword(password),
    isGuest: false,
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
  const fresh =
    (await findUserByIdSafe(user.userId)) ?? {
      ...user,
      starterGranted: true,
      credits: ECONOMY.STARTING_CREDITS,
    };

  const token = createSession({
    userId: user.userId,
    email: user.email,
    nickname: user.nickname,
  });

  const response = NextResponse.json(
    { user: toUserPublic(fresh) },
    { status: 201 },
  );
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
