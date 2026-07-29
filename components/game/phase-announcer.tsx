"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { GamePhase } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export const PHASE_TEXT: Record<
  GamePhase,
  { ru: string; color: string; size: "hero" | "xl" }
> = {
  energy_recovery: { ru: "ВОССТАНОВЛЕНИЕ", color: "#FFD700", size: "hero" },
  card_draw: { ru: "ДОБОР КАРТ", color: "#4A90D9", size: "hero" },
  ability: { ru: "ФАЗА СПОСОБНОСТЕЙ", color: "#9B59B6", size: "hero" },
  battle: { ru: "БИТВА!", color: "#E8372C", size: "hero" },
  end_turn: { ru: "КОНЕЦ ХОДА", color: "#8A9BA8", size: "xl" },
};

interface PhaseAnnouncerProps {
  phase: GamePhase;
  visible: boolean;
  className?: string;
}

export function PhaseAnnouncer({
  phase,
  visible,
  className,
}: PhaseAnnouncerProps) {
  const config = PHASE_TEXT[phase];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={phase}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.3, y: -30 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "pointer-events-none absolute inset-0 z-[100] flex items-center justify-center",
            className,
          )}
        >
          <div
            className="rounded-xl px-10 py-4 backdrop-blur-md"
            style={{
              background: "rgba(0,0,0,0.7)",
              border: `2px solid ${config.color}44`,
            }}
          >
            <div
              className="font-display font-black uppercase tracking-[0.25em]"
              style={{
                fontSize: config.size === "hero" ? 42 : 28,
                color: config.color,
                textShadow: `0 0 30px ${config.color}`,
              }}
            >
              {config.ru}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
