"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Gauge } from "lucide-react";
import type { AbilityCard } from "@/lib/game/types";
import { inferCardCategory } from "@/lib/game/cards";
import {
  getCardArtUrl,
  getCardFallbackUrl,
  getRarityBorderClass,
  getRarityLabel,
} from "@/lib/game/art";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS = {
  attack: "Атака",
  defense: "Защита",
  support: "Поддержка",
} as const;

const PREVIEW_W = 240;
const PREVIEW_H = 360; // 2:3 portrait

interface CardPreviewPopoverProps {
  card: AbilityCard;
  children: ReactNode;
  /** Hover delay ms — battle hand uses longer; opening can pass 150 */
  delayMs?: number;
}

export function CardPreviewPopover({
  card,
  children,
  delayMs = 1000,
}: CardPreviewPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [src, setSrc] = useState(getCardArtUrl(card.id, card.rarity));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const category = inferCardCategory(card);

  useEffect(() => {
    setSrc(getCardArtUrl(card.id, card.rarity));
  }, [card.id, card.rarity]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    clearTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(
      Math.max(8, rect.left + rect.width / 2 - PREVIEW_W / 2),
      window.innerWidth - PREVIEW_W - 8,
    );
    const yAbove = rect.top - PREVIEW_H - 12;
    const y = yAbove >= 8 ? yAbove : Math.min(rect.bottom + 12, window.innerHeight - PREVIEW_H - 8);
    setPosition({ x, y });
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  };

  const handleLeave = () => {
    clearTimer();
    setVisible(false);
  };

  useEffect(() => () => clearTimer(), [clearTimer]);

  const popover =
    visible && typeof document !== "undefined"
      ? createPortal(
          <div
            className={cn(
              "fixed z-[99990] overflow-hidden rounded-xl border-2 bg-zinc-900 shadow-2xl",
              getRarityBorderClass(card.rarity),
            )}
            style={{
              left: position.x,
              top: position.y,
              width: PREVIEW_W,
              height: PREVIEW_H,
              display: "flex",
              flexDirection: "column",
              pointerEvents: "none",
            }}
          >
            <div className="relative w-full" style={{ flex: "1 1 72%", minHeight: 0 }}>
              <Image
                src={src}
                alt={card.name}
                fill
                className="object-cover"
                onError={() => setSrc(getCardFallbackUrl(card.rarity))}
                unoptimized
              />
              <div
                className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/25 font-bold"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)",
                  color: "#1A0000",
                  font: `900 16px ${TYPOGRAPHY.ui}`,
                  boxShadow: "0 0 12px rgba(255,215,0,0.6)",
                }}
              >
                {card.cost}
              </div>
              <div
                className="absolute right-2 top-2 z-10 flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-full border-2 border-white/25 px-1.5 font-bold"
                style={{
                  background: "radial-gradient(circle at 35% 35%, #7DD3FC, #0369A1)",
                  color: "#F0F9FF",
                  font: `800 14px ${TYPOGRAPHY.ui}`,
                  boxShadow: "0 0 12px rgba(56,189,248,0.5)",
                }}
              >
                <Gauge className="h-3.5 w-3.5" strokeWidth={2.5} />
                {card.speed}
              </div>
            </div>
            <div className="space-y-1.5 p-2.5" style={{ flexShrink: 0 }}>
              <p
                className="truncate text-sm font-bold"
                style={{ color: COLORS.text_primary }}
              >
                {card.name}
              </p>
              <p
                className="line-clamp-2 text-xs leading-snug"
                style={{ color: COLORS.text_secondary }}
              >
                {card.description}
              </p>
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 capitalize text-zinc-400">
                  {getRarityLabel(card.rarity)}
                </span>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {popover}
    </div>
  );
}
