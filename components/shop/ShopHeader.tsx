"use client";

import Link from "next/link";
import { toast } from "sonner";
import { WalletHud } from "@/components/shop/WalletHud";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { useShopStore } from "@/lib/stores/shopStore";

export function ShopHeader() {
  const claimDaily = useShopStore((s) => s.claimDaily);

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
            padding: "8px 14px",
            borderRadius: 8,
            border: `1px solid ${COLORS.gold}55`,
            background: "transparent",
            color: COLORS.gold,
            font: `600 13px ${TYPOGRAPHY.ui}`,
            cursor: "pointer",
          }}
        >
          Daily
        </button>
        <WalletHud />
      </div>
    </header>
  );
}
