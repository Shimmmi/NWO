"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Gauge, Zap } from "lucide-react";
import type { AbilityCard } from "@/lib/game/types";
import { inferCardCategory } from "@/lib/game/cards";
import {
  getCardArtUrl,
  getCardFallbackUrl,
  getRarityBorderClass,
  getRarityLabel,
} from "@/lib/game/art";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS = {
  attack: "Атака",
  defense: "Защита",
  support: "Поддержка",
} as const;

interface CardPreviewPopoverProps {
  card: AbilityCard;
  children: ReactNode;
}

export function CardPreviewPopover({
  card,
  children,
}: CardPreviewPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [src, setSrc] = useState(getCardArtUrl(card.id, card.rarity));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const category = inferCardCategory(card);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    clearTimer();
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: Math.min(rect.left, window.innerWidth - 300),
      y: Math.max(8, rect.top - 320),
    });
    timerRef.current = setTimeout(() => setVisible(true), 1000);
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
              "fixed z-50 w-[280px] overflow-hidden rounded-xl border-2 bg-zinc-900 shadow-2xl",
              getRarityBorderClass(card.rarity),
            )}
            style={{ left: position.x, top: position.y }}
          >
            <div className="relative h-[200px] w-full">
              <Image
                src={src}
                alt={card.name}
                fill
                className="object-cover"
                onError={() => setSrc(getCardFallbackUrl(card.rarity))}
                unoptimized
              />
            </div>
            <div className="space-y-2 p-3">
              <p className="text-base font-bold text-zinc-100">{card.name}</p>
              <p className="text-sm text-zinc-300">{card.description}</p>
              {card.flavorText && (
                <p className="text-xs italic text-zinc-500">{card.flavorText}</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-yellow-400">
                  <Zap className="h-3 w-3" />
                  {card.cost}
                </span>
                <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-zinc-300">
                  <Gauge className="h-3 w-3" />
                  {card.speed}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
                  {CATEGORY_LABELS[category]}
                </span>
                <span className="rounded bg-zinc-800 px-2 py-1 capitalize text-zinc-400">
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
