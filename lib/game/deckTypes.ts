import type { AbilityCard } from "@/lib/game/types";

export type Rarity = AbilityCard["rarity"];

export interface DeckEntry {
  card: AbilityCard;
  count: number;
}

export interface Deck {
  id: string;
  userId: string;
  name: string;
  characterId: string;
  entries: DeckEntry[];
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeckFilters {
  search: string;
  rarity: Rarity | "all";
  type: "all" | "active" | "passive" | "ultimate";
  costMin: number;
  costMax: number;
  showOnlyInDeck: boolean;
  showOnlyAvailable: boolean;
}

export type DeckSortOption =
  | "cost_asc"
  | "cost_desc"
  | "name_asc"
  | "rarity_desc"
  | "in_deck_first";

export interface DeckBuilderState {
  characterId: string | null;
  currentDeck: {
    id: string | null;
    name: string;
    entries: DeckEntry[];
  };
  filters: DeckFilters;
  sortBy: DeckSortOption;
  previewCard: AbilityCard | null;
  activePanel: "collection" | "deckList" | "stats";
  savedDecks: Deck[];
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: string | null;
}

export type DeckError = {
  type: "too_few" | "too_many" | "wrong_character" | "copy_limit";
  message: string;
  cardId?: string;
};

export type DeckWarning = {
  type: "curve_heavy" | "curve_light" | "no_protection" | "no_finisher";
  message: string;
  suggestion: string;
};

export type DeckValidationResult = {
  isValid: boolean;
  totalCards: number;
  errors: DeckError[];
  warnings: DeckWarning[];
};

export type FilteredCard = {
  card: AbilityCard;
  countInDeck: number;
  maxCopies: number;
  canAdd: boolean;
};

export type CostGroup = {
  cost: number;
  entries: DeckEntry[];
};
