export const COLORS = {
  bg_void: "#08080F",
  bg_surface: "#0F1018",
  bg_card: "#161824",
  bg_glass: "rgba(255,255,255,0.04)",

  gold: "#D4AF37",
  gold_glow: "#FFD700",
  red_hot: "#E8372C",
  red_glow: "#FF5045",
  cyan_cool: "#00D4FF",
  purple_epic: "#9B59B6",
  legendary: "#FF8C00",

  usa_blue: "#1A3A6B",
  usa_red: "#B22234",
  russia_red: "#CC0000",
  russia_dark: "#1A0000",
  china_red: "#DE2910",
  china_gold: "#FFDE00",
  ukraine_blue: "#005BBB",
  ukraine_gold: "#FFD500",
  /** Neutral «Глобальные решения» accent (TZ v7) */
  neutral_green: "#2F6B4F",
  neutral_gray: "#6B7280",
  neutral_seal: "#C4A35A",

  rarity_common: "#8A9BA8",
  rarity_rare: "#4A90D9",
  rarity_epic: "#9B59B6",
  rarity_legendary: "#E67E22",

  text_primary: "#F0E8D0",
  text_secondary: "#8A9BA8",
  text_damage: "#FF4444",
  text_heal: "#44FF88",
  text_energy: "#FFD700",
} as const;

export const TYPOGRAPHY = {
  display: "var(--font-display), 'Cinzel Decorative', serif",
  ui: "var(--font-ui), 'Rajdhani', sans-serif",
  body: "var(--font-body), 'Crimson Text', serif",
  mono: "var(--font-geist-mono), 'JetBrains Mono', monospace",

  xs: "11px",
  sm: "13px",
  base: "15px",
  lg: "18px",
  xl: "24px",
  xxl: "32px",
  hero: "48px",
} as const;

export const CHARACTER_COLORS: Record<string, string> = {
  "donald-rumpf": COLORS.usa_blue,
  "vladimir-pu": COLORS.russia_red,
  "jin-shi": COLORS.china_red,
  "vlado-zelenko": COLORS.ukraine_gold,
  neutral: COLORS.neutral_green,
};

export function getCharacterColor(characterId: string): string {
  return CHARACTER_COLORS[characterId] ?? COLORS.gold;
}

export function getArenaIdForCharacter(characterId: string): string {
  const map: Record<string, string> = {
    "donald-rumpf": "usa-arena",
    "vladimir-pu": "russia-arena",
    "jin-shi": "china-arena",
    "vlado-zelenko": "ukraine-arena",
  };
  return map[characterId] ?? "usa-arena";
}
