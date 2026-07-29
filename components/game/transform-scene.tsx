"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { COLORS } from "@/lib/design/tokens";
import { FORM_STATS } from "@/lib/game/types";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { getCharacterById } from "@/lib/data";

interface TransformSceneProps {
  characterId: string;
  fromForm: 1 | 2 | 3;
  toForm: 1 | 2 | 3;
  onComplete: () => void;
}

export function TransformScene({
  characterId,
  toForm,
  onComplete,
}: TransformSceneProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
  }, [onComplete]);

  const newForm = FORM_STATS[characterId]?.[toForm - 1];
  const character = getCharacterById(characterId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(255,215,0,0.28), black)",
      }}
    >
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 20, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute h-24 w-24 rounded-full"
        style={{
          background:
            "radial-gradient(circle, white, rgba(255,215,0,0.5))",
        }}
      />

      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 180 }}
        className="relative h-[400px] w-[280px]"
      >
        <Image
          src={getCharacterPortraitUrl(characterId, toForm)}
          alt={newForm?.name ?? "form"}
          fill
          className="object-contain"
          unoptimized
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-6 text-center"
      >
        <div
          className="font-display text-5xl tracking-[0.15em]"
          style={{
            color: COLORS.gold,
            textShadow: `0 0 40px ${COLORS.gold_glow}`,
          }}
        >
          ТРАНСФОРМАЦИЯ
        </div>
        <div
          className="mt-2 font-ui text-2xl font-bold"
          style={{ color: COLORS.text_primary }}
        >
          {character?.name} · {newForm?.name}
        </div>
        {newForm && (
          <div
            className="mt-2 font-body text-base"
            style={{ color: COLORS.text_secondary }}
          >
            HP: {newForm.maxHp} · Броня: {newForm.armor} · Энергия:{" "}
            {newForm.maxEnergy}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
