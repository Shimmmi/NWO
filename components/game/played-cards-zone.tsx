"use client";

import type { PlayedCard } from "@/lib/game/types";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { cn } from "@/lib/utils";

interface PlayedCardsZoneProps {
  cards: PlayedCard[];
  highlightCardName?: string | null;
  /** Local player's match seat — mirrors BattleArena fighter sides. */
  myPlayerNum?: 1 | 2;
}

function Cluster({
  label,
  cards,
  highlightCardName,
  align,
}: {
  label: string;
  cards: PlayedCard[];
  highlightCardName?: string | null;
  align: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[4rem] min-w-0 flex-1 flex-col gap-1.5",
        align === "left" ? "items-start" : "items-end",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div
        className={cn(
          "flex flex-wrap gap-2",
          align === "left" ? "justify-start" : "justify-end",
        )}
      >
        {cards.map((played, i) => {
          const isActive = highlightCardName === played.card.name;
          return (
            <div
              key={`${played.card.id}-${played.playerNum}-${i}`}
              className={cn(
                "relative transition-all duration-300",
                isActive &&
                  "z-10 scale-125 ring-2 ring-amber-400 shadow-lg shadow-amber-500/30",
              )}
            >
              <AbilityCardView card={played.card} variant="compact" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlayedCardsZone({
  cards,
  highlightCardName,
  myPlayerNum = 1,
}: PlayedCardsZoneProps) {
  if (cards.length === 0) return null;

  // Match BattleArena: P1 → player left / opp right; P2 → player right / opp left
  const playerSide: "left" | "right" = myPlayerNum === 1 ? "left" : "right";
  const oppNum: 1 | 2 = myPlayerNum === 1 ? 2 : 1;

  const mine = cards.filter((c) => c.playerNum === myPlayerNum);
  const theirs = cards.filter((c) => c.playerNum === oppNum);

  const leftCards = playerSide === "left" ? mine : theirs;
  const rightCards = playerSide === "right" ? mine : theirs;
  const leftLabel = playerSide === "left" ? "Вы" : "Соперник";
  const rightLabel = playerSide === "right" ? "Вы" : "Соперник";

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-black/40 p-3 backdrop-blur-sm">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400">
        Сыграно в этом ходу
      </p>
      <div className="flex items-start justify-between gap-4">
        <Cluster
          label={leftLabel}
          cards={leftCards}
          highlightCardName={highlightCardName}
          align="left"
        />
        <Cluster
          label={rightLabel}
          cards={rightCards}
          highlightCardName={highlightCardName}
          align="right"
        />
      </div>
    </div>
  );
}
