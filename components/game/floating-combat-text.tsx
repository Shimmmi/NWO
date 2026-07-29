"use client";

import { motion, AnimatePresence } from "framer-motion";

interface FloatingCombatTextProps {
  value: number;
  kind: "damage" | "heal" | "block" | "energy";
  side: "left" | "right";
}

const kindStyles = {
  damage: "text-red-400",
  heal: "text-green-400",
  block: "text-blue-400",
  energy: "text-yellow-400",
};

const kindPrefix = {
  damage: "-",
  heal: "+",
  block: "🛡",
  energy: "⚡",
};

export function FloatingCombatText({
  value,
  kind,
  side,
}: FloatingCombatTextProps) {
  return (
    <AnimatePresence>
      <motion.span
        key={`${kind}-${value}-${side}`}
        className={`pointer-events-none absolute top-8 z-20 text-2xl font-black ${kindStyles[kind]} ${side === "left" ? "left-1/4" : "right-1/4"}`}
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 0, y: -40, scale: 1.2 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        {kindPrefix[kind]}
        {value}
      </motion.span>
    </AnimatePresence>
  );
}
