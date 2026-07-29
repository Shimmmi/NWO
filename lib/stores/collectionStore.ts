"use client";

import { create } from "zustand";
import { apiPath } from "@/lib/constants";
import type { CollectionItem } from "@/lib/schema";

interface CollectionState {
  items: CollectionItem[];
  ownedCounts: Record<string, number>;
  recentNew: Set<string>;
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  markNew: (cardIds: string[]) => void;
  clearNew: () => void;
  getOwned: (cardId: string) => number;
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  items: [],
  ownedCounts: {},
  recentNew: new Set(),
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    try {
      const res = await fetch(apiPath("/api/collection"), {
        credentials: "include",
      });
      if (!res.ok) {
        set({ loading: false, loaded: true });
        return;
      }
      const data = await res.json();
      const items = (data.items ?? []) as CollectionItem[];
      const ownedCounts: Record<string, number> = {};
      for (const i of items) ownedCounts[i.cardId] = i.count;
      set({ items, ownedCounts, loading: false, loaded: true });
    } catch {
      set({ loading: false, loaded: true });
    }
  },

  markNew: (cardIds) => {
    set((s) => {
      const next = new Set(s.recentNew);
      for (const id of cardIds) next.add(id);
      return { recentNew: next };
    });
  },

  clearNew: () => set({ recentNew: new Set() }),

  getOwned: (cardId) => get().ownedCounts[cardId] ?? 0,
}));
