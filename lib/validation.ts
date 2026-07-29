import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().min(2).max(32),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createDeckSchema = z.object({
  name: z.string().min(1).max(64),
  characterId: z.string().min(1),
  /** Allow drafts (0–30); isValid is computed server-side via deck rules */
  cardIds: z.array(z.string()).max(30),
});

export const updateDeckSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  cardIds: z.array(z.string()).max(30).optional(),
});

export const createGameSchema = z.object({
  playerId: z.string().min(1),
  playerNickname: z.string().min(1),
  characterId: z.string().min(1),
  vsAi: z.boolean().default(true),
  opponentCharacterId: z.string().optional(),
  relicId: z.string().optional(),
});

export const playTurnSchema = z.object({
  playerId: z.string().min(1),
  cardIds: z.array(z.string()).max(5),
});

export const gameActionSchema = z.discriminatedUnion("action", [
  z.object({
    playerId: z.string().min(1),
    action: z.literal("play"),
    cardId: z.string().min(1),
  }),
  z.object({
    playerId: z.string().min(1),
    action: z.literal("submit_card"),
    cardId: z.string().min(1),
  }),
  z.object({
    playerId: z.string().min(1),
    action: z.literal("pass"),
  }),
  z.object({
    playerId: z.string().min(1),
    action: z.literal("use_ability"),
    abilityId: z.string().min(1),
  }),
  z.object({
    playerId: z.string().min(1),
    action: z.literal("pass_ability"),
  }),
]);
