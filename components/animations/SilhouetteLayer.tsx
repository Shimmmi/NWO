"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { CHARACTER_TITLES } from "@/lib/animations/cardDisplayNames";
import { getCharacterPortraitUrl } from "@/lib/game/art";

export function SilhouetteLayer() {
  const config = useAbilityAnimationStore((s) => s.silhouetteConfig);

  return (
    <AnimatePresence>
      {config && (
        <motion.div
          key="silhouette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9150,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg,
              ${config.backgroundColor} 0%,
              ${config.secondaryColor} 100%)`,
          }}
        >
          <motion.div
            initial={{ scale: 1.4, x: "-40%", opacity: 0 }}
            animate={{ scale: 1, x: "0%", opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{
              position: "relative",
              width: "min(42vh, 280px)",
              height: "min(63vh, 420px)",
            }}
          >
            {/* Color silhouette via CSS filter */}
            <img
              src={getCharacterPortraitUrl(config.characterId, 3)}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "brightness(0) invert(0)",
                opacity: 0.95,
                mixBlendMode: "multiply",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(ellipse at center,
                  ${config.secondaryColor}55 0%,
                  transparent 70%)`,
                mixBlendMode: "screen",
              }}
            />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            style={{
              position: "absolute",
              bottom: "18%",
              font: "700 18px var(--font-ui), Rajdhani, sans-serif",
              letterSpacing: "0.35em",
              color: "#fff",
              textShadow: `0 0 20px ${config.backgroundColor}`,
            }}
          >
            {CHARACTER_TITLES[config.characterId] ?? config.characterId}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
