"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { toast } from "sonner";
import { apiPath } from "@/lib/constants";
import { decodeDeck, encodeDeck } from "@/lib/game/deckCode";
import { deckFromRecord, reconstructEntries } from "@/lib/game/deckHelpers";
import { copiesWord, DECK_RULES } from "@/lib/game/deckRules";
import type {
  Deck,
  DeckBuilderState,
  DeckFilters,
  DeckSortOption,
  DeckValidationResult,
} from "@/lib/game/deckTypes";
import { entriesToCardIds, validateDeck } from "@/lib/game/deckValidator";
import type { AbilityCard } from "@/lib/game/types";
import type { DeckRecord } from "@/lib/schema";
import { useCollectionStore } from "@/lib/stores/collectionStore";

const DEFAULT_FILTERS: DeckFilters = {
  search: "",
  rarity: "all",
  type: "all",
  costMin: 0,
  costMax: 6,
  showOnlyInDeck: false,
  showOnlyAvailable: false,
};

interface DeckBuilderStore extends DeckBuilderState {
  selectCharacter: (id: string) => void;
  addCard: (card: AbilityCard) => { success: boolean; reason?: string };
  removeCard: (cardId: string) => void;
  setCardCount: (cardId: string, count: number) => void;
  clearDeck: () => void;
  createNewDeck: (name: string) => void;
  loadDeck: (deckId: string) => Promise<void>;
  loadSavedDecks: () => Promise<void>;
  saveDeck: () => Promise<void>;
  deleteDeck: (deckId: string) => Promise<void>;
  duplicateDeck: (deckId: string) => Promise<void>;
  renameDeck: (deckId: string | null, name: string) => Promise<void>;
  exportCode: () => string;
  importCode: (code: string) => { success: boolean; error?: string };
  setFilter: <K extends keyof DeckFilters>(key: K, value: DeckFilters[K]) => void;
  resetFilters: () => void;
  setSortBy: (sort: DeckSortOption) => void;
  setPreviewCard: (card: AbilityCard | null) => void;
  setDeckName: (name: string) => void;
  getValidation: () => DeckValidationResult;
  getCardCountInDeck: (cardId: string) => number;
  canAddCard: (card: AbilityCard) => boolean;
}

export const useDeckBuilderStore = create<DeckBuilderStore>()(
  immer((set, get) => ({
    characterId: null,
    currentDeck: { id: null, name: "Новая колода", entries: [] },
    filters: { ...DEFAULT_FILTERS },
    sortBy: "cost_asc" as DeckSortOption,
    previewCard: null,
    activePanel: "collection" as const,
    savedDecks: [] as Deck[],
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    saveError: null,

    selectCharacter: (id) =>
      set((state) => {
        state.characterId = id;
        state.currentDeck = { id: null, name: "Новая колода", entries: [] };
        state.lastSaved = null;
      }),

    addCard: (card) => {
      const state = get();
      const currentCount = state.getCardCountInDeck(card.id);
      const maxCopies = DECK_RULES.MAX_COPIES[card.rarity];
      const totalCards = state.currentDeck.entries.reduce(
        (s, e) => s + e.count,
        0,
      );

      const collection = useCollectionStore.getState();
      const ownedLoaded = collection.loaded;
      const owned = collection.getOwned(card.id);
      if (ownedLoaded && owned <= 0) {
        return { success: false, reason: "Карта не получена — откройте бустер" };
      }
      if (ownedLoaded) {
        const capped = Math.min(maxCopies, owned);
        if (currentCount >= capped) {
          return {
            success: false,
            reason: `Доступно только ${owned} копий в коллекции`,
          };
        }
      }

      if (totalCards >= DECK_RULES.MAX_CARDS) {
        return {
          success: false,
          reason: `Максимум ${DECK_RULES.MAX_CARDS} карт в колоде`,
        };
      }
      if (currentCount >= maxCopies) {
        return {
          success: false,
          reason: `Максимум ${maxCopies} копи${copiesWord(maxCopies)} "${card.name}"`,
        };
      }

      set((draft) => {
        const existing = draft.currentDeck.entries.find(
          (e) => e.card.id === card.id,
        );
        if (existing) {
          existing.count++;
        } else {
          draft.currentDeck.entries.push({ card, count: 1 });
        }
      });
      return { success: true };
    },

    removeCard: (cardId) =>
      set((state) => {
        const idx = state.currentDeck.entries.findIndex(
          (e) => e.card.id === cardId,
        );
        if (idx === -1) return;
        if (state.currentDeck.entries[idx].count > 1) {
          state.currentDeck.entries[idx].count--;
        } else {
          state.currentDeck.entries.splice(idx, 1);
        }
      }),

    setCardCount: (cardId, count) =>
      set((state) => {
        const entry = state.currentDeck.entries.find((e) => e.card.id === cardId);
        if (!entry) return;
        const max = DECK_RULES.MAX_COPIES[entry.card.rarity];
        const next = Math.max(0, Math.min(count, max));
        if (next === 0) {
          state.currentDeck.entries = state.currentDeck.entries.filter(
            (e) => e.card.id !== cardId,
          );
        } else {
          entry.count = next;
        }
      }),

    getCardCountInDeck: (cardId) => {
      const entry = get().currentDeck.entries.find((e) => e.card.id === cardId);
      return entry?.count ?? 0;
    },

    canAddCard: (card) => {
      const state = get();
      const count = state.getCardCountInDeck(card.id);
      const total = state.currentDeck.entries.reduce((s, e) => s + e.count, 0);
      const collection = useCollectionStore.getState();
      const ownedLoaded = collection.loaded;
      const owned = collection.getOwned(card.id);
      const max = ownedLoaded
        ? Math.min(DECK_RULES.MAX_COPIES[card.rarity], owned)
        : DECK_RULES.MAX_COPIES[card.rarity];
      return count < max && total < DECK_RULES.MAX_CARDS && (!ownedLoaded || owned > 0);
    },

    getValidation: () => {
      const { currentDeck, characterId } = get();
      return validateDeck(currentDeck.entries, characterId ?? "");
    },

    exportCode: () => {
      const { currentDeck, characterId } = get();
      return encodeDeck({
        characterId: characterId ?? "",
        name: currentDeck.name,
        entries: currentDeck.entries,
      });
    },

    importCode: (code) => {
      const decoded = decodeDeck(code);
      if (!decoded) return { success: false, error: "Неверный код колоды" };
      set((state) => {
        state.characterId = decoded.characterId;
        state.currentDeck = {
          id: null,
          name: decoded.name,
          entries: decoded.entries,
        };
        state.lastSaved = null;
      });
      return { success: true };
    },

    setFilter: (key, value) =>
      set((state) => {
        state.filters[key] = value as never;
      }),

    resetFilters: () =>
      set((state) => {
        state.filters = { ...DEFAULT_FILTERS };
      }),

    setSortBy: (sort) =>
      set((state) => {
        state.sortBy = sort;
      }),

    setPreviewCard: (card) =>
      set((state) => {
        state.previewCard = card;
      }),

    setDeckName: (name) =>
      set((state) => {
        state.currentDeck.name = name;
      }),

    createNewDeck: (name) =>
      set((state) => {
        state.currentDeck = { id: null, name, entries: [] };
        state.lastSaved = null;
      }),

    clearDeck: () =>
      set((state) => {
        state.currentDeck.entries = [];
      }),

    loadSavedDecks: async () => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const res = await fetch(apiPath("/api/decks"), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { decks: DeckRecord[] };
        set((state) => {
          state.savedDecks = data.decks.map(deckFromRecord);
          state.isLoading = false;
        });
      } catch {
        set((state) => {
          state.isLoading = false;
        });
        toast.error("Не удалось загрузить колоды");
      }
    },

    saveDeck: async () => {
      const { currentDeck, characterId } = get();
      if (!characterId) {
        toast.error("Выберите персонажа");
        return;
      }
      if (!currentDeck.name.trim()) {
        toast.error("Введите название колоды");
        return;
      }

      const cardIds = entriesToCardIds(currentDeck.entries);
      set((state) => {
        state.isSaving = true;
        state.saveError = null;
      });

      try {
        const res = await fetch(
          currentDeck.id
            ? apiPath(`/api/decks/${currentDeck.id}`)
            : apiPath("/api/decks"),
          {
            method: currentDeck.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: currentDeck.name.trim(),
              characterId,
              cardIds,
            }),
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Не удалось сохранить колоду",
          );
        }
        const { deck } = (await res.json()) as { deck: DeckRecord };
        set((state) => {
          state.currentDeck.id = deck.deckId;
          state.lastSaved = new Date();
          state.isSaving = false;
          const mapped = deckFromRecord(deck);
          const idx = state.savedDecks.findIndex((d) => d.id === deck.deckId);
          if (idx >= 0) state.savedDecks[idx] = mapped;
          else state.savedDecks.unshift(mapped);
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Ошибка сохранения";
        set((state) => {
          state.isSaving = false;
          state.saveError = message;
        });
        toast.error(message);
      }
    },

    loadDeck: async (deckId) => {
      set((state) => {
        state.isLoading = true;
      });
      try {
        const res = await fetch(apiPath(`/api/decks/${deckId}`), {
          credentials: "include",
        });
        if (!res.ok) throw new Error("not found");
        const { deck } = (await res.json()) as { deck: DeckRecord };
        const entries = reconstructEntries(deck.cardIds);
        set((state) => {
          state.characterId = deck.characterId;
          state.currentDeck = {
            id: deck.deckId,
            name: deck.name,
            entries,
          };
          state.isLoading = false;
          state.lastSaved = new Date(deck.updatedAt);
        });
      } catch {
        set((state) => {
          state.isLoading = false;
        });
        toast.error("Не удалось загрузить колоду");
      }
    },

    deleteDeck: async (deckId) => {
      try {
        const res = await fetch(apiPath(`/api/decks/${deckId}`), {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("delete failed");
        set((state) => {
          state.savedDecks = state.savedDecks.filter((d) => d.id !== deckId);
          if (state.currentDeck.id === deckId) {
            state.currentDeck = {
              id: null,
              name: "Новая колода",
              entries: [],
            };
            state.lastSaved = null;
          }
        });
        toast.success("Колода удалена");
      } catch {
        toast.error("Не удалось удалить колоду");
      }
    },

    duplicateDeck: async (deckId) => {
      const original = get().savedDecks.find((d) => d.id === deckId);
      if (!original) return;
      set((state) => {
        state.characterId = original.characterId;
        state.currentDeck = {
          id: null,
          name: `${original.name} (копия)`,
          entries: original.entries.map((e) => ({
            card: e.card,
            count: e.count,
          })),
        };
        state.lastSaved = null;
      });
      await get().saveDeck();
    },

    renameDeck: async (deckId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      set((state) => {
        state.currentDeck.name = trimmed;
      });

      if (!deckId) return;

      try {
        const res = await fetch(apiPath(`/api/decks/${deckId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error("rename failed");
        set((state) => {
          const deck = state.savedDecks.find((d) => d.id === deckId);
          if (deck) deck.name = trimmed;
          state.lastSaved = new Date();
        });
      } catch {
        toast.error("Не удалось переименовать");
      }
    },
  })),
);
