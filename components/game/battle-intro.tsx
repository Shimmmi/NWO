"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { getCharacterById } from "@/lib/data";

interface BattleIntroProps {
  player1CharacterId: string;
  player2CharacterId: string;
  player1Name: string;
  player2Name: string;
  onComplete: () => void;
}

export function BattleIntro({
  player1CharacterId,
  player2CharacterId,
  player1Name,
  player2Name,
  onComplete,
}: BattleIntroProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2200);
    return () => clearTimeout(t);
  }, [onComplete]);

  const c1 = getCharacterById(player1CharacterId);
  const c2 = getCharacterById(player2CharacterId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${COLORS.bg_surface}, ${COLORS.bg_void})`,
      }}
    >
      <motion.div
        initial={{ x: -400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="absolute left-[8%] flex flex-col items-center"
      >
        <div
          className="relative h-64 w-44 overflow-hidden rounded-lg border-2"
          style={{ borderColor: getCharacterColor(player1CharacterId) }}
        >
          <Image
            src={getCharacterPortraitUrl(player1CharacterId, 1)}
            alt={c1?.name ?? player1Name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <p
          className="mt-3 font-display text-xl"
          style={{ color: COLORS.text_primary }}
        >
          {c1?.name ?? player1Name}
        </p>
      </motion.div>

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 200 }}
        className="font-display z-10 text-6xl tracking-[0.3em]"
        style={{
          color: COLORS.gold,
          textShadow: `0 0 40px ${COLORS.gold_glow}`,
        }}
      >
        VS
      </motion.div>

      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="absolute right-[8%] flex flex-col items-center"
      >
        <div
          className="relative h-64 w-44 overflow-hidden rounded-lg border-2"
          style={{ borderColor: getCharacterColor(player2CharacterId) }}
        >
          <Image
            src={getCharacterPortraitUrl(player2CharacterId, 1)}
            alt={c2?.name ?? player2Name}
            fill
            className="object-cover scale-x-[-1]"
            unoptimized
          />
        </div>
        <p
          className="mt-3 font-display text-xl"
          style={{ color: COLORS.text_primary }}
        >
          {c2?.name ?? player2Name}
        </p>
      </motion.div>
    </motion.div>
  );
}
