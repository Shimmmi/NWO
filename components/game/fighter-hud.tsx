"use client";

import { useEffect, useRef } from "react";
import { Shield, Swords, Zap } from "lucide-react";
import type { MatchPlayer } from "@/lib/game/types";
import { getCharacterById } from "@/lib/data";
import { PileIndicator } from "@/components/game/pile-indicator";
import { HPBar } from "@/components/game/hp-bar";
import { StatusEffects } from "@/components/game/status-effects";
import { cn } from "@/lib/utils";

interface FighterHudProps {
  player: MatchPlayer;
  label: string;
  align?: "left" | "right";
  compact?: boolean;
  className?: string;
}

export function FighterHud({
  player,
  label,
  align = "left",
  compact = false,
  className,
}: FighterHudProps) {
  const character = getCharacterById(player.characterId);
  const prevEnergyRef = useRef(player.energy);
  const energyPulse =
    prevEnergyRef.current !== player.energy
      ? "animate-pulse bg-yellow-500/20 text-yellow-300"
      : "";

  useEffect(() => {
    prevEnergyRef.current = player.energy;
  }, [player.energy]);

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-700/80 bg-black/60 backdrop-blur-sm",
        compact ? "max-w-[220px] p-2" : "p-3",
        align === "right" && "text-right",
        className,
      )}
    >
      <div
        className={cn(
          "mb-2 flex items-center justify-between gap-2",
          align === "right" && "flex-row-reverse",
        )}
      >
        <div>
          <p className={cn("font-bold text-zinc-100", compact ? "text-xs" : "text-sm")}>
            {label}: {player.nickname}
          </p>
          {character && (
            <p className="text-[10px] text-zinc-400">
              {character.name} · Ф{player.currentForm} · ⚡{player.charges}
            </p>
          )}
        </div>
        {!compact && (
          <div
            className={cn(
              "flex gap-2",
              align === "right" && "flex-row-reverse",
            )}
          >
            <PileIndicator count={player.deck.length} label="Колода" />
            <PileIndicator count={player.discardPile.length} label="Сброс" />
          </div>
        )}
      </div>

      <div className="mb-2">
        <HPBar hp={player.hp} maxHp={player.maxHp} armor={player.armor} />
      </div>

      <div
        className={cn(
          "grid grid-cols-3 gap-1 text-[10px]",
          align === "right" && "direction-rtl",
        )}
      >
        <div className="flex items-center gap-1 rounded bg-zinc-800/70 px-1.5 py-1">
          <Shield className="h-3 w-3 text-zinc-400" />
          {player.armor}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded bg-zinc-800/70 px-1.5 py-1 transition-colors",
            energyPulse,
          )}
        >
          <Zap className="h-3 w-3" />
          {player.energy}/{player.maxEnergy}
        </div>
        <div className="flex items-center gap-1 rounded bg-zinc-800/70 px-1.5 py-1">
          <Swords className="h-3 w-3 text-zinc-400" />
          {player.strength}
        </div>
      </div>

      {!compact && player.activeEffects.length > 0 && (
        <div className={cn("mt-2", align === "right" && "flex justify-end")}>
          <StatusEffects effects={player.activeEffects} />
        </div>
      )}

      {!compact && (
        <p className="mt-2 text-xs text-zinc-500">
          Рука: {player.hand.length} карт
        </p>
      )}
    </div>
  );
}
