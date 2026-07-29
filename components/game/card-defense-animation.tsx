"use client";

import { motion } from "framer-motion";
import { Shield } from "lucide-react";

interface CardDefenseAnimationProps {
  visible: boolean;
  side?: "left" | "right";
}

export function CardDefenseAnimation({
  visible,
  side = "left",
}: CardDefenseAnimationProps) {
  if (!visible) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute top-1/3 flex h-20 w-20 -translate-x-1/2 items-center justify-center rounded-full border-2 border-blue-400/80 bg-blue-500/20"
        style={{ left: side === "left" ? "25%" : "75%" }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{
          scale: [0.5, 1.3, 1],
          opacity: [0, 1, 0.6],
          boxShadow: [
            "0 0 0 rgba(59,130,246,0)",
            "0 0 30px rgba(59,130,246,0.8)",
            "0 0 10px rgba(59,130,246,0.4)",
          ],
        }}
        transition={{ duration: 0.6 }}
      >
        <Shield className="h-10 w-10 text-blue-300" />
      </motion.div>
    </motion.div>
  );
}
