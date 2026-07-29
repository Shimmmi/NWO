"use client";

import { motion } from "framer-motion";

interface CardSupportAnimationProps {
  visible: boolean;
  side?: "left" | "right";
}

export function CardSupportAnimation({
  visible,
  side = "left",
}: CardSupportAnimationProps) {
  if (!visible) return null;

  const particles = Array.from({ length: 8 }, (_, i) => i);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {particles.map((i) => (
        <motion.span
          key={i}
          className="absolute h-2 w-2 rounded-full bg-amber-300"
          style={{
            left: side === "left" ? `${20 + (i % 4) * 5}%` : `${60 + (i % 4) * 5}%`,
            top: `${35 + Math.floor(i / 4) * 15}%`,
          }}
          initial={{ opacity: 0, y: 10, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            y: [-10, -40],
            scale: [0, 1.5, 0],
          }}
          transition={{ duration: 0.7, delay: i * 0.05 }}
        />
      ))}
      <motion.div
        className="absolute top-1/3 h-24 w-24 -translate-x-1/2 rounded-full bg-amber-400/10"
        style={{ left: side === "left" ? "25%" : "75%" }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.2] }}
        transition={{ duration: 0.8, repeat: 1 }}
      />
    </motion.div>
  );
}
