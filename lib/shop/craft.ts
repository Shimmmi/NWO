import { getCardById, getCharacterIdForCard } from "@/lib/data";

export type CraftableFrom = "common" | "rare" | "epic";

export const CRAFT_NEXT: Record<CraftableFrom, "rare" | "epic" | "legendary"> = {
  common: "rare",
  rare: "epic",
  epic: "legendary",
};

export const CRAFT_COST = 4;

export interface CraftRequest {
  fromRarity: CraftableFrom;
  consume: Array<{ cardId: string; count: number }>;
  targetCardId: string;
}

export interface CraftResult {
  consumed: Array<{ cardId: string; count: number }>;
  gained: { cardId: string; count: 1 };
}

export type CraftValidationError =
  | "invalid_sum"
  | "mixed_rarity"
  | "mixed_character"
  | "insufficient"
  | "bad_target"
  | "unknown_card";

export function validateCraft(
  req: CraftRequest,
  owned: Map<string, number>,
): { ok: true; result: CraftResult } | { ok: false; error: CraftValidationError } {
  const total = req.consume.reduce((s, c) => s + c.count, 0);
  if (total !== CRAFT_COST) return { ok: false, error: "invalid_sum" };

  let characterId: string | null = null;

  for (const line of req.consume) {
    if (line.count <= 0) return { ok: false, error: "invalid_sum" };
    const card = getCardById(line.cardId);
    if (!card) return { ok: false, error: "unknown_card" };
    if (card.rarity !== req.fromRarity) return { ok: false, error: "mixed_rarity" };
    if ((owned.get(line.cardId) ?? 0) < line.count) {
      return { ok: false, error: "insufficient" };
    }
    const owner = getCharacterIdForCard(line.cardId);
    if (!owner) return { ok: false, error: "unknown_card" };
    if (characterId === null) characterId = owner;
    else if (owner !== characterId) {
      return { ok: false, error: "mixed_character" };
    }
  }

  const target = getCardById(req.targetCardId);
  if (!target) return { ok: false, error: "unknown_card" };
  if (target.rarity !== CRAFT_NEXT[req.fromRarity]) {
    return { ok: false, error: "bad_target" };
  }
  const targetOwner = getCharacterIdForCard(req.targetCardId);
  if (characterId && targetOwner !== characterId) {
    return { ok: false, error: "mixed_character" };
  }

  return {
    ok: true,
    result: {
      consumed: req.consume,
      gained: { cardId: req.targetCardId, count: 1 },
    },
  };
}
