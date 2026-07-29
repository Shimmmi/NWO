"use client";

import { motion } from "framer-motion";

interface CardAttackAnimationProps {
  visible: boolean;
  side?: "left" | "right";
}

export function CardAttackAnimation({
  visible,
  side = "left",
}: CardAttackAnimationProps) {
  if (!visible) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute top-1/2 h-16 w-24 rounded-md bg-red-600/80 shadow-lg shadow-red-500/50"
        style={{ left: side === "left" ? "20%" : "60%" }}
        initial={{ x: 0, scale: 1 }}
        animate={{
          x: side === "left" ? 120 : -120,
          scale: [1, 1.2, 0.9],
        }}
        transition={{ duration: 0.45 }}
      />
      <motion.div
        className="absolute inset-0 bg-red-500/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.4 }}
      />
    </motion.div>
  );
}
