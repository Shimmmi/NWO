import { randomBytes } from "node:crypto";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";

/**
 * Одноразовые тикеты для WS-хендшейка (ЧАСТЬ 5.2 ТЗ) и resume-токены для
 * восстановления сессии (ЧАСТЬ 9.3). Сессионная кука httpOnly в этой схеме
 * не покидает HTTP-слой: в сокет уходит только сгорающий идентификатор.
 */
export interface TicketPayload {
  userId: string;
  nickname: string;
  rating: number;
  /** Unix-миллисекунды истечения сессии — сервер следит за ним по ходу матча. */
  expMs: number;
}

function token(): string {
  return randomBytes(24).toString("base64url");
}

export async function issueTicket(payload: TicketPayload): Promise<string> {
  const jti = token();
  await kv().set(K.ticket(jti), JSON.stringify(payload), {
    ex: TTL.TICKET_SEC,
  });
  return jti;
}

/** GETDEL: тикет сгорает при использовании, повторно предъявить его нельзя. */
export async function consumeTicket(
  jti: string,
): Promise<TicketPayload | null> {
  const raw = await kv().getdel(K.ticket(jti));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TicketPayload;
  } catch {
    return null;
  }
}

export async function issueResumeToken(userId: string): Promise<string> {
  const value = token();
  await kv().set(K.resume(value), userId, { ex: TTL.RESUME_SEC });
  return value;
}

/** Продлевает TTL при успешном чтении: активная сессия не должна истекать. */
export async function readResumeToken(
  value: string,
): Promise<string | null> {
  const userId = await kv().get(K.resume(value));
  if (!userId) return null;

  await kv().expire(K.resume(value), TTL.RESUME_SEC);
  return userId;
}

export async function dropResumeToken(value: string): Promise<void> {
  await kv().del(K.resume(value));
}
