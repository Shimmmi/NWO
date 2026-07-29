import { getCardById, getCharacterById } from "@/lib/data";
import { DECK_RULES } from "@/lib/game/deckRules";
import type {
  CostGroup,
  DeckEntry,
  DeckFilters,
  DeckSortOption,
  FilteredCard,
} from "@/lib/game/deckTypes";
import type { AbilityCard } from "@/lib/game/types";

const RARITY_RANK: Record<AbilityCard["rarity"], number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

export function reconstructEntries(cardIds: string[]): DeckEntry[] {
  const counts = new Map<string, number>();
  for (const id of cardIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const entries: DeckEntry[] = [];
  for (const [id, count] of counts) {
    const card = getCardById(id);
    if (card) entries.push({ card, count });
  }
  return entries.sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name));
}

export function getCharacterCards(characterId: string | null): AbilityCard[] {
  if (!characterId) return [];
  return getCharacterById(characterId)?.abilityCards ?? [];
}

export function filterAndSortCards(
  allCards: AbilityCard[],
  filters: DeckFilters,
  sortBy: DeckSortOption,
  entries: DeckEntry[],
  ownedCounts?: Map<string, number> | Record<string, number>,
  recentNew?: Set<string>,
): FilteredCard[] {
  const countMap = new Map(entries.map((e) => [e.card.id, e.count]));
  const total = entries.reduce((s, e) => s + e.count, 0);
  const search = filters.search.trim().toLowerCase();
  const getOwned = (id: string) => {
    if (!ownedCounts) return Infinity; // legacy unlock-all if not loaded
    if (ownedCounts instanceof Map) return ownedCounts.get(id) ?? 0;
    return ownedCounts[id] ?? 0;
  };

  let result: FilteredCard[] = allCards.map((card) => {
    const countInDeck = countMap.get(card.id) ?? 0;
    const ownedCount = getOwned(card.id);
    const maxCopies = Math.min(DECK_RULES.MAX_COPIES[card.rarity], ownedCount);
    const canAdd =
      ownedCount > 0 &&
      countInDeck < maxCopies &&
      total < DECK_RULES.MAX_CARDS;
    return {
      card,
      countInDeck,
      maxCopies: DECK_RULES.MAX_COPIES[card.rarity],
      canAdd,
      ownedCount: ownedCount === Infinity ? DECK_RULES.MAX_COPIES[card.rarity] : ownedCount,
      isNew: recentNew?.has(card.id),
    };
  });

  // Owned-only when ownership map provided
  if (ownedCounts) {
    result = result.filter((f) => f.ownedCount > 0);
  }

  if (search) {
    result = result.filter(
      (f) =>
        f.card.name.toLowerCase().includes(search) ||
        f.card.description.toLowerCase().includes(search) ||
        f.card.effect.toLowerCase().includes(search),
    );
  }
  if (filters.rarity !== "all") {
    result = result.filter((f) => f.card.rarity === filters.rarity);
  }
  if (filters.type !== "all") {
    result = result.filter((f) => f.card.type === filters.type);
  }
  result = result.filter(
    (f) => f.card.cost >= filters.costMin && f.card.cost <= filters.costMax,
  );
  if (filters.showOnlyInDeck) {
    result = result.filter((f) => f.countInDeck > 0);
  }
  if (filters.showOnlyAvailable) {
    result = result.filter((f) => f.canAdd);
  }

  result.sort((a, b) => {
    switch (sortBy) {
      case "cost_desc":
        return b.card.cost - a.card.cost || a.card.name.localeCompare(b.card.name);
      case "name_asc":
        return a.card.name.localeCompare(b.card.name);
      case "rarity_desc":
        return (
          RARITY_RANK[b.card.rarity] - RARITY_RANK[a.card.rarity] ||
          a.card.cost - b.card.cost
        );
      case "in_deck_first":
        return (
          b.countInDeck - a.countInDeck ||
          a.card.cost - b.card.cost ||
          a.card.name.localeCompare(b.card.name)
        );
      case "cost_asc":
      default:
        return a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name);
    }
  });

  return result;
}

export function groupDeckEntriesByCost(entries: DeckEntry[]): CostGroup[] {
  const map = new Map<number, DeckEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.card.cost) ?? [];
    list.push(entry);
    map.set(entry.card.cost, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([cost, groupEntries]) => ({
      cost,
      entries: groupEntries.sort((a, b) => a.card.name.localeCompare(b.card.name)),
    }));
}

export function deckFromRecord(record: {
  deckId: string;
  userId: string;
  name: string;
  characterId: string;
  cardIds: string[];
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.deckId,
    userId: record.userId,
    name: record.name,
    characterId: record.characterId,
    entries: reconstructEntries(record.cardIds),
    isValid: record.isValid,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
