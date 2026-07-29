"use client";

import { motion, AnimatePresence } from "framer-motion";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import type { BoosterSku } from "@/lib/shop/catalog";
import type { OpeningPhase } from "@/lib/stores/openingStore";

/** Pack-only 2D fallback (tier 0 / reduced motion). Reveals use OpeningCardFan. */
export function OpeningFallback2D({
  sku,
  phase,
}: {
  sku: BoosterSku;
  phase: OpeningPhase;
}) {
  const showPack =
    phase === "purchase_handoff" ||
    phase === "pack_present" ||
    phase === "tear_rip";

  if (!showPack) return null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 50% 40%, ${COLORS.gold}22, ${COLORS.bg_void})`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <AnimatePresence>
        <motion.div
          key="pack"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: phase === "tear_rip" ? [1, 1.05, 0.9] : 1,
            opacity: 1,
            rotate: phase === "tear_rip" ? [0, -3, 3, 0] : 0,
          }}
          exit={{ opacity: 0, scale: 1.2 }}
          style={{
            width: 160,
            height: 220,
            borderRadius: 12,
            background: `linear-gradient(160deg, ${COLORS.gold}, ${COLORS.bg_card})`,
            border: `2px solid ${COLORS.gold_glow}`,
            boxShadow: `0 0 40px ${COLORS.gold}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `700 18px ${TYPOGRAPHY.display}`,
            color: COLORS.bg_void,
            textAlign: "center",
            padding: 12,
          }}
        >
          {sku.name}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
