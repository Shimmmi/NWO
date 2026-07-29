"use client";

import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";

/** CTA-only footer — card grid removed; cards live in OpeningCardFan. */
export function OpeningSummary({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "20px 24px 52px",
        background: "linear-gradient(transparent, rgba(8,8,15,0.92) 35%)",
        zIndex: 5,
        textAlign: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onContinue}
        style={{
          padding: "12px 28px",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          font: `700 14px ${TYPOGRAPHY.ui}`,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.bg_void,
          background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.gold_glow})`,
          boxShadow: `0 0 24px ${COLORS.gold}55`,
        }}
      >
        В коллекцию
      </button>
    </div>
  );
}
