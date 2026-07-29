"use client";

import Image from "next/image";
import { useState } from "react";
import { Heart } from "lucide-react";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { getCharacterById } from "@/lib/data";
import { FORM_STATS } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface CharacterPortraitProps {
  characterId: string;
  currentForm?: number;
  hp?: number;
  maxHp?: number;
  showHp?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  animateIdle?: boolean;
}

const sizeMap = {
  sm: { w: 80, h: 112, container: "w-20 h-28" },
  md: { w: 120, h: 168, container: "w-[120px] h-[168px]" },
  lg: { w: 160, h: 224, container: "w-40 h-56" },
};

export function CharacterPortrait({
  characterId,
  currentForm = 1,
  hp,
  maxHp,
  showHp = false,
  size = "md",
  className,
  animateIdle = false,
}: CharacterPortraitProps) {
  const character = getCharacterById(characterId);
  const formStats = FORM_STATS[characterId]?.[currentForm - 1];
  const formName = formStats?.name ?? `Форма ${currentForm}`;
  const [src, setSrc] = useState(getCharacterPortraitUrl(characterId, currentForm));
  const dims = sizeMap[size];
  const hpPercent = hp !== undefined && maxHp ? Math.max(0, (hp / maxHp) * 100) : 100;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border-2 border-zinc-700 bg-zinc-900 shadow-lg",
          dims.container,
          animateIdle && "animate-breathe",
        )}
      >
        <Image
          src={src}
          alt={character?.name ?? characterId}
          width={dims.w}
          height={dims.h}
          className="h-full w-full object-cover"
          onError={() => setSrc(getCharacterPortraitUrl(characterId, 1))}
          unoptimized
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-center">
          <p className="truncate text-xs font-medium text-zinc-200">{formName}</p>
        </div>
      </div>
      {showHp && hp !== undefined && maxHp !== undefined && (
        <div className="w-full max-w-[160px]">
          <div className="mb-0.5 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              HP
            </span>
            <span>
              {hp}/{maxHp}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
