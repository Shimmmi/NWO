"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/design/tokens";
import { offerRelics, type Relic } from "@/lib/game/relics";
import { cn } from "@/lib/utils";

interface RelicSelectProps {
  onSelect: (relicId: string) => void;
}

function RelicCard({
  relic,
  isSelected,
  onClick,
}: {
  relic: Relic;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -8, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "w-[200px] rounded-xl border p-5 text-left transition-shadow",
        isSelected ? "shadow-[0_0_24px_rgba(212,175,55,0.35)]" : "",
      )}
      style={{
        background: `linear-gradient(160deg, ${COLORS.bg_card} 0%, #1A1C2A 100%)`,
        borderColor: isSelected ? COLORS.gold : "rgba(255,255,255,0.12)",
      }}
    >
      <div className="mb-3 text-3xl">{relic.icon}</div>
      <div
        className="font-display text-base"
        style={{ color: COLORS.text_primary }}
      >
        {relic.name}
      </div>
      <p
        className="mt-2 font-body text-sm leading-snug"
        style={{ color: COLORS.text_secondary }}
      >
        {relic.description}
      </p>
      <p
        className="mt-3 font-body text-xs italic"
        style={{ color: COLORS.gold }}
      >
        «{relic.flavorText}»
      </p>
    </motion.button>
  );
}

export function RelicSelect({ onSelect }: RelicSelectProps) {
  const offered = useMemo(() => offerRelics(3), []);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-8 px-4"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      <h2
        className="font-display text-center text-3xl tracking-wide"
        style={{
          color: COLORS.gold,
          textShadow: `0 0 20px ${COLORS.gold_glow}`,
        }}
      >
        Выберите реликвию
      </h2>

      <div className="flex flex-wrap justify-center gap-6">
        {offered.map((relic) => (
          <RelicCard
            key={relic.id}
            relic={relic}
            isSelected={selected === relic.id}
            onClick={() => setSelected(relic.id)}
          />
        ))}
      </div>

      <Button
        size="lg"
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
        className="min-w-[200px] font-ui text-lg"
        style={{
          background: selected
            ? `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`
            : undefined,
          color: selected ? "#1A0000" : undefined,
        }}
      >
        В бой!
      </Button>
    </div>
  );
}
