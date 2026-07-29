"use client";

import { motion } from "framer-motion";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { getCardById } from "@/lib/data";
import { getCardBackUrl } from "@/lib/game/art";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import type { PackOpenResult } from "@/lib/shop/packRoll";
import type { OpeningPhase } from "@/lib/stores/openingStore";

const RARITY_GLOW: Record<string, string> = {
  common: "none",
  rare: `0 0 18px ${COLORS.rarity_rare}88`,
  epic: `0 0 22px ${COLORS.rarity_epic}99`,
  legendary: `0 0 28px ${COLORS.legendary}`,
};

function OpeningFlipCard({
  cardId,
  rarity,
  isNew,
  revealed,
  pulse,
}: {
  cardId: string;
  rarity: string;
  isNew: boolean;
  revealed: boolean;
  pulse: boolean;
}) {
  const card = getCardById(cardId);
  const backUrl = getCardBackUrl();

  return (
    <motion.div
      layout
      animate={{
        scale: pulse ? 1.08 : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      style={{
        width: 156,
        height: 248,
        perspective: 1000,
        flexShrink: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1)",
          transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          boxShadow: revealed ? RARITY_GLOW[rarity] ?? "none" : "0 8px 24px #000a",
          borderRadius: 12,
        }}
      >
        {/* Face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 12,
            overflow: "hidden",
            background: COLORS.bg_card,
          }}
        >
          {card ? (
            <AbilityCardView card={card} variant="editor" className="h-full !w-full" />
          ) : (
            <div
              style={{
                padding: 12,
                color: COLORS.text_primary,
                font: `600 13px ${TYPOGRAPHY.ui}`,
              }}
            >
              {cardId}
            </div>
          )}
          {revealed && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                zIndex: 4,
                padding: "3px 7px",
                borderRadius: 5,
                font: `700 10px ${TYPOGRAPHY.ui}`,
                letterSpacing: "0.06em",
                background: isNew ? COLORS.gold : "rgba(0,0,0,0.65)",
                color: isNew ? COLORS.bg_void : COLORS.text_secondary,
              }}
            >
              {isNew ? "NEW" : "DUP"}
            </span>
          )}
        </div>

        {/* Back (рубашка) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${COLORS.gold}55`,
            background: `url(${backUrl}) center/cover no-repeat, ${COLORS.bg_card}`,
          }}
        />
      </div>
    </motion.div>
  );
}

export function OpeningCardFan({
  result,
  phase,
  revealIndex,
}: {
  result: PackOpenResult;
  phase: OpeningPhase;
  revealIndex: number;
}) {
  const forceAll = phase === "summary" || phase === "exit";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px 100px",
        boxSizing: "border-box",
        background: `radial-gradient(circle at 50% 40%, ${COLORS.gold}18, transparent 55%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "center",
          alignItems: "flex-end",
          maxWidth: 1100,
        }}
      >
        {result.cards.map((c, i) => (
          <OpeningFlipCard
            key={`${c.slot}-${c.cardId}`}
            cardId={c.cardId}
            rarity={c.rarity}
            isNew={c.isNew}
            revealed={forceAll || i <= revealIndex}
            pulse={phase === "legendary_interrupt" && i === revealIndex}
          />
        ))}
      </div>
    </div>
  );
}
