export const BALANCE = {
  /** Effective armor = floor(armor * this) */
  BASE_ARMOR_MULTIPLIER: 0.6,
  /** Card damage scaling */
  BASE_DAMAGE_MULTIPLIER: 1.4,
  /** Armor never absorbs more than this fraction of a hit */
  ARMOR_CAP_RATIO: 0.6,
  /** Crit chance / multiplier */
  CRIT_CHANCE: 0.15,
  CRIT_MULTIPLIER: 1.8,
  /** Transform when HP ratio drops to this (not only at 0) */
  TRANSFORM_THRESHOLD: 0.33,
  /** Turn timer in seconds */
  TURN_TIMER: 90,
  /** Energy restored each turn */
  ENERGY_REGEN: 3,
  /** Absolute energy hard cap */
  ABSOLUTE_MAX_ENERGY: 10,
} as const;

export type AIDifficulty = "easy" | "normal" | "hard";
