"use client";

import type { PlayedCard } from "@/lib/game/types";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { cn } from "@/lib/utils";

interface PlayedCardsZoneProps {
  cards: PlayedCard[];
  highlightCardName?: string | null;
}

export function PlayedCardsZone({
  cards,
  highlightCardName,
}: PlayedCardsZoneProps) {
  if (cards.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-black/40 p-3 backdrop-blur-sm">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400">
        Сыграно в этом ходу
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {cards.map((played, i) => {
          const isActive = highlightCardName === played.card.name;
          return (
            <div
              key={`${played.card.id}-${played.playerNum}-${i}`}
              className={cn(
                "relative transition-all duration-300",
                isActive && "z-10 scale-125 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30",
              )}
            >
              <AbilityCardView card={played.card} variant="compact" />
              <span className="absolute -right-1 -top-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                P{played.playerNum}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
