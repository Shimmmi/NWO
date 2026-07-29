"use client";

import { motion } from "framer-motion";
import type { AbilityCard } from "@/lib/game/types";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { cn } from "@/lib/utils";

interface BattlefieldZoneProps {
  p1Card: AbilityCard | null;
  p2Card: AbilityCard | null;
  revealed: boolean;
  myPlayerNum: 1 | 2;
  className?: string;
}

function CardSlot({
  card,
  revealed,
  label,
  flipDelay = 0,
}: {
  card: AbilityCard | null;
  revealed: boolean;
  label: string;
  flipDelay?: number;
}) {
  if (!card) {
    return (
      <div className="flex h-36 w-28 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">{label}</span>
        <span className="mt-1 text-[10px] text-zinc-600">ожидание</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1" style={{ perspective: "800px" }}>
      <span className="text-xs text-zinc-500">{label}</span>
      <motion.div
        className="relative h-36 w-28"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.6, delay: flipDelay }}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute inset-0 rounded-lg border-2 border-zinc-600 bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex h-full items-center justify-center">
            <span className="text-2xl font-black tracking-widest text-zinc-500/60">
              WO
            </span>
          </div>
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <AbilityCardView card={card} variant="compact" className="h-full w-full" />
        </div>
      </motion.div>
    </div>
  );
}

export function BattlefieldZone({
  p1Card,
  p2Card,
  revealed,
  myPlayerNum,
  className,
}: BattlefieldZoneProps) {
  const myCard = myPlayerNum === 1 ? p1Card : p2Card;
  const oppCard = myPlayerNum === 1 ? p2Card : p1Card;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-8 rounded-lg border border-zinc-700/40 bg-black/30 py-4",
        className,
      )}
    >
      <CardSlot
        card={oppCard}
        revealed={revealed}
        label="Соперник"
        flipDelay={0.1}
      />
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-600">
        Раунд
      </span>
      <CardSlot
        card={myCard}
        revealed={revealed}
        label="Вы"
        flipDelay={0}
      />
    </div>
  );
}
