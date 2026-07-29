"use client";

import Image from "next/image";
import { useState } from "react";
import type { AbilityCard } from "@/lib/game/types";
import {
  getCardArtUrl,
  getCardFallbackUrl,
  getRarityBorderClass,
} from "@/lib/game/art";
import { cn } from "@/lib/utils";

interface CardArtProps {
  cardId: string;
  rarity: AbilityCard["rarity"];
  alt?: string;
  className?: string;
  fill?: boolean;
}

export function CardArt({ cardId, rarity, alt = "", className, fill = true }: CardArtProps) {
  const [src, setSrc] = useState(getCardArtUrl(cardId, rarity));
  const fallback = getCardFallbackUrl(rarity);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border",
        getRarityBorderClass(rarity),
        fill && "h-full w-full",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={fill ? undefined : 120}
        height={fill ? undefined : 80}
        className="object-cover"
        onError={() => setSrc(fallback)}
        unoptimized
      />
    </div>
  );
}
