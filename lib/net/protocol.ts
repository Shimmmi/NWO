import { z } from "zod";
import { errorSchema } from "@/lib/net/errors";
import type {
  AbilityCard,
  ActiveEffect,
  CombatEvent,
  GamePhase,
  MatchPlayer,
  MatchStatus,
  PlayedCard,
  RoundEvent,
  TurnRecord,
  TurnResolution,
} from "@/lib/game/types";

export const PROTOCOL_VERSION = 2;

/* ------------------------------------------------------------------ *
 * Конверт
 * ------------------------------------------------------------------ */

export const envelopeSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  /** Уникальный id кадра. Клиент → сервер: для ack и идемпотентности. */
  id: z.string().min(1).max(64),
  /** Монотонный счётчик отправителя. Разрыв = запросить снапшот. */
  seq: z.number().int().nonnegative(),
  type: z.string().min(1).max(48),
  ts: z.number().int(),
  payload: z.unknown(),
});

export interface Envelope<T = unknown> {
  v: typeof PROTOCOL_VERSION;
  id: string;
  seq: number;
  type: string;
  ts: number;
  payload: T;
}

/* ------------------------------------------------------------------ *
 * Игровые сущности. Аннотации z.ZodType<T> держат схемы в синхроне
 * с lib/game/types.ts — расхождение падает на компиляции.
 * ------------------------------------------------------------------ */

const gamePhaseSchema: z.ZodType<GamePhase> = z.enum([
  "energy_recovery",
  "card_draw",
  "ability",
  "battle",
  "end_turn",
]);

const matchStatusSchema: z.ZodType<MatchStatus> = z.enum([
  "waiting",
  "in_progress",
  "finished",
]);

const playerNumSchema = z.union([z.literal(1), z.literal(2)]);
export type PlayerNum = z.infer<typeof playerNumSchema>;

const abilityCardSchema: z.ZodType<AbilityCard> = z.object({
  id: z.string(),
  name: z.string(),
  cost: z.number(),
  speed: z.number(),
  effect: z.string(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  description: z.string(),
  type: z.enum(["passive", "active", "ultimate"]),
  flavorText: z.string().optional(),
});

const activeEffectSchema: z.ZodType<ActiveEffect> = z.object({
  type: z.enum([
    "block",
    "distraction",
    "invulnerability",
    "strength_up",
    "strength_down",
    "energy_steal",
    "armor_ignore",
    "heal",
    "propaganda",
    "sanction",
    "cost_reduce",
    "skip_ability",
    "draw_next",
    "block_hand",
    "damage_block",
  ]),
  value: z.number(),
  duration: z.number(),
  source: z.string(),
});

const cardCategorySchema = z.enum(["attack", "defense", "support"]);

const roundEventSchema: z.ZodType<RoundEvent> = z.object({
  kind: z.enum(["submit", "reveal", "resolve"]),
  playerNum: playerNumSchema,
  cardId: z.string(),
  cardName: z.string(),
  category: cardCategorySchema,
  totalSpeed: z.number(),
  order: playerNumSchema.optional(),
});

const combatEventSchema: z.ZodType<CombatEvent> = z.object({
  turn: z.number(),
  playerNum: playerNumSchema,
  playerName: z.string(),
  cardId: z.string(),
  cardName: z.string(),
  effects: z.array(z.string()),
  rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
  category: cardCategorySchema.optional(),
});

const playedCardSchema: z.ZodType<PlayedCard> = z.object({
  playerId: z.string(),
  playerNum: playerNumSchema,
  card: abilityCardSchema,
});

const turnResolutionSchema: z.ZodType<TurnResolution> = z.object({
  turn: z.number(),
  combatEvents: z.array(combatEventSchema),
  roundEvents: z.array(roundEventSchema),
  player1EnergyAfter: z.number(),
  player2EnergyAfter: z.number(),
  player1DiscardAdded: z.number(),
  player2DiscardAdded: z.number(),
  damageDealt: z.object({ to1: z.number(), to2: z.number() }),
});

const turnRecordSchema: z.ZodType<TurnRecord> = z.object({
  turn: z.number(),
  player1Cards: z.array(z.string()),
  player2Cards: z.array(z.string()),
  damageDealt: z.object({ to1: z.number(), to2: z.number() }),
  events: z.array(z.string()),
  combatEvents: z.array(combatEventSchema).optional(),
});

const matchPlayerSchema: z.ZodType<MatchPlayer> = z.object({
  id: z.string(),
  nickname: z.string(),
  characterId: z.string(),
  currentForm: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  hp: z.number(),
  maxHp: z.number(),
  armor: z.number(),
  energy: z.number(),
  maxEnergy: z.number(),
  strength: z.number(),
  speed: z.number(),
  charges: z.number(),
  hand: z.array(abilityCardSchema),
  deck: z.array(abilityCardSchema),
  discardPile: z.array(abilityCardSchema),
  activeEffects: z.array(activeEffectSchema),
  isAi: z.boolean(),
  relicId: z.string().optional(),
  tempDamageBonus: z.number().optional(),
});

const flagsSchema = z.object({ 1: z.boolean(), 2: z.boolean() });

/* ------------------------------------------------------------------ *
 * PlayerView — единственная форма состояния, покидающая сервер
 * ------------------------------------------------------------------ */

export const playerViewSchema = z.object({
  id: z.string(),
  currentTurn: z.number(),
  phase: gamePhaseSchema,
  abilityOrder: playerNumSchema,
  abilityPhasePassed: flagsSchema,
  status: matchStatusSchema,
  winner: playerNumSchema.nullable(),
  turnDeadline: z.string(),
  createdAt: z.string(),

  me: z.intersection(matchPlayerSchema, z.object({ playerNum: playerNumSchema })),

  opponent: z.object({
    playerNum: playerNumSchema,
    id: z.string(),
    nickname: z.string(),
    characterId: z.string(),
    currentForm: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    hp: z.number(),
    maxHp: z.number(),
    armor: z.number(),
    energy: z.number(),
    maxEnergy: z.number(),
    strength: z.number(),
    speed: z.number(),
    charges: z.number(),
    handCount: z.number(),
    deckCount: z.number(),
    discardPile: z.array(abilityCardSchema),
    activeEffects: z.array(activeEffectSchema),
    isAi: z.boolean(),
    relicId: z.string().optional(),
  }),

  battleRound: z.object({
    myCard: abilityCardSchema.nullable(),
    /** null пока !revealed */
    opponentCard: abilityCardSchema.nullable(),
    /** Соперник подал карту, но раскрытия ещё не было — рисуем рубашку */
    opponentSubmitted: z.boolean(),
    revealed: z.boolean(),
    resolving: z.boolean(),
  }),

  roundEvents: z.array(roundEventSchema),
  combatLog: z.array(combatEventSchema),
  /** Отыгранные ходы: карты уже раскрыты, по ним считается итоговая статистика. */
  turnHistory: z.array(turnRecordSchema),
  turnPassed: flagsSchema,
  abilityPhaseCards: z.array(playedCardSchema),
  lastResolution: turnResolutionSchema.optional(),
});

export type PlayerView = z.infer<typeof playerViewSchema>;
export type OpponentView = PlayerView["opponent"];

/* ------------------------------------------------------------------ *
 * Общие подсхемы
 * ------------------------------------------------------------------ */

export const playerBriefSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  rating: z.number(),
  characterId: z.string().optional(),
});

export type PlayerBrief = z.infer<typeof playerBriefSchema>;

export const presenceStatusSchema = z.enum([
  "online",
  "in_lobby",
  "in_match",
  "offline",
]);

export type PresenceStatus = z.infer<typeof presenceStatusSchema>;

export const lobbyPlayerSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  rating: z.number(),
  characterId: z.string(),
  ready: z.boolean(),
  isHost: z.boolean(),
  connected: z.boolean(),
});

export const lobbyStateSchema = z.object({
  code: z.string().length(6),
  inviteUrl: z.string(),
  hostId: z.string(),
  players: z.array(lobbyPlayerSchema).min(1).max(2),
  createdAt: z.number().int(),
  expiresAt: z.number().int(),
  startingInMs: z.number().int().nullable(),
});

export type LobbyState = z.infer<typeof lobbyStateSchema>;
export type LobbyPlayerState = z.infer<typeof lobbyPlayerSchema>;

export const resumeIntoSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("match"), matchId: z.string() }),
  z.object({ kind: z.literal("lobby"), code: z.string() }),
  z.object({ kind: z.literal("queue") }),
]);

export type ResumeInto = z.infer<typeof resumeIntoSchema>;

/* ------------------------------------------------------------------ *
 * Клиент → сервер
 * ------------------------------------------------------------------ */

const characterId = z.string().min(1).max(64);

export const clientMessages = {
  // сессия
  resume: z.object({
    resumeToken: z.string(),
    lastSeq: z.number().int().nonnegative(),
  }),
  pong: z.object({ echo: z.number().int() }),
  request_snapshot: z.object({ matchId: z.string() }),

  // очередь
  find_match: z.object({
    characterId,
    deckId: z.string().max(64).optional(),
  }),
  cancel_matchmaking: z.object({}),

  // лобби
  create_lobby: z.object({ characterId }),
  join_lobby: z.object({ code: z.string().length(6) }),
  leave_lobby: z.object({}),
  set_ready: z.object({ ready: z.boolean() }),
  set_character: z.object({ characterId }),
  rematch_offer: z.object({ matchId: z.string() }),
  rematch_accept: z.object({ matchId: z.string() }),

  // социальное
  invite_friend: z.object({ friendId: z.string().max(64) }),
  invite_respond: z.object({ inviteId: z.string(), accept: z.boolean() }),
  subscribe_presence: z.object({}),

  // матч
  submit_card: z.object({ matchId: z.string(), cardId: z.string() }),
  pass_turn: z.object({ matchId: z.string() }),
  use_ability: z.object({ matchId: z.string(), abilityId: z.string() }),
  pass_ability: z.object({ matchId: z.string() }),
  surrender: z.object({ matchId: z.string() }),
  /** Досрочно закрыть матч, если соперник не вернулся из grace-периода. */
  claim_victory: z.object({ matchId: z.string() }),
} as const;

export type ClientMessages = typeof clientMessages;
export type ClientMessageType = keyof ClientMessages;
export type ClientPayload<T extends ClientMessageType> = z.infer<
  ClientMessages[T]
>;

/** Действия, потеря которых стоит игроку хода — требуют ack и переотправки. */
export const MATCH_ACTIONS = new Set<ClientMessageType>([
  "submit_card",
  "pass_turn",
  "use_ability",
  "pass_ability",
  "surrender",
]);

/** Более строгий лимит: эти операции пишут в Redis. */
export const HEAVY_ACTIONS = new Set<ClientMessageType>([
  "find_match",
  "create_lobby",
  "join_lobby",
  "rematch_offer",
  "invite_friend",
]);

/* ------------------------------------------------------------------ *
 * Сервер → клиент
 * ------------------------------------------------------------------ */

export const serverMessages = {
  // сессия
  hello: z.object({
    userId: z.string(),
    nickname: z.string(),
    rating: z.number(),
    protocolVersion: z.literal(PROTOCOL_VERSION),
    resumeToken: z.string(),
    serverTime: z.number().int(),
    resumeInto: resumeIntoSchema,
  }),
  ping: z.object({ echo: z.number().int() }),
  ack: z.object({
    id: z.string(),
    ok: z.boolean(),
    error: errorSchema.optional(),
  }),

  // очередь
  queue_state: z.object({
    position: z.number().int(),
    etaSeconds: z.number().int().nullable(),
    searchWindow: z.number().int(),
    elapsedSeconds: z.number().int(),
    playersSearching: z.number().int(),
    offerAi: z.boolean(),
  }),
  queue_left: z.object({
    reason: z.enum(["cancelled", "matched", "timeout", "error"]),
  }),

  // лобби
  lobby_state: lobbyStateSchema,
  lobby_closed: z.object({
    reason: z.enum(["host_left", "expired", "started", "left"]),
  }),

  // социальное
  friend_invite: z.object({
    inviteId: z.string(),
    from: playerBriefSchema,
    code: z.string().length(6),
    expiresAt: z.number().int(),
  }),
  friend_request: z.object({ from: playerBriefSchema }),
  presence_update: z.array(
    z.object({ userId: z.string(), status: presenceStatusSchema }),
  ),

  // матч
  match_found: z.object({
    matchId: z.string(),
    playerNum: playerNumSchema,
    opponent: playerBriefSchema,
    countdownMs: z.number().int(),
    source: z.enum(["queue", "lobby", "rematch"]),
  }),
  game_state: z.object({
    matchId: z.string(),
    playerNum: playerNumSchema,
    version: z.number().int(),
    view: playerViewSchema,
  }),
  game_over: z.object({
    matchId: z.string(),
    winner: playerNumSchema,
    reason: z.enum([
      "hp",
      "surrender",
      "disconnect_timeout",
      "turn_timeout",
    ]),
    ratingDelta: z.number().int(),
    newRating: z.number().int(),
  }),
  opponent_disconnected: z.object({ graceSeconds: z.number().int() }),
  opponent_reconnected: z.object({}),
  turn_deadline: z.object({
    matchId: z.string(),
    deadlineMs: z.number().int(),
  }),
  rematch_offered: z.object({
    matchId: z.string(),
    from: playerBriefSchema,
    expiresAt: z.number().int(),
  }),
  rematch_declined: z.object({ matchId: z.string() }),

  // ошибки
  error: errorSchema,
} as const;

export type ServerMessages = typeof serverMessages;
export type ServerMessageType = keyof ServerMessages;
export type ServerPayload<T extends ServerMessageType> = z.infer<
  ServerMessages[T]
>;

/** Причина закрытия матча — общая для рассылки, метрик и истории. */
export type FinishReason = ServerPayload<"game_over">["reason"];

/* ------------------------------------------------------------------ *
 * Кодирование и разбор
 * ------------------------------------------------------------------ */

export function encode(
  type: string,
  payload: unknown,
  seq: number,
  id: string,
): string {
  return JSON.stringify({
    v: PROTOCOL_VERSION,
    id,
    seq,
    type,
    ts: Date.now(),
    payload,
  } satisfies Envelope);
}

export type DecodeResult =
  | { ok: true; envelope: Envelope }
  | { ok: false; reason: "malformed" | "version" };

export function decodeEnvelope(raw: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const result = envelopeSchema.safeParse(parsed);
  if (result.success) return { ok: true, envelope: result.data as Envelope };

  // Отличаем «старый клиент» от «мусор в сокете» — реакции разные.
  const versionMismatch =
    typeof parsed === "object" &&
    parsed !== null &&
    "v" in parsed &&
    (parsed as { v: unknown }).v !== PROTOCOL_VERSION;

  return { ok: false, reason: versionMismatch ? "version" : "malformed" };
}

export function isClientMessageType(type: string): type is ClientMessageType {
  return Object.prototype.hasOwnProperty.call(clientMessages, type);
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; issue: string };

export function parseClientPayload<T extends ClientMessageType>(
  type: T,
  payload: unknown,
): ParseResult<ClientPayload<T>> {
  const result = clientMessages[type].safeParse(payload);
  if (result.success) return { success: true, data: result.data as ClientPayload<T> };

  const first = result.error.issues[0];
  return {
    success: false,
    issue: first ? `${first.path.join(".")}: ${first.message}` : "invalid payload",
  };
}

export function isServerMessageType(type: string): type is ServerMessageType {
  return Object.prototype.hasOwnProperty.call(serverMessages, type);
}
