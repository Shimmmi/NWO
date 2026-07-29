import { getAllCharacters } from "@/lib/data";

export const CHARACTER_IDS = [
  "donald-rumpf",
  "vladimir-pu",
  "jin-shi",
  "vlado-zelenko",
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export const ACCENT_COLORS: Record<CharacterId, string> = {
  "donald-rumpf": "#2563eb",
  "vladimir-pu": "#dc2626",
  "jin-shi": "#991b1b",
  "vlado-zelenko": "#eab308",
};

export const mockCollection: Record<CharacterId, string[]> = Object.fromEntries(
  getAllCharacters().map((character) => [
    character.id,
    character.abilityCards.map((card) => card.id),
  ]),
) as Record<CharacterId, string[]>;
