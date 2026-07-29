"use client";

import { useEffect, useRef, useState } from "react";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { useShopStore } from "@/lib/stores/shopStore";

export function WalletHud() {
  const credits = useShopStore((s) => s.credits);
  const [display, setDisplay] = useState(credits);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(credits);

  useEffect(() => {
    if (credits === prev.current) return;
    const dir = credits > prev.current ? "up" : "down";
    setFlash(dir);
    prev.current = credits;

    const start = display;
    const delta = credits - start;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 420);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const clear = setTimeout(() => setFlash(null), 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        background: COLORS.bg_card,
        border: `1px solid ${
          flash === "up"
            ? COLORS.gold_glow
            : flash === "down"
              ? COLORS.red_hot
              : "rgba(255,255,255,0.1)"
        }`,
        boxShadow:
          flash === "up"
            ? `0 0 18px ${COLORS.gold}55`
            : flash === "down"
              ? `0 0 14px ${COLORS.red_hot}44`
              : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden>
        🪙
      </span>
      <span
        style={{
          font: `700 22px ${TYPOGRAPHY.ui}`,
          color: flash === "down" ? COLORS.red_glow : COLORS.gold,
          minWidth: 64,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display.toLocaleString("ru-RU")}
      </span>
    </div>
  );
}
