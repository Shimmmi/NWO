"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import {
  CHARACTER_TITLES,
  resolveCardDisplayName,
} from "@/lib/animations/cardDisplayNames";
import type {
  FullscreenSlamConfig,
  TextSlamConfig,
  TextSlamStyle,
} from "@/lib/animations/types";

const SLAM_VARIANTS: Record<
  Exclude<TextSlamStyle, "whisper">,
  {
    initial: Record<string, string | number>;
    animate: Record<string, string | number>;
    exit: Record<string, string | number>;
    transition: Record<string, unknown>;
  }
> = {
  objection: {
    initial: { x: "120%", scaleX: 1.4, opacity: 0 },
    animate: { x: "0%", scaleX: 1.0, opacity: 1 },
    exit: { x: "-30%", opacity: 0, scaleX: 0.8 },
    transition: { type: "spring", stiffness: 600, damping: 22 },
  },
  announce: {
    initial: { y: "-80px", scale: 0.6, opacity: 0 },
    animate: { y: "0px", scale: 1.0, opacity: 1 },
    exit: { y: "40px", scale: 0.8, opacity: 0 },
    transition: { type: "spring", stiffness: 500, damping: 18 },
  },
  impact: {
    initial: { scale: 3, opacity: 0, rotate: -5 },
    animate: { scale: 1, opacity: 1, rotate: 0 },
    exit: { scale: 0.5, opacity: 0 },
    transition: { type: "spring", stiffness: 800, damping: 25 },
  },
};

const FONT_EPIC =
  "900 52px var(--font-display), 'Cinzel Decorative', serif";
const FONT_LEGENDARY =
  "900 72px var(--font-display), 'Cinzel Decorative', serif";

export function TextSlamLayer() {
  const textSlamConfig = useAbilityAnimationStore((s) => s.textSlamConfig);
  const fullscreenSlamConfig = useAbilityAnimationStore(
    (s) => s.fullscreenSlamConfig,
  );

  return (
    <>
      <AnimatePresence>
        {textSlamConfig && <EpicTextSlam config={textSlamConfig} />}
      </AnimatePresence>
      <AnimatePresence>
        {fullscreenSlamConfig && (
          <LegendaryFullscreenSlam config={fullscreenSlamConfig} />
        )}
      </AnimatePresence>
    </>
  );
}

function EpicTextSlam({ config }: { config: TextSlamConfig }) {
  const styleKey =
    config.style === "whisper" ? "announce" : config.style;
  const variants = SLAM_VARIANTS[styleKey] ?? SLAM_VARIANTS.objection;
  const displayName = resolveCardDisplayName(config.text);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "22%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 9300,
      }}
    >
      <motion.div
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={variants.transition}
        style={{ position: "relative" }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          style={{
            position: "absolute",
            inset: 0,
            font: FONT_EPIC,
            color: "transparent",
            WebkitTextStroke: "6px rgba(0,0,0,0.8)",
            textAlign: "center",
            letterSpacing: "4px",
            textTransform: "uppercase",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </motion.div>

        <div
          style={{
            font: FONT_EPIC,
            color: config.color,
            textAlign: "center",
            letterSpacing: "4px",
            textTransform: "uppercase",
            textShadow: `
              0 0 20px ${config.color},
              0 0 40px ${config.color}88,
              0 4px 8px rgba(0,0,0,0.8)
            `,
            userSelect: "none",
            position: "relative",
            whiteSpace: "nowrap",
          }}
        >
          {displayName}
        </div>
      </motion.div>
    </div>
  );
}

function LegendaryFullscreenSlam({
  config,
}: {
  config: FullscreenSlamConfig;
}) {
  const displayName = resolveCardDisplayName(config.cardId);
  const subtitle =
    CHARACTER_TITLES[config.characterId] ?? config.characterId;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9400,
      }}
    >
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 160,
          marginTop: -80,
          background: `linear-gradient(135deg,
            ${config.color}00 0%,
            ${config.color}CC 20%,
            ${config.secondaryColor}CC 50%,
            ${config.color}CC 80%,
            ${config.color}00 100%)`,
          transformOrigin: "left center",
        }}
      />

      {[-80, 80].map((offset, i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.08, delay: 0.02 * i }}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `calc(50% + ${offset}px)`,
            height: 24,
            background: "rgba(0,0,0,0.7)",
            transformOrigin: offset < 0 ? "right center" : "left center",
          }}
        />
      ))}

      <motion.div
        initial={{ x: "110%", skewX: -15 }}
        animate={{ x: "0%", skewX: 0 }}
        transition={{ type: "spring", stiffness: 700, damping: 20 }}
        style={{ position: "relative", textAlign: "center", maxWidth: "92vw" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.06 }}
          style={{
            position: "absolute",
            inset: 0,
            font: FONT_LEGENDARY,
            color: "transparent",
            WebkitTextStroke: "10px #000",
            letterSpacing: "6px",
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          {displayName}
        </motion.div>

        <div
          style={{
            font: FONT_LEGENDARY,
            color: "#FFFFFF",
            letterSpacing: "6px",
            textTransform: "uppercase",
            textShadow: `
              0 0 30px ${config.color},
              0 0 80px ${config.color}88,
              0 6px 12px rgba(0,0,0,0.9)
            `,
            userSelect: "none",
            position: "relative",
            lineHeight: 1.1,
          }}
        >
          {displayName}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            font: "600 20px var(--font-ui), Rajdhani, sans-serif",
            color: config.color,
            letterSpacing: "8px",
            textTransform: "uppercase",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          {subtitle}
        </motion.div>
      </motion.div>
    </div>
  );
}
