"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AbilityCard } from "@/lib/game/types";
import { getRarityBorderClass } from "@/lib/game/art";
import { cn } from "@/lib/utils";

interface SkillCalloutProps {
  label: string;
  visible: boolean;
  side: "left" | "right";
  rarity?: AbilityCard["rarity"];
  className?: string;
}

export function SkillCallout({
  label,
  visible,
  side,
  rarity = "rare",
  className,
}: SkillCalloutProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            "pointer-events-none absolute z-30 max-w-[200px]",
            side === "left" ? "left-[8%]" : "right-[8%]",
            "top-[12%]",
            className,
          )}
          initial={{ opacity: 0, y: 12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.9 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className={cn(
              "rounded-lg border-2 bg-black/85 px-3 py-2 text-center shadow-xl backdrop-blur-sm",
              getRarityBorderClass(rarity),
            )}
          >
            <p className="text-sm font-bold leading-tight text-zinc-100">{label}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
