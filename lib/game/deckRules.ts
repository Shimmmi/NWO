import type { Rarity } from "@/lib/game/deckTypes";

export const DECK_RULES = {
  MIN_CARDS: 20,
  MAX_CARDS: 30,

  MAX_COPIES: {
    common: 3,
    rare: 2,
    epic: 1,
    legendary: 1,
  } as Record<Rarity, number>,

  REQUIRED: {
    minDistinctCards: 8,
    maxSameCostCards: 8,
  },

  RECOMMENDED: {
    lowCost: { costRange: [0, 2] as const, minCount: 6 },
    midCost: { costRange: [3, 4] as const, minCount: 6 },
    highCost: { costRange: [5, 6] as const, minCount: 3 },
    protective: { types: ["block", "heal"] as const, minCount: 4 },
  },
} as const;

export const NEUTRAL_PREFIX = "nt-";
export const NEUTRAL_OWNER_ID = "neutral";
export const MIN_FACTION_CARDS = 12;

export const CHARACTER_CARD_PREFIX: Record<string, string> = {
  "donald-rumpf": "dr-",
  "vladimir-pu": "vp-",
  "jin-shi": "js-",
  "vlado-zelenko": "vz-",
};

export function getCharacterPrefix(characterId: string): string {
  return CHARACTER_CARD_PREFIX[characterId] ?? "";
}

export function isNeutralCardId(cardId: string): boolean {
  return cardId.startsWith(NEUTRAL_PREFIX);
}

/** Card is legal in a leader deck if it is that faction OR a neutral. */
export function isLegalCardForCharacter(
  cardId: string,
  characterId: string,
): boolean {
  if (isNeutralCardId(cardId)) return true;
  const prefix = CHARACTER_CARD_PREFIX[characterId];
  return Boolean(prefix && cardId.startsWith(prefix));
}

export function countFactionCards(
  cardIds: string[],
  characterId: string,
): number {
  const prefix = CHARACTER_CARD_PREFIX[characterId] ?? "";
  if (!prefix) return 0;
  return cardIds.filter((id) => id.startsWith(prefix)).length;
}

export function copiesWord(n: number): string {
  return n === 1 ? "я" : "и";
}
