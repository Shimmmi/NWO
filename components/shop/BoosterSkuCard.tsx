"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { COLORS, TYPOGRAPHY, getCharacterColor } from "@/lib/design/tokens";
import type { BoosterSku } from "@/lib/shop/catalog";

const ART_TINT: Record<string, string> = {
  "pack-usa": COLORS.usa_blue,
  "pack-russia": COLORS.russia_red,
  "pack-china": COLORS.china_red,
  "pack-ukraine": COLORS.ukraine_blue,
  "pack-mix": COLORS.gold,
  "pack-summit": COLORS.legendary,
};

export function BoosterSkuCard({
  sku,
  credits,
  busy,
  onBuy,
  hero = false,
}: {
  sku: BoosterSku;
  credits: number;
  busy: boolean;
  onBuy: () => void;
  hero?: boolean;
}) {
  const [shake, setShake] = useState(0);
  const canAfford = credits >= sku.priceCredits;
  const tint = ART_TINT[sku.artKey] ?? COLORS.gold;
  const characterTint =
    sku.pool.type === "character"
      ? getCharacterColor(sku.pool.characterId)
      : tint;

  const handleBuy = () => {
    if (!canAfford) {
      setShake((n) => n + 1);
      return;
    }
    onBuy();
  };

  return (
    <motion.div
      key={shake}
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02 }}
      style={{
        position: "relative",
        borderRadius: hero ? 18 : 14,
        overflow: "hidden",
        border: `1px solid ${characterTint}55`,
        background: `linear-gradient(145deg, ${COLORS.bg_card}, ${COLORS.bg_void})`,
        boxShadow: hero ? `0 12px 40px ${characterTint}33` : `0 6px 20px #0008`,
        padding: hero ? 24 : 16,
        display: hero ? "grid" : "flex",
        gridTemplateColumns: hero ? "180px 1fr" : undefined,
        flexDirection: "column",
        gap: hero ? 20 : 12,
        alignItems: hero ? "center" : undefined,
      }}
    >
      <div
        style={{
          width: hero ? 160 : "100%",
          height: hero ? 200 : 140,
          borderRadius: 12,
          background: `
            linear-gradient(160deg, ${characterTint}aa, ${COLORS.bg_void} 70%),
            repeating-linear-gradient(45deg, transparent, transparent 8px, rgba255,255,255,0.03} 8px, rgba255,255,255,0.03} 16px)
          `,
          border: `1px solid ${COLORS.gold}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `inset 0 0 40px ${COLORS.gold}22`,
        }}
      >
        <span
          style={{
            font: `700 ${hero ? 22 : 16}px ${TYPOGRAPHY.display}`,
            color: COLORS.gold_glow,
            textAlign: "center",
            padding: 12,
            textShadow: `0 0 20px ${COLORS.gold}`,
          }}
        >
          {sku.name.split(" ")[0]}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <h3
            style={{
              margin: 0,
              font: `700 ${hero ? 26 : 18}px ${TYPOGRAPHY.display}`,
              color: COLORS.text_primary,
            }}
          >
            {sku.name}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              font: `400 13px ${TYPOGRAPHY.ui}`,
              color: COLORS.text_secondary,
            }}
          >
            {sku.description}
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            font: `600 12px ${TYPOGRAPHY.ui}`,
            color: COLORS.gold,
            letterSpacing: "0.04em",
          }}
        >
          4C · 2R · 1E/L · ?
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingTop: 8,
          }}
        >
          <span
            style={{
              font: `700 20px ${TYPOGRAPHY.ui}`,
              color: canAfford ? COLORS.gold : COLORS.red_glow,
            }}
          >
            {sku.priceCredits} 🪙
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={handleBuy}
            style={{
              padding: hero ? "12px 22px" : "10px 16px",
              borderRadius: 10,
              border: "none",
              cursor: busy ? "wait" : "pointer",
              font: `700 13px ${TYPOGRAPHY.ui}`,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: COLORS.bg_void,
              background: canAfford
                ? `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.gold_glow})`
                : COLORS.bg_glass,
              opacity: busy ? 0.7 : 1,
              boxShadow: canAfford ? `0 0 20px ${COLORS.gold}44` : "none",
            }}
          >
            {busy ? "…" : canAfford ? "Купить и открыть" : "Не хватает"}
          </button>
        </div>
        {!canAfford && (
          <p
            style={{
              margin: 0,
              font: `500 12px ${TYPOGRAPHY.ui}`,
              color: COLORS.red_glow,
            }}
          >
            Нужно ещё {sku.priceCredits - credits} credits
          </p>
        )}
      </div>
    </motion.div>
  );
}
