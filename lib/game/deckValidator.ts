import {
  DECK_RULES,
  copiesWord,
  getCharacterPrefix,
} from "@/lib/game/deckRules";
import type {
  DeckEntry,
  DeckError,
  DeckValidationResult,
  DeckWarning,
} from "@/lib/game/deckTypes";

export function validateDeck(
  cards: DeckEntry[],
  characterId: string,
): DeckValidationResult {
  const errors: DeckError[] = [];
  const warnings: DeckWarning[] = [];
  const totalCards = cards.reduce((sum, e) => sum + e.count, 0);

  if (totalCards < DECK_RULES.MIN_CARDS) {
    errors.push({
      type: "too_few",
      message: `В колоде ${totalCards} карт — нужно минимум ${DECK_RULES.MIN_CARDS}`,
    });
  }
  if (totalCards > DECK_RULES.MAX_CARDS) {
    errors.push({
      type: "too_many",
      message: `В колоде ${totalCards} карт — максимум ${DECK_RULES.MAX_CARDS}`,
    });
  }

  for (const entry of cards) {
    const maxCopies = DECK_RULES.MAX_COPIES[entry.card.rarity];
    if (entry.count > maxCopies) {
      errors.push({
        type: "copy_limit",
        message: `"${entry.card.name}": максимум ${maxCopies} копи${copiesWord(maxCopies)}`,
        cardId: entry.card.id,
      });
    }
  }

  if (characterId) {
    const prefix = getCharacterPrefix(characterId);
    if (prefix) {
      const wrongChar = cards.filter((e) => !e.card.id.startsWith(prefix));
      if (wrongChar.length > 0) {
        errors.push({
          type: "wrong_character",
          message: `${wrongChar.length} карт не принадлежат этому персонажу`,
        });
      }
    }
  }

  const allCards = cards.flatMap((e) => Array(e.count).fill(e.card));
  const lowCostCount = allCards.filter((c) => c.cost <= 2).length;
  const highCostCount = allCards.filter((c) => c.cost >= 5).length;

  if (
    totalCards > 0 &&
    lowCostCount < DECK_RULES.RECOMMENDED.lowCost.minCount
  ) {
    warnings.push({
      type: "curve_heavy",
      message: "Мало дешёвых карт",
      suggestion: `Добавь ${DECK_RULES.RECOMMENDED.lowCost.minCount - lowCostCount}+ карт стоимостью 0-2`,
    });
  }
  if (highCostCount > 8) {
    warnings.push({
      type: "curve_heavy",
      message: "Слишком много дорогих карт",
      suggestion: "Замени часть 5-6 карт на карты стоимостью 2-3",
    });
  }

  const hasProtection = allCards.some(
    (c) => c.effect.includes("block") || c.effect.includes("heal"),
  );
  if (totalCards > 0 && !hasProtection) {
    warnings.push({
      type: "no_protection",
      message: "Нет защитных карт",
      suggestion: "Добавь хотя бы одну карту с блоком или лечением",
    });
  }

  const hasFinisher = allCards.some(
    (c) => c.type === "ultimate" || c.rarity === "legendary",
  );
  if (totalCards > 0 && !hasFinisher) {
    warnings.push({
      type: "no_finisher",
      message: "Нет легендарных карт",
      suggestion: "Добавь хотя бы одну legendary-карту в качестве финишера",
    });
  }

  return {
    isValid: errors.length === 0,
    totalCards,
    errors,
    warnings,
  };
}

/** Flatten entries → cardIds for API persistence */
export function entriesToCardIds(entries: DeckEntry[]): string[] {
  return entries.flatMap((e) => Array(e.count).fill(e.card.id) as string[]);
}

/** Validate flat cardIds array (API / server) */
export function validateCardIds(
  characterId: string,
  cardIds: string[],
  findCard: (id: string) => { id: string; rarity: string; name: string } | undefined,
): boolean {
  if (cardIds.length < DECK_RULES.MIN_CARDS || cardIds.length > DECK_RULES.MAX_CARDS) {
    return false;
  }

  const prefix = getCharacterPrefix(characterId);
  const counts = new Map<string, number>();

  for (const id of cardIds) {
    if (prefix && !id.startsWith(prefix)) return false;
    const card = findCard(id);
    if (!card) return false;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  for (const [id, count] of counts) {
    const card = findCard(id);
    if (!card) return false;
    const rarity = card.rarity as keyof typeof DECK_RULES.MAX_COPIES;
    const max = DECK_RULES.MAX_COPIES[rarity];
    if (count > max) return false;
  }

  return true;
}
