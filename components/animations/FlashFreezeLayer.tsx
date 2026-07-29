"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAbilityAnimationStore } from "@/lib/animations/store";

export function FlashFreezeLayer() {
  const freezeActive = useAbilityAnimationStore((s) => s.freezeActive);
  const flashActive = useAbilityAnimationStore((s) => s.flashActive);
  const flashColor = useAbilityAnimationStore((s) => s.flashColor);
  const flashIntensity = useAbilityAnimationStore((s) => s.flashIntensity);
  const screenDarkness = useAbilityAnimationStore((s) => s.screenDarkness);
  const isAnimationLocked = useAbilityAnimationStore(
    (s) => s.isAnimationLocked,
  );

  return (
    <>
      {/* Input lock while cinematic plays */}
      {isAnimationLocked && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "auto",
            zIndex: 1,
            cursor: "wait",
          }}
          aria-hidden
        />
      )}

      <motion.div
        animate={{ opacity: screenDarkness }}
        transition={{ duration: 0.08, ease: "easeIn" }}
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      <AnimatePresence>
        {freezeActive && (
          <motion.div
            key="freeze"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "grayscale(0.6) contrast(1.15)",
              pointerEvents: "none",
              zIndex: 3,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flashActive && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: flashIntensity }}
            exit={{
              opacity: 0,
              transition: { duration: 0.3, ease: "easeOut" },
            }}
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center,
                ${flashColor} 0%,
                ${flashColor}88 40%,
                transparent 70%)`,
              pointerEvents: "none",
              zIndex: 4,
              mixBlendMode: "screen",
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flashActive && (
          <motion.div
            key="border-flash"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              transition: { duration: 0.12, times: [0, 0.3, 1] },
            }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              border: `4px solid ${flashColor}`,
              boxSizing: "border-box",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
