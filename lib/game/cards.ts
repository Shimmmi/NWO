import type { AbilityCard, CardCategory } from "@/lib/game/types";

export type { CardCategory };

const ATTACK_TAGS = [
  "damage",
  "armor_ignore",
  "discard_hand",
  "energy_steal",
  "hp_percent",
  "poison",
  "hits",
  "cancel_last",
];

const DEFENSE_TAGS = [
  "block",
  "heal",
  "invulnerability",
  "armor_up",
  "armor_reduce",
  "reflect",
  "damage_block",
  "survive_lethal",
];

export function inferCardCategory(card: AbilityCard): CardCategory {
  const tags = parseEffectTags(card.effect);
  for (const tag of ATTACK_TAGS) {
    if (tag in tags) return "attack";
  }
  for (const tag of DEFENSE_TAGS) {
    if (tag in tags) return "defense";
  }
  return "support";
}

export function parseEffectTags(effect: string): Record<string, number | boolean> {
  const tags: Record<string, number | boolean> = {};
  for (const part of effect.trim().split(/\s+/)) {
    if (!part) continue;
    const colonIdx = part.indexOf(":");
    if (colonIdx >= 0) {
      const key = part.slice(0, colonIdx);
      const raw = part.slice(colonIdx + 1);
      const num = Number(raw);
      tags[key] = Number.isFinite(num) ? num : 0;
    } else {
      tags[part] = true;
    }
  }
  return tags;
}

export function parseEffectValue(effect: string): number {
  const tags = parseEffectTags(effect);
  const numericKeys = [
    "damage",
    "heal",
    "block",
    "energy",
    "energy_steal",
    "armor_reduce",
    "strength_up",
    "speed_up",
    "speed_down",
    "draw",
    "hp_percent",
    "poison",
    "reflect",
  ];
  let max = 0;
  for (const key of numericKeys) {
    const val = tags[key];
    if (typeof val === "number" && val > max) {
      max = val;
    }
  }
  return max;
}

export function hasEffect(effect: string, tag: string): boolean {
  const tags = parseEffectTags(effect);
  return tag in tags;
}

export function getEffectNumber(effect: string, tag: string, fallback = 0): number {
  const tags = parseEffectTags(effect);
  const val = tags[tag];
  return typeof val === "number" ? val : fallback;
}

export function cloneCard(card: AbilityCard): AbilityCard {
  return { ...card };
}

export function findCardsByIds(cards: AbilityCard[], ids: string[]): AbilityCard[] {
  const idSet = new Set(ids);
  return cards.filter((c) => idSet.has(c.id));
}
