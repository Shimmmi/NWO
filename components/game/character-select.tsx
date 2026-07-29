"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import { getAllCharacters } from "@/lib/data";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { FORM_STATS } from "@/lib/game/types";
import { cn } from "@/lib/utils";

interface CharacterSelectProps {
  onSelect: (characterId: string) => void;
}

export function CharacterSelect({ onSelect }: CharacterSelectProps) {
  const characters = getAllCharacters();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = characters[activeIndex];
  const form1 = active ? FORM_STATS[active.id]?.[0] : null;

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex flex-col items-center gap-6 px-4 pt-12"
      style={{
        background:
          "radial-gradient(ellipse at 50% 80%, #1A0A00, #08080F)",
      }}
    >
      <h1
        className="font-display text-center text-3xl tracking-[0.2em] md:text-4xl"
        style={{ color: COLORS.gold }}
      >
        ВЫБЕРИТЕ ПЕРСОНАЖА
      </h1>

      <div className="relative h-[320px] w-[240px] md:h-[420px] md:w-[300px]">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, scale: 0.9, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className="relative h-full w-full overflow-hidden rounded-xl border-2"
          style={{
            borderColor: getCharacterColor(active.id),
            boxShadow: `0 0 40px ${getCharacterColor(active.id)}55`,
          }}
        >
          <Image
            src={getCharacterPortraitUrl(active.id, 1)}
            alt={active.name}
            fill
            className="object-cover"
            unoptimized
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(transparent 50%, ${COLORS.bg_void})`,
            }}
          />
        </motion.div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {characters.map((char, i) => (
          <motion.button
            key={char.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "flex h-40 w-[110px] flex-col items-center justify-center gap-2 rounded-xl border p-3",
            )}
            style={{
              background:
                i === activeIndex
                  ? `linear-gradient(145deg, ${getCharacterColor(char.id)}33, #161824)`
                  : COLORS.bg_surface,
              borderColor:
                i === activeIndex
                  ? getCharacterColor(char.id)
                  : "rgba(255,255,255,0.1)",
              boxShadow:
                i === activeIndex
                  ? `0 0 20px ${getCharacterColor(char.id)}44`
                  : "none",
            }}
          >
            <div className="relative h-14 w-14 overflow-hidden rounded-md">
              <Image
                src={getCharacterPortraitUrl(char.id, 1)}
                alt={char.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div
              className="font-display text-center text-[11px] leading-tight"
              style={{ color: COLORS.text_primary }}
            >
              {char.name}
            </div>
            <div
              className="font-ui text-[10px]"
              style={{ color: COLORS.text_secondary }}
            >
              {char.country}
            </div>
          </motion.button>
        ))}
      </div>

      {form1 && (
        <div
          className="rounded-xl px-6 py-3 text-center font-ui text-sm"
          style={{
            background: COLORS.bg_glass,
            border: "1px solid rgba(255,255,255,0.08)",
            color: COLORS.text_secondary,
          }}
        >
          <span style={{ color: COLORS.text_primary }}>{form1.name}</span>
          {" · "}HP {form1.maxHp}
          {" · "}Броня {form1.armor}
          {" · "}Энергия {form1.maxEnergy}
          {" · "}Сила {form1.strength}
        </div>
      )}

      <Button
        size="lg"
        onClick={() => onSelect(active.id)}
        className="font-ui min-w-[240px] text-lg"
        style={{
          background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
          color: "#1A0000",
        }}
      >
        Выбрать {active.name}
      </Button>
    </div>
  );
}
