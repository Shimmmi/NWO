"use client";

import Image from "next/image";
import { getCharacterById } from "@/lib/data";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import { getCharacterPortraitUrl } from "@/lib/game/art";

export interface StaticLobbyBackdropProps {
  myCharacterId: string;
  opponentCharacterId: string | null;
  hint?: string;
}

/**
 * Фон без Three.js. Живёт отдельным модулем намеренно: экраны лобби
 * импортируют его напрямую, и three.js не должен ехать в общий бандл вместе
 * с ним — Canvas подключается только через dynamic import.
 */
export function StaticLobbyBackdrop({
  myCharacterId,
  opponentCharacterId,
  hint,
}: StaticLobbyBackdropProps) {
  const mine = getCharacterById(myCharacterId);
  const theirs = opponentCharacterId ? getCharacterById(opponentCharacterId) : null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 85%, #1A0A00 0%, ${COLORS.bg_void} 70%)`,
      }}
    >
      <div className="absolute inset-0 flex items-end justify-center gap-10 pb-24 opacity-45">
        {[mine, theirs].map((character, index) =>
          character ? (
            <div
              key={`${character.id}-${index}`}
              className="relative h-[46vh] w-[26vh] overflow-hidden rounded-2xl border"
              style={{
                borderColor: `${getCharacterColor(character.id)}66`,
                boxShadow: `0 0 60px ${getCharacterColor(character.id)}33`,
              }}
            >
              <Image
                src={getCharacterPortraitUrl(character.id, 1)}
                alt={character.name}
                fill
                sizes="26vh"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null,
        )}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: `linear-gradient(transparent, ${COLORS.bg_void})` }}
      />

      {hint && (
        <p
          className="absolute inset-x-0 bottom-6 text-center font-ui text-xs tracking-widest"
          style={{ color: COLORS.text_secondary }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
