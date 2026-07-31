"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Gauge } from "lucide-react";
import type { AbilityCard } from "@/lib/game/types";
import {
  getCardArtUrl,
  getCardFallbackUrl,
  getRarityBorderClass,
  getRarityLabel,
} from "@/lib/game/art";
import { COLORS } from "@/lib/design/tokens";
import { CardPreviewPopover } from "@/components/game/card-preview-popover";
import { cn } from "@/lib/utils";

type CardVariant = "compact" | "hand" | "editor";

const RARITY_CONFIG: Record<
  AbilityCard["rarity"],
  { color: string; glow: string; border: string }
> = {
  common: {
    color: COLORS.rarity_common,
    glow: "none",
    border: `1px solid ${COLORS.rarity_common}`,
  },
  rare: {
    color: COLORS.rarity_rare,
    glow: `0 0 12px ${COLORS.rarity_rare}`,
    border: `1px solid ${COLORS.rarity_rare}`,
  },
  epic: {
    color: COLORS.rarity_epic,
    glow: `0 0 18px ${COLORS.rarity_epic}`,
    border: `1px solid ${COLORS.rarity_epic}`,
  },
  legendary: {
    color: COLORS.rarity_legendary,
    glow: `0 0 24px ${COLORS.rarity_legendary}`,
    border: `2px solid ${COLORS.rarity_legendary}`,
  },
};

interface AbilityCardViewProps {
  card: AbilityCard;
  variant?: CardVariant;
  selected?: boolean;
  disabled?: boolean;
  isPlayable?: boolean;
  playerEnergy?: number;
  onClick?: () => void;
  className?: string;
}

export function AbilityCardView({
  card,
  variant = "editor",
  selected = false,
  disabled = false,
  isPlayable,
  playerEnergy,
  onClick,
  className,
}: AbilityCardViewProps) {
  const [src, setSrc] = useState(getCardArtUrl(card.id, card.rarity));
  const fallback = getCardFallbackUrl(card.rarity);
  const isInteractive = !!onClick;
  const rarity = RARITY_CONFIG[card.rarity];

  const canPlay =
    isPlayable !== undefined
      ? isPlayable
      : playerEnergy !== undefined
        ? playerEnergy >= card.cost
        : !disabled;

  if (variant === "hand") {
    return (
      <HandCard
        card={card}
        src={src}
        onSrcError={() => setSrc(fallback)}
        selected={selected}
        disabled={disabled}
        canPlay={canPlay}
        rarity={rarity}
        isInteractive={isInteractive}
        onClick={onClick}
        className={className}
      />
    );
  }

  const artHeight = variant === "compact" ? "h-14" : "h-28";

  const content = (
    <>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-t-md",
          artHeight,
        )}
      >
        <Image
          src={src}
          alt={card.name}
          fill
          className="object-cover"
          onError={() => setSrc(fallback)}
          unoptimized
        />
        <div className="absolute left-1 top-1 flex gap-1">
          <span className="flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-yellow-400">
            <Zap className="h-3 w-3" />
            {card.cost}
          </span>
          <span className="flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-zinc-300">
            <Gauge className="h-3 w-3" />
            {card.speed}
          </span>
        </div>
      </div>
      <div className="p-2">
        <p
          className={cn(
            "font-medium leading-tight",
            variant === "compact" ? "text-xs" : "text-sm",
          )}
        >
          {card.name}
        </p>
        {variant !== "compact" && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {card.description}
          </p>
        )}
        {variant === "editor" && (
          <p className="mt-1 text-xs capitalize text-zinc-500">
            {getRarityLabel(card.rarity)} · {card.type}
          </p>
        )}
      </div>
    </>
  );

  const baseClass = cn(
    "overflow-hidden rounded-lg border-2 bg-zinc-900 text-left transition-all",
    getRarityBorderClass(card.rarity),
    selected && "ring-2 ring-zinc-300 bg-zinc-800",
    disabled && "opacity-40 cursor-not-allowed",
    !disabled && isInteractive && "hover:bg-zinc-800/80 hover:-translate-y-1",
    variant === "editor" && "w-full",
    variant === "compact" && "w-24",
    className,
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={baseClass}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}

function HandCard({
  card,
  src,
  onSrcError,
  selected,
  disabled,
  canPlay,
  rarity,
  isInteractive,
  onClick,
  className,
}: {
  card: AbilityCard;
  src: string;
  onSrcError: () => void;
  selected: boolean;
  disabled: boolean;
  canPlay: boolean;
  rarity: (typeof RARITY_CONFIG)[AbilityCard["rarity"]];
  isInteractive: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const unaffordable = !canPlay || disabled;

  const cardBody = (
    <motion.button
      type="button"
      disabled={disabled || !isInteractive}
      onClick={onClick}
      whileHover={
        !unaffordable
          ? { y: -8, scale: 1.04 }
          : undefined
      }
      whileTap={!unaffordable ? { scale: 0.97 } : undefined}
      animate={{
        y: selected ? -16 : 0,
        scale: selected ? 1.06 : 1,
        filter: selected
          ? `drop-shadow(0 0 16px ${rarity.color})`
          : unaffordable
            ? "grayscale(0.6) brightness(0.7)"
            : "none",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative flex w-[140px] shrink-0 flex-col overflow-hidden rounded-xl text-left md:w-[160px]",
        "h-[218px] md:h-[248px]",
        unaffordable ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      style={{
        background: `linear-gradient(160deg, ${COLORS.bg_card} 0%, #1A1C2A 100%)`,
        border: selected ? `2px solid ${rarity.color}` : rarity.border,
        boxShadow: selected
          ? rarity.glow
          : "0 4px 20px rgba(0,0,0,0.6)",
      }}
    >
      {card.rarity === "legendary" && (
        <div
          className="pointer-events-none absolute inset-0 animate-pulse"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(230,126,34,0.15), transparent 70%)",
          }}
        />
      )}

      <div
        className="absolute left-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/20 font-ui text-lg font-bold"
        style={{
          background: canPlay && !disabled
            ? "radial-gradient(circle, #FFD700, #B8860B)"
            : "radial-gradient(circle, #555, #333)",
          boxShadow:
            canPlay && !disabled
              ? "0 0 12px rgba(255,215,0,0.6)"
              : "none",
          color: canPlay && !disabled ? "#1A0000" : "#888",
        }}
        aria-label={`Стоимость ${card.cost}`}
      >
        {card.cost}
      </div>

      <div
        className="absolute right-2 top-2 z-10 flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-full border-2 border-white/20 px-1.5 font-ui text-sm font-bold"
        style={{
          background: canPlay && !disabled
            ? "radial-gradient(circle at 35% 35%, #7DD3FC, #0369A1)"
            : "radial-gradient(circle, #555, #333)",
          boxShadow:
            canPlay && !disabled
              ? "0 0 12px rgba(56,189,248,0.5)"
              : "none",
          color: canPlay && !disabled ? "#F0F9FF" : "#888",
        }}
        aria-label={`Скорость ${card.speed}`}
      >
        <Gauge className="h-3.5 w-3.5" strokeWidth={2.5} />
        {card.speed}
      </div>

      <div className="relative mx-2 mt-2 h-[58%] overflow-hidden rounded-lg border border-white/10">
        <Image
          src={src}
          alt={card.name}
          fill
          className="object-cover"
          onError={onSrcError}
          unoptimized
        />
        <div
          className="absolute inset-x-0 bottom-0 h-10"
          style={{
            background: `linear-gradient(transparent, ${COLORS.bg_card})`,
          }}
        />
      </div>

      <div
        className="mx-2 my-1.5 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
        }}
      />

      <div className="px-2.5 pb-1 text-center">
        <p
          className="font-display text-[12px] leading-tight tracking-wide md:text-[13px]"
          style={{
            color: COLORS.text_primary,
            textShadow: `0 0 8px ${rarity.color}`,
          }}
        >
          {card.name}
        </p>
        <p
          className="font-body mt-0.5 line-clamp-2 text-[11px] leading-snug md:text-xs"
          style={{ color: COLORS.text_secondary }}
        >
          {card.description}
        </p>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
        }}
      />

      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${rarity.color}22, transparent)`,
          }}
        />
      )}
    </motion.button>
  );

  return <CardPreviewPopover card={card}>{cardBody}</CardPreviewPopover>;
}
