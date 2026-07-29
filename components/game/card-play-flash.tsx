"use client";

import { motion, AnimatePresence } from "framer-motion";

interface CardPlayFlashProps {
  cardName: string;
  visible: boolean;
}

export function CardPlayFlash({ cardName, visible }: CardPlayFlashProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ duration: 0.3 }}
        >
          <div className="rounded-lg border border-zinc-500 bg-black/80 px-4 py-2 text-sm font-medium text-zinc-100 shadow-lg">
            {cardName}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
