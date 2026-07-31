"use client";

import { create } from "zustand";
import { apiPath } from "@/lib/constants";
import type { BoosterSku } from "@/lib/shop/catalog";
import type { PackOpenResult } from "@/lib/shop/packRoll";
import type { PackInventoryItem } from "@/lib/schema";

interface ShopState {
  skus: BoosterSku[];
  credits: number;
  pity: number;
  packs: PackInventoryItem[];
  loading: boolean;
  buyingSkuId: string | null;
  opening: PackOpenResult | null;
  openingSku: BoosterSku | null;
  error: string | null;
  dailyAvailable: boolean;
  loadCatalog: () => Promise<void>;
  loadPacks: () => Promise<void>;
  buyAndOpen: (skuId: string) => Promise<void>;
  claimDaily: () => Promise<boolean>;
  clearOpening: () => void;
  setCredits: (n: number) => void;
}

function idempotencyKey(): string {
  return `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useShopStore = create<ShopState>((set, get) => ({
  skus: [],
  credits: 0,
  pity: 0,
  packs: [],
  loading: false,
  buyingSkuId: null,
  opening: null,
  openingSku: null,
  error: null,
  dailyAvailable: false,

  setCredits: (n) => set({ credits: n }),

  loadCatalog: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(apiPath("/api/shop/catalog"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("catalog_failed");
      const data = await res.json();
      set({
        skus: data.skus ?? [],
        credits: data.credits ?? 0,
        pity: data.pity ?? 0,
        dailyAvailable: Boolean(data.dailyAvailable),
        loading: false,
      });
    } catch {
      set({ loading: false, error: "Не удалось загрузить магазин" });
    }
  },

  loadPacks: async () => {
    try {
      const res = await fetch(apiPath("/api/shop/packs"), {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      set({ packs: data.packs ?? [] });
    } catch {
      /* ignore */
    }
  },

  buyAndOpen: async (skuId) => {
    const sku = get().skus.find((s) => s.id === skuId) ?? null;
    set({ buyingSkuId: skuId, error: null });
    try {
      const res = await fetch(apiPath("/api/shop/buy"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey(),
        },
        body: JSON.stringify({ skuId, open: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({
          buyingSkuId: null,
          error:
            data.error === "insufficient_credits"
              ? "Недостаточно credits"
              : "Покупка не удалась",
        });
        return;
      }
      set({
        credits: data.credits ?? get().credits,
        buyingSkuId: null,
        opening: data.openResult ?? null,
        openingSku: sku,
      });
      await get().loadPacks();
    } catch {
      set({ buyingSkuId: null, error: "Покупка не удалась" });
    }
  },

  claimDaily: async () => {
    try {
      const res = await fetch(apiPath("/api/shop/daily-claim"), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.credits != null) set({ credits: data.credits });
      const granted = Boolean(data.granted);
      if (granted) set({ dailyAvailable: false });
      return granted;
    } catch {
      return false;
    }
  },

  clearOpening: () => set({ opening: null, openingSku: null }),
}));
