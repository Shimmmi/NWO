"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { MatchPlayer } from "@/lib/game/types";
import { FORM_STATS } from "@/lib/game/types";
import { getCharacterById } from "@/lib/data";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { COLORS } from "@/lib/design/tokens";
import { HPBar } from "@/components/game/hp-bar";
import { EnergyDisplay } from "@/components/game/energy-display";
import { StatusEffects } from "@/components/game/status-effects";
import { cn } from "@/lib/utils";

interface PlayerHudProps {
  player: MatchPlayer;
  label: string;
  align?: "left" | "right";
  showEnergy?: boolean;
  className?: string;
}

export function PlayerHud({
  player,
  label,
  align = "left",
  showEnergy = true,
  className,
}: PlayerHudProps) {
  const character = getCharacterById(player.characterId);
  const formStats = FORM_STATS[player.characterId]?.[player.currentForm - 1];
  const formName = formStats?.name ?? `Форма ${player.currentForm}`;
  const [portraitSrc, setPortraitSrc] = useState(
    getCharacterPortraitUrl(player.characterId, player.currentForm),
  );

  useEffect(() => {
    setPortraitSrc(
      getCharacterPortraitUrl(player.characterId, player.currentForm),
    );
  }, [player.characterId, player.currentForm]);

  return (
    <div
      className={cn(
        "rounded-lg border bg-black/60 p-3 backdrop-blur-sm font-ui",
        align === "right" && "text-right",
        className,
      )}
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        background: COLORS.bg_glass,
      }}
    >
      <div
        className={cn(
          "mb-2 flex items-center gap-3",
          align === "right" && "flex-row-reverse",
        )}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
          <Image
            src={portraitSrc}
            alt={character?.name ?? player.nickname}
            fill
            className="object-cover"
            onError={() =>
              setPortraitSrc(getCharacterPortraitUrl(player.characterId, 1))
            }
            unoptimized
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: COLORS.text_primary }}>
            {label}: {player.nickname}
          </p>
          <p className="truncate text-[11px]" style={{ color: COLORS.text_secondary }}>
            {character?.name ?? player.characterId} · {formName}
          </p>
        </div>
      </div>

      <HPBar hp={player.hp} maxHp={player.maxHp} armor={player.armor} />

      {showEnergy && (
        <div className={cn("mt-2", align === "right" && "flex justify-end")}>
          <EnergyDisplay current={player.energy} max={player.maxEnergy} />
        </div>
      )}

      <div className={cn("mt-2", align === "right" && "flex justify-end")}>
        <StatusEffects effects={player.activeEffects} />
      </div>
    </div>
  );
}
