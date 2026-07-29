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

export interface UserPublic {
  userId: string;
  nickname: string;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  isGuest: boolean;
}

export function toUserPublic(user: UserRecord): UserPublic {
  return {
    userId: user.userId,
    nickname: user.nickname,
    email: user.email,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    level: user.level,
    xp: user.xp,
    isGuest: user.isGuest,
  };
}
