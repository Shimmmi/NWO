"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopCatalog } from "@/components/shop/ShopCatalog";
import { BoosterOpeningOverlay } from "@/components/shop/opening/BoosterOpeningOverlay";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { useShopStore } from "@/lib/stores/shopStore";
import { useCollectionStore } from "@/lib/stores/collectionStore";

export function ShopPage() {
  const loadCatalog = useShopStore((s) => s.loadCatalog);
  const loadPacks = useShopStore((s) => s.loadPacks);
  const opening = useShopStore((s) => s.opening);
  const openingSku = useShopStore((s) => s.openingSku);
  const clearOpening = useShopStore((s) => s.clearOpening);
  const markNew = useCollectionStore((s) => s.markNew);
  const reloadCollection = useCollectionStore((s) => s.load);

  useEffect(() => {
    void loadCatalog();
    void loadPacks();
  }, [loadCatalog, loadPacks]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, ${COLORS.gold}22, transparent),
          linear-gradient(180deg, ${COLORS.bg_void} 0%, #0c0d18 40%, ${COLORS.bg_surface} 100%)
        `,
        color: COLORS.text_primary,
        fontFamily: TYPOGRAPHY.ui,
      }}
    >
      <ShopHeader />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 80px" }}>
        <p
          style={{
            font: `400 14px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
            marginBottom: 24,
            letterSpacing: "0.04em",
          }}
        >
          4 Common · 2 Rare · 1 Epic/Legendary · possible bonus — soft credits only
        </p>
        <ShopCatalog />
        <div style={{ marginTop: 40, textAlign: "center" }}>
          <Link
            href="/decks"
            style={{
              color: COLORS.gold,
              font: `600 14px ${TYPOGRAPHY.ui}`,
              textDecoration: "none",
            }}
          >
            Перейти к колодам →
          </Link>
        </div>
      </main>

      {opening && openingSku && (
        <BoosterOpeningOverlay
          sku={openingSku}
          result={opening}
          onComplete={() => {
            markNew(opening.cards.filter((c) => c.isNew).map((c) => c.cardId));
            void reloadCollection();
            clearOpening();
          }}
        />
      )}
    </div>
  );
}
