import { BASE_PATH } from "@/lib/constants";
import { COLORS, getArenaIdForCharacter } from "@/lib/design/tokens";
import type { AbilityCard, Character } from "@/lib/game/types";

export type CountryAccent = Character["countryAccent"];

const ACCENT: Record<CountryAccent, { from: string; to: string; text: string }> = {
  blue: { from: "#1e3a5f", to: "#2563eb", text: "#93c5fd" },
  red: { from: "#7f1d1d", to: "#dc2626", text: "#fca5a5" },
  crimson: { from: "#881337", to: "#e11d48", text: "#fda4af" },
  gold: { from: "#713f12", to: "#ca8a04", text: "#fde047" },
};

const RARITY_COLORS: Record<AbilityCard["rarity"], { from: string; to: string; border: string }> = {
  common: { from: "#27272a", to: "#3f3f46", border: "#71717a" },
  rare: { from: "#1e3a5f", to: "#1d4ed8", border: "#3b82f6" },
  epic: { from: "#4c1d95", to: "#7c3aed", border: "#a855f7" },
  legendary: { from: "#713f12", to: "#eab308", border: "#facc15" },
};

function assetPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeCardArtId(cardId: string): string {
  return cardId.split("#")[0];
}

export function getCharacterPortraitUrl(characterId: string, form: number): string {
  return assetPath(`/placeholders/characters/${characterId}-form${form}.webp`);
}

const CHARACTER_FLAG_CODE: Record<string, string> = {
  "donald-rumpf": "us",
  "vladimir-pu": "ru",
  "jin-shi": "cn",
  "vlado-zelenko": "ua",
  us: "us",
  ru: "ru",
  cn: "cn",
  ua: "ua",
};

/** Stylized country flag for character-select thumbnails (TZ v8). */
export function getCountryFlagUrl(characterIdOrCode: string): string {
  const code = CHARACTER_FLAG_CODE[characterIdOrCode] ?? "us";
  return assetPath(`/placeholders/flags/${code}.svg`);
}

export function getCardArtUrl(cardId: string, _rarity: AbilityCard["rarity"]): string {
  const baseId = normalizeCardArtId(cardId);
  return assetPath(`/placeholders/cards/${baseId}.webp`);
}

export function getCardFallbackUrl(rarity: AbilityCard["rarity"]): string {
  return assetPath(`/placeholders/cards/fallback-${rarity}.webp`);
}

export function getCardBackUrl(): string {
  return assetPath("/placeholders/cards/card-back.webp");
}

export function getArenaBackgroundUrl(): string {
  return assetPath("/placeholders/arena/default.webp");
}

export type ArenaThemeColors = {
  sky: string;
  fog: string;
  accent: string;
  floor: string;
  particle: string;
};

const ARENA_THEME_COLORS: Record<string, ArenaThemeColors> = {
  "usa-arena": {
    sky: "#0a1628",
    fog: COLORS.usa_blue,
    accent: COLORS.usa_red,
    floor: "#141822",
    particle: COLORS.gold,
  },
  "russia-arena": {
    sky: "#0a0508",
    fog: COLORS.russia_dark,
    accent: COLORS.russia_red,
    floor: "#161018",
    particle: "#e8eef5",
  },
  "china-arena": {
    sky: "#1a0808",
    fog: "#4a1010",
    accent: COLORS.china_gold,
    floor: "#180c0c",
    particle: "#ff6b35",
  },
  "ukraine-arena": {
    sky: "#0a1520",
    fog: COLORS.ukraine_blue,
    accent: COLORS.ukraine_gold,
    floor: "#12161c",
    particle: "#ffaa44",
  },
  "mirror-arena": {
    sky: "#050805",
    fog: "#0f1a10",
    accent: "#39ff14",
    floor: "#0c100c",
    particle: "#7cfc00",
  },
};

/** Mirror match → nuclear bunker; otherwise player1's home arena. */
export function getArenaIdForMatch(
  player1CharacterId: string,
  player2CharacterId: string,
): string {
  if (player1CharacterId === player2CharacterId) return "mirror-arena";
  return getArenaIdForCharacter(player1CharacterId);
}

export function getArenaThemeColors(arenaId: string): ArenaThemeColors {
  return ARENA_THEME_COLORS[arenaId] ?? ARENA_THEME_COLORS["usa-arena"];
}

export function getAccentGradient(accent: CountryAccent): string {
  const c = ACCENT[accent];
  return `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`;
}

export function getRarityGradient(rarity: AbilityCard["rarity"]): string {
  const c = RARITY_COLORS[rarity];
  return `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`;
}

export function getRarityBorderClass(rarity: AbilityCard["rarity"]): string {
  const map: Record<AbilityCard["rarity"], string> = {
    common: "border-zinc-600",
    rare: "border-blue-500/70",
    epic: "border-purple-500/70",
    legendary: "border-yellow-500/70",
  };
  return map[rarity];
}

export function getRarityLabel(rarity: AbilityCard["rarity"]): string {
  const map: Record<AbilityCard["rarity"], string> = {
    common: "Обычная",
    rare: "Редкая",
    epic: "Эпическая",
    legendary: "Легендарная",
  };
  return map[rarity];
}

export function getRarityCalloutDurationMs(
  rarity?: AbilityCard["rarity"],
): number {
  const map: Record<AbilityCard["rarity"], number> = {
    common: 1000,
    rare: 2000,
    epic: 3000,
    legendary: 5000,
  };
  return rarity ? map[rarity] : 2000;
}

export function getEffectTypeLabel(type: string): string {
  const map: Record<string, string> = {
    block: "Блок",
    distraction: "Отвлечение",
    invulnerability: "Неуязвимость",
    strength_up: "Сила",
    energy_steal: "Кража энергии",
    heal: "Лечение",
    propaganda: "Пропаганда",
    sanction: "Санкции",
    cost_reduce: "Скидка",
    skip_ability: "Пропуск хода",
    strength_down: "Ослабление",
    poison: "Яд",
  };
  return map[type] ?? type;
}
