"use client";

import { motion } from "framer-motion";
import { BoosterSkuCard } from "@/components/shop/BoosterSkuCard";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { useShopStore } from "@/lib/stores/shopStore";

export function ShopCatalog() {
  const skus = useShopStore((s) => s.skus);
  const loading = useShopStore((s) => s.loading);
  const error = useShopStore((s) => s.error);
  const buyAndOpen = useShopStore((s) => s.buyAndOpen);
  const buyingSkuId = useShopStore((s) => s.buyingSkuId);
  const credits = useShopStore((s) => s.credits);

  const premium = skus.find((s) => s.id === "booster-mix-premium");
  const rest = skus.filter((s) => s.id !== "booster-mix-premium");

  if (loading && skus.length === 0) {
    return (
      <p style={{ color: COLORS.text_secondary, font: `400 15px ${TYPOGRAPHY.ui}` }}>
        Загрузка каталога…
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p
          style={{
            color: COLORS.red_glow,
            marginBottom: 16,
            font: `600 14px ${TYPOGRAPHY.ui}`,
          }}
        >
          {error}
        </p>
      )}

      {premium && (
        <motion.div
          layout
          style={{ marginBottom: 28 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BoosterSkuCard
            sku={premium}
            hero
            credits={credits}
            busy={buyingSkuId === premium.id}
            onBuy={() => void buyAndOpen(premium.id)}
          />
        </motion.div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        {rest.map((sku) => (
          <BoosterSkuCard
            key={sku.id}
            sku={sku}
            credits={credits}
            busy={buyingSkuId === sku.id}
            onBuy={() => void buyAndOpen(sku.id)}
          />
        ))}
      </div>
    </div>
  );
}
