"use client";

import Link from "next/link";
import { toast } from "sonner";
import { WalletHud } from "@/components/shop/WalletHud";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { ECONOMY } from "@/lib/shop/economy";
import { useShopStore } from "@/lib/stores/shopStore";

export function ShopHeader() {
  const claimDaily = useShopStore((s) => s.claimDaily);
  const dailyAvailable = useShopStore((s) => s.dailyAvailable);

  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        borderBottom: "1px solid rgba(212,175,55,0.18)",
        background: "rgba(8,8,15,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Link
          href="/"
          style={{
            font: `700 18px ${TYPOGRAPHY.display}`,
            color: COLORS.gold,
            textDecoration: "none",
            letterSpacing: "0.06em",
          }}
        >
          WORLD ORDER
        </Link>
        <span
          style={{
            font: `600 13px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          Shop
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={async () => {
            const ok = await claimDaily();
            toast[ok ? "success" : "message"](
              ok ? "Ежедневный бонус получен" : "Уже получено сегодня",
            );
          }}
          style={{
            position: "relative",
            padding: "8px 14px",
            borderRadius: 8,
            border: dailyAvailable
              ? `1px solid ${COLORS.gold}`
              : `1px solid rgba(255,255,255,0.12)`,
            background: dailyAvailable
              ? `linear-gradient(135deg, ${COLORS.gold}33, ${COLORS.gold}11)`
              : "transparent",
            color: dailyAvailable ? COLORS.gold_glow : COLORS.text_secondary,
            font: `600 13px ${TYPOGRAPHY.ui}`,
            cursor: "pointer",
            boxShadow: dailyAvailable
              ? `0 0 18px ${COLORS.gold}55, 0 0 4px ${COLORS.gold}`
              : "none",
            animation: dailyAvailable ? "nwo-daily-pulse 1.6s ease-in-out infinite" : "none",
            opacity: dailyAvailable ? 1 : 0.55,
          }}
        >
          {dailyAvailable ? `Daily +${ECONOMY.DAILY_GRANT_CREDITS}` : "Получено"}
        </button>
        <style>{`
          @keyframes nwo-daily-pulse {
            0%, 100% { box-shadow: 0 0 10px ${COLORS.gold}44, 0 0 2px ${COLORS.gold}; }
            50% { box-shadow: 0 0 24px ${COLORS.gold}88, 0 0 8px ${COLORS.gold_glow}; }
          }
        `}</style>
        <WalletHud />
      </div>
    </header>
  );
}
