import { getAllCharacters, getNeutralCards } from "@/lib/data";
import { ECONOMY } from "@/lib/shop/economy";

export function buildStarterGrants(): Array<{ cardId: string; count: number }> {
  const grants: Array<{ cardId: string; count: number }> = [];
  for (const character of getAllCharacters()) {
    for (const card of character.abilityCards) {
      if (card.rarity === "common") {
        grants.push({ cardId: card.id, count: 2 });
      } else if (card.rarity === "rare") {
        grants.push({ cardId: card.id, count: 1 });
      }
    }
  }
  for (const card of getNeutralCards()) {
    if (card.rarity === "common") {
      grants.push({ cardId: card.id, count: 1 });
    }
  }
  return grants;
}

export const STARTER_FREE_PACK_SKU = ECONOMY.LEVEL_UP_FREE_PACK_SKU;
