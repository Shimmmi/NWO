import { randomInt } from "crypto";
import { getAllCharacters, getCardById, getNeutralCards } from "@/lib/data";
import type { AbilityCard } from "@/lib/game/types";
import type { BoosterSku } from "@/lib/shop/catalog";

export type PackSlotRarity = "common" | "rare" | "epic" | "legendary";

export type PackSlotId =
  | "c1"
  | "c2"
  | "c3"
  | "c4"
  | "r1"
  | "r2"
  | "elite"
  | "bonus";

export interface PackCardResult {
  cardId: string;
  rarity: PackSlotRarity;
  slot: PackSlotId;
  isNew: boolean;
}

export interface PackOpenResult {
  packInstanceId: string;
  skuId: string;
  cards: PackCardResult[];
  legendaryHit: boolean;
  pityBefore: number;
  pityAfter: number;
}

export const PACK_ODDS = {
  ELITE_LEGENDARY_BASE: 0.08,
  PITY_START: 20,
  PITY_INCREMENT: 0.005,
  PITY_HARD: 40,
  BONUS_BASE_CHANCE: 0.15,
  BONUS_GIVEN_EPIC_PLUS: 0.2,
  BONUS_LEGENDARY_GIVEN_EPIC_PLUS: 0.1,
} as const;

function rand01(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length)]!;
}

export function eliteLegendaryChance(
  pity: number,
  skuLegendaryWeightBonus: number,
): number {
  if (pity >= PACK_ODDS.PITY_HARD) return 1;
  let p = PACK_ODDS.ELITE_LEGENDARY_BASE + skuLegendaryWeightBonus;
  if (pity >= PACK_ODDS.PITY_START) {
    p += (pity - PACK_ODDS.PITY_START + 1) * PACK_ODDS.PITY_INCREMENT;
  }
  return Math.min(1, p);
}

function poolCards(sku: BoosterSku): AbilityCard[] {
  if (sku.pool.type === "character") {
    const characterId = sku.pool.characterId;
    const character = getAllCharacters().find((c) => c.id === characterId);
    return character?.abilityCards ?? [];
  }
  if (sku.pool.type === "neutral") {
    return getNeutralCards();
  }
  return [...getAllCharacters().flatMap((c) => c.abilityCards), ...getNeutralCards()];
}

function cardsOfRarity(
  pool: AbilityCard[],
  rarity: PackSlotRarity,
): AbilityCard[] {
  const filtered = pool.filter((c) => c.rarity === rarity);
  if (filtered.length > 0) return filtered;
  // Fallback ladder if a rarity is empty in data
  if (rarity === "legendary") return cardsOfRarity(pool, "epic");
  if (rarity === "epic") return cardsOfRarity(pool, "rare");
  if (rarity === "rare") return cardsOfRarity(pool, "common");
  return pool;
}

function rollCard(
  pool: AbilityCard[],
  rarity: PackSlotRarity,
  slot: PackSlotId,
): Omit<PackCardResult, "isNew"> {
  const card = pickOne(cardsOfRarity(pool, rarity));
  return { cardId: card.id, rarity: card.rarity as PackSlotRarity, slot };
}

/**
 * Server-only pack roll. Expected composition: 4C + 2R + 1E/L + optional bonus.
 * Soft EV note: ~0.08L base on elite, soft pity after 20, hard at 40.
 */
export function rollPack(
  sku: BoosterSku,
  pityBefore: number,
  ownedCounts: Map<string, number>,
  packInstanceId: string,
): PackOpenResult {
  const pool = poolCards(sku);
  const cards: Omit<PackCardResult, "isNew">[] = [];

  for (const slot of ["c1", "c2", "c3", "c4"] as const) {
    cards.push(rollCard(pool, "common", slot));
  }
  for (const slot of ["r1", "r2"] as const) {
    cards.push(rollCard(pool, "rare", slot));
  }

  const legendaryChance = eliteLegendaryChance(
    pityBefore,
    sku.legendaryWeightBonus,
  );
  const eliteIsLegendary = rand01() < legendaryChance;
  cards.push(
    rollCard(pool, eliteIsLegendary ? "legendary" : "epic", "elite"),
  );

  const bonusChance = Math.min(
    1,
    PACK_ODDS.BONUS_BASE_CHANCE * sku.bonusChanceMultiplier,
  );
  if (rand01() < bonusChance) {
    let bonusRarity: PackSlotRarity = "rare";
    if (rand01() < PACK_ODDS.BONUS_GIVEN_EPIC_PLUS) {
      bonusRarity =
        rand01() < PACK_ODDS.BONUS_LEGENDARY_GIVEN_EPIC_PLUS
          ? "legendary"
          : "epic";
    }
    cards.push(rollCard(pool, bonusRarity, "bonus"));
  }

  const legendaryHit = cards.some(
    (c) => c.slot === "elite" && c.rarity === "legendary",
  );
  const pityAfter = legendaryHit ? 0 : pityBefore + 1;

  const withNew: PackCardResult[] = cards.map((c) => ({
    ...c,
    isNew: (ownedCounts.get(c.cardId) ?? 0) === 0,
  }));

  // Validate card ids exist
  for (const c of withNew) {
    if (!getCardById(c.cardId)) {
      throw new Error(`packRoll produced unknown card ${c.cardId}`);
    }
  }

  return {
    packInstanceId,
    skuId: sku.id,
    cards: withNew,
    legendaryHit,
    pityBefore,
    pityAfter,
  };
}
