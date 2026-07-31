"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { getAllCharacters } from "@/lib/data";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import { getCountryFlagUrl } from "@/lib/game/art";

export interface CharacterCarouselProps {
  selectedId: string;
  onSelect: (characterId: string) => void;
  /** В лобби смена бойца сбрасывает готовность — предупреждаем заранее. */
  warnResetsReady?: boolean;
  disabled?: boolean;
}

export function CharacterCarousel({
  selectedId,
  onSelect,
  warnResetsReady,
  disabled,
}: CharacterCarouselProps) {
  const reducedMotion = useReducedMotion();
  const characters = getAllCharacters();

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2">
      <div
        className="flex flex-wrap justify-center gap-2"
        role="radiogroup"
        aria-label="Выбор бойца"
      >
        {characters.map((character) => {
          const active = character.id === selectedId;
          const accent = getCharacterColor(character.id);

          return (
            <motion.button
              key={character.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(character.id)}
              whileHover={reducedMotion || disabled ? undefined : { y: -4 }}
              whileTap={reducedMotion || disabled ? undefined : { scale: 0.97 }}
              className="flex w-[92px] flex-col items-center gap-1.5 rounded-xl border p-2 backdrop-blur-md disabled:opacity-50"
              style={{
                background: active
                  ? `linear-gradient(145deg, ${accent}44, rgba(10,10,16,0.85))`
                  : "rgba(10,10,16,0.6)",
                borderColor: active ? accent : "rgba(255,255,255,0.1)",
                boxShadow: active ? `0 0 24px ${accent}55` : "none",
              }}
            >
              <span className="relative h-9 w-14 overflow-hidden rounded-md border border-white/15">
                <Image
                  src={getCountryFlagUrl(character.id)}
                  alt={character.country}
                  fill
                  sizes="56px"
                  className="object-cover"
                  unoptimized
                />
              </span>
              <span
                className="text-center font-display text-[10px] leading-tight"
                style={{ color: active ? COLORS.text_primary : COLORS.text_secondary }}
              >
                {character.name}
              </span>
            </motion.button>
          );
        })}
      </div>

      {warnResetsReady && (
        <p className="font-ui text-[11px]" style={{ color: COLORS.text_secondary }}>
          Смена бойца снимет вашу готовность.
        </p>
      )}
    </div>
  );
}
