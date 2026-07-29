"use client";

import { useEffect } from "react";
import { motion, useSpring } from "framer-motion";
import { COLORS } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface HPBarProps {
  hp: number;
  maxHp: number;
  armor: number;
  showArmor?: boolean;
  className?: string;
}

function hpBarColor(ratio: number): string {
  if (ratio > 0.5) return `hsl(${120 * ratio * 2}, 70%, 45%)`;
  if (ratio > 0.25) return "hsl(60, 80%, 50%)";
  return "hsl(0, 85%, 50%)";
}

export function HPBar({
  hp,
  maxHp,
  armor,
  showArmor = true,
  className,
}: HPBarProps) {
  const safeMax = Math.max(1, maxHp);
  const ratio = Math.max(0, Math.min(1, hp / safeMax));
  const barColor = hpBarColor(ratio);

  const springHp = useSpring(ratio, { stiffness: 100, damping: 20 });
  const trailingRatio = useSpring(ratio, { stiffness: 40, damping: 15 });

  useEffect(() => {
    springHp.set(ratio);
    trailingRatio.set(ratio);
  }, [ratio, springHp, trailingRatio]);

  const segmentCount = Math.floor(safeMax / 25);

  return (
    <div className={cn("relative font-ui", className)}>
      <div
        className="relative h-3.5 overflow-hidden rounded-full border"
        style={{
          background: "#1A1A2E",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <motion.div
          className="absolute inset-0 origin-left"
          style={{
            background: "#555",
            scaleX: trailingRatio,
          }}
        />
        <motion.div
          className="absolute inset-0 origin-left"
          style={{
            background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
            scaleX: springHp,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        />
        {Array.from({ length: segmentCount }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-black/30"
            style={{ left: `${((i + 1) * 25) / safeMax * 100}%` }}
          />
        ))}
      </div>

      <div
        className="mt-0.5 flex justify-between text-[13px] font-semibold tabular-nums"
        style={{ color: barColor }}
      >
        <span>{Math.max(0, Math.round(hp))}</span>
        <span style={{ color: COLORS.text_secondary }}>/{maxHp}</span>
      </div>

      {showArmor && armor > 0 && (
        <div
          className="absolute -top-2 right-0 flex items-center gap-1 rounded px-1.5 py-px text-xs font-bold"
          style={{
            background: "#1A3A5C",
            border: "1px solid #4A90D9",
            color: "#88CCFF",
          }}
        >
          <span aria-hidden>🛡</span>
          {armor}
        </div>
      )}
    </div>
  );
}
