import {
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { COOKIE_PATH, SESSION_COOKIE, type SessionPayload } from "./auth-constants";

export { COOKIE_PATH, SESSION_COOKIE, type SessionPayload };

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "dev-secret-change-in-production-32b";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(check));
  } catch {
    return false;
  }
}

export function createSession(
  payload: Omit<SessionPayload, "nickname" | "exp"> & { nickname?: string }
): string {
  const data = JSON.stringify({
    ...payload,
    nickname: payload.nickname ?? "Player",
    exp: Date.now() + SESSION_TTL,
  });
  const sig = createHmac("sha256", AUTH_SECRET).update(data).digest("hex");
  return Buffer.from(`${data}.${sig}`).toString("base64url");
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    const data = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = createHmac("sha256", AUTH_SECRET).update(data).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(data) as SessionPayload & { exp: number };
    if (payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      nickname: payload.nickname,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    secure,
    maxAge: SESSION_TTL / 1000,
  };
}

export function generateGuestNickname(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Guest_${suffix}`;
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
