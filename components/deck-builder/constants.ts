import { COLORS } from "@/lib/design/tokens";
import type { AbilityCard } from "@/lib/game/types";

export const DECK_RARITY_CONFIG: Record<
  AbilityCard["rarity"],
  { color: string; label: string }
> = {
  common: { color: COLORS.rarity_common, label: "Обычная" },
  rare: { color: COLORS.rarity_rare, label: "Редкая" },
  epic: { color: COLORS.rarity_epic, label: "Эпическая" },
  legendary: { color: COLORS.rarity_legendary, label: "Легендарная" },
};

export const TYPE_LABEL: Record<AbilityCard["type"], string> = {
  active: "Активная",
  passive: "Пассивная",
  ultimate: "Ультимейт",
};

export const TYPE_COLOR: Record<AbilityCard["type"], string> = {
  active: COLORS.red_hot,
  passive: COLORS.cyan_cool,
  ultimate: COLORS.gold,
};
