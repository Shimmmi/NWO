import type { MatchStatus } from "@/lib/game/types";

export interface UserRecord {
  userId: string;
  email: string;
  nickname: string;
  passwordHash: string;
  isGuest: boolean;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  /** Soft currency — единственная валюта магазина. */
  credits: number;
  /** Packs opened since last legendary (elite slot). */
  legendaryPity: number;
  /** Starter kit already granted. */
  starterGranted?: boolean;
  /** ISO date YYYY-MM-DD of last daily credit grant. */
  lastDailyGrantAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchRecord {
  matchId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: MatchStatus;
  characterP1: string;
  characterP2: string;
  turnsPlayed: number;
  startedAt: string;
  finishedAt: string | null;
  createdAt?: string;
}

export interface DeckRecord {
  deckId: string;
  userId: string;
  name: string;
  characterId: string;
  cardIds: string[];
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FriendStatus = "pending_out" | "pending_in" | "accepted" | "blocked";

export interface FriendRecord {
  /** PK — владелец записи */
  userId: string;
  /** SK — вторая сторона */
  friendId: string;
  status: FriendStatus;
  /** Денормализация: чтобы не делать N запросов к users при отрисовке списка */
  friendNickname: string;
  createdAt: string;
  updatedAt: string;
}

/** PK userId, SK cardId */
export interface CollectionItem {
  userId: string;
  cardId: string;
  count: number;
  firstObtainedAt: string;
  updatedAt: string;
}

/** Unopened packs — PK userId, SK packInstanceId */
export interface PackInventoryItem {
  userId: string;
  packInstanceId: string;
  skuId: string;
  source: "purchase" | "level_up" | "starter" | "admin";
  createdAt: string;
}

export type EconomyLedgerKind =
  | "match_reward"
  | "level_up"
  | "daily_grant"
  | "pack_purchase"
  | "pack_open"
  | "craft"
  | "starter";

export interface EconomyLedgerEntry {
  userId: string;
  entryId: string;
  kind: EconomyLedgerKind;
  deltaCredits?: number;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface UserPublic {
  userId: string;
  nickname: string;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  credits: number;
  isGuest: boolean;
}

/** Normalize legacy users missing economy fields. */
export function normalizeUser(user: UserRecord): UserRecord {
  return {
    ...user,
    credits: user.credits ?? 0,
    legendaryPity: user.legendaryPity ?? 0,
    starterGranted: user.starterGranted ?? false,
  };
}

export function toUserPublic(user: UserRecord): UserPublic {
  const n = normalizeUser(user);
  return {
    userId: n.userId,
    nickname: n.nickname,
    email: n.email,
    rating: n.rating,
    wins: n.wins,
    losses: n.losses,
    level: n.level,
    xp: n.xp,
    credits: n.credits,
    isGuest: n.isGuest,
  };
}
