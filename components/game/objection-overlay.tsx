"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AbilityCard } from "@/lib/game/types";

interface ObjectionOverlayProps {
  cardName: string;
  rarity: AbilityCard["rarity"];
  onDone?: () => void;
}

export function ObjectionOverlay({
  cardName,
  rarity,
  onDone,
}: ObjectionOverlayProps) {
  return (
    <AnimatePresence onExitComplete={onDone}>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          className="text-center"
          initial={{ scale: 0.5, skewX: -10, opacity: 0 }}
          animate={{ scale: [0.5, 1.2, 1], skewX: [-10, 5, 0], opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p
            className={
              rarity === "legendary"
                ? "text-5xl font-black uppercase tracking-wider text-yellow-400 md:text-7xl"
                : "text-4xl font-black uppercase tracking-wider text-purple-400 md:text-6xl"
            }
            style={{ textShadow: "4px 4px 0 #000" }}
          >
            {cardName}
          </p>
          <motion.p
            className="mt-4 text-xl font-bold uppercase text-white/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {rarity === "legendary" ? "Легендарная карта!" : "Эпическая карта!"}
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
