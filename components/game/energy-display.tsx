"use client";

import { motion } from "framer-motion";
import { COLORS } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface EnergyDisplayProps {
  current: number;
  max: number;
  className?: string;
}

export function EnergyDisplay({ current, max, className }: EnergyDisplayProps) {
  const filled = Math.max(0, Math.min(current, max));

  return (
    <div className={cn("flex items-center gap-1.5 font-ui", className)}>
      {Array.from({ length: Math.max(0, max) }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <motion.div
            key={i}
            animate={{
              scale: isFilled ? [1, 1.15, 1] : 1,
              opacity: isFilled ? 1 : 0.25,
            }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="h-6 w-6 shrink-0 rounded-full"
            style={{
              background: isFilled
                ? "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)"
                : "radial-gradient(circle, #333, #1A1A1A)",
              border: isFilled
                ? "1.5px solid rgba(255,215,0,0.6)"
                : "1.5px solid #444",
              boxShadow: isFilled
                ? "0 0 8px rgba(255,215,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
                : "none",
            }}
          />
        );
      })}
      <span
        className="ml-1 text-base font-bold tabular-nums"
        style={{ color: COLORS.gold }}
      >
        {current}/{max}
      </span>
    </div>
  );
}
