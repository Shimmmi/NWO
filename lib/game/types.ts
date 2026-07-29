export type GamePhase =
  | "energy_recovery"
  | "card_draw"
  | "ability"
  | "battle"
  | "end_turn";

export type MatchStatus = "waiting" | "in_progress" | "finished";

export type CardCategory = "attack" | "defense" | "support";

export type EffectType =
  | "block"
  | "distraction"
  | "invulnerability"
  | "strength_up"
  | "strength_down"
  | "energy_steal"
  | "armor_ignore"
  | "heal"
  | "propaganda"
  | "sanction"
  | "cost_reduce"
  | "skip_ability"
  | "draw_next"
  | "block_hand"
  | "damage_block";

export interface ActiveEffect {
  type: EffectType;
  value: number;
  duration: number;
  source: string;
}

export interface FormStats {
  number: 1 | 2 | 3;
  name: string;
  maxHp: number;
  armor: number;
  maxEnergy: number;
  maxHand: number;
  strength: number;
  speed: number;
  charges: number;
}

export interface AbilityCard {
  id: string;
  name: string;
  cost: number;
  speed: number;
  effect: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  type: "passive" | "active" | "ultimate";
  flavorText?: string;
}

export interface UniqueAbility {
  id: string;
  name: string;
  chargeCost: number;
  description: string;
  effect: string;
}

export interface Character {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  countryAccent: "blue" | "red" | "crimson" | "gold";
  description: string;
  quote: string;
  stats: FormStats;
  forms: string[];
  passiveAbility: string;
  passiveDescription: string;
  uniqueAbilities: UniqueAbility[];
  abilityCards: AbilityCard[];
}

export interface MatchPlayer {
  id: string;
  nickname: string;
  characterId: string;
  currentForm: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  armor: number;
  energy: number;
  maxEnergy: number;
  strength: number;
  speed: number;
  charges: number;
  hand: AbilityCard[];
  deck: AbilityCard[];
  discardPile: AbilityCard[];
  activeEffects: ActiveEffect[];
  isAi: boolean;
  relicId?: string;
  tempDamageBonus?: number;
}

export interface PlayedCard {
  playerId: string;
  playerNum: 1 | 2;
  card: AbilityCard;
}

export interface BattleRoundState {
  p1Card: AbilityCard | null;
  p2Card: AbilityCard | null;
  revealed: boolean;
  resolving: boolean;
}

export interface RoundEvent {
  kind: "submit" | "reveal" | "resolve";
  playerNum: 1 | 2;
  cardId: string;
  cardName: string;
  category: CardCategory;
  totalSpeed: number;
  order?: 1 | 2;
}

export interface CombatEvent {
  turn: number;
  playerNum: 1 | 2;
  playerName: string;
  cardId: string;
  cardName: string;
  effects: string[];
  rarity?: AbilityCard["rarity"];
  category?: CardCategory;
}

export interface TurnResolution {
  turn: number;
  combatEvents: CombatEvent[];
  roundEvents: RoundEvent[];
  player1EnergyAfter: number;
  player2EnergyAfter: number;
  player1DiscardAdded: number;
  player2DiscardAdded: number;
  damageDealt: { to1: number; to2: number };
}

export interface TurnRecord {
  turn: number;
  player1Cards: string[];
  player2Cards: string[];
  damageDealt: { to1: number; to2: number };
  events: string[];
  combatEvents?: CombatEvent[];
}

export interface Match {
  id: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
  currentTurn: number;
  currentPlayer: 1 | 2;
  phase: GamePhase;
  abilityOrder: 1 | 2;
  abilityPhasePassed: Record<1 | 2, boolean>;
  battleRound: BattleRoundState;
  roundEvents: RoundEvent[];
  turnHistory: TurnRecord[];
  status: MatchStatus;
  winner: 1 | 2 | null;
  pendingActions: Record<1 | 2, string[] | null>;
  turnPassed: Record<1 | 2, boolean>;
  abilityPhaseCards: PlayedCard[];
  combatLog: CombatEvent[];
  lastResolution?: TurnResolution;
  turnDeadline: string;
  createdAt: string;
}

export const FORM_STATS: Record<string, FormStats[]> = {
  "donald-rumpf": [
    { number: 1, name: "Кандидат", maxHp: 100, armor: 25, maxEnergy: 4, maxHand: 5, strength: 7, speed: 5, charges: 3 },
    { number: 2, name: "Президент", maxHp: 130, armor: 30, maxEnergy: 5, maxHand: 5, strength: 9, speed: 6, charges: 4 },
    { number: 3, name: "Феникс MAGA", maxHp: 160, armor: 35, maxEnergy: 6, maxHand: 5, strength: 12, speed: 7, charges: 5 },
  ],
  "vladimir-pu": [
    { number: 1, name: "Премьер", maxHp: 130, armor: 35, maxEnergy: 3, maxHand: 5, strength: 8, speed: 3, charges: 4 },
    { number: 2, name: "Лидер", maxHp: 160, armor: 40, maxEnergy: 4, maxHand: 5, strength: 10, speed: 4, charges: 5 },
    { number: 3, name: "Медведь", maxHp: 200, armor: 45, maxEnergy: 5, maxHand: 5, strength: 13, speed: 5, charges: 6 },
  ],
  "jin-shi": [
    { number: 1, name: "Секретарь", maxHp: 120, armor: 30, maxEnergy: 3, maxHand: 5, strength: 7, speed: 4, charges: 3 },
    { number: 2, name: "Председатель", maxHp: 155, armor: 38, maxEnergy: 4, maxHand: 5, strength: 10, speed: 4, charges: 4 },
    { number: 3, name: "Вечный Дракон", maxHp: 195, armor: 48, maxEnergy: 5, maxHand: 5, strength: 14, speed: 4, charges: 6 },
  ],
  "vlado-zelenko": [
    { number: 1, name: "Комик", maxHp: 90, armor: 20, maxEnergy: 5, maxHand: 5, strength: 6, speed: 8, charges: 3 },
    { number: 2, name: "Президент", maxHp: 115, armor: 25, maxEnergy: 6, maxHand: 5, strength: 8, speed: 9, charges: 4 },
    { number: 3, name: "Легенда ВСУ", maxHp: 145, armor: 30, maxEnergy: 7, maxHand: 5, strength: 11, speed: 10, charges: 5 },
  ],
};

export function emptyBattleRound(): BattleRoundState {
  return {
    p1Card: null,
    p2Card: null,
    revealed: false,
    resolving: false,
  };
}

export function getPlayerMaxHand(player: MatchPlayer): number {
  return FORM_STATS[player.characterId]?.[player.currentForm - 1]?.maxHand ?? 5;
}
