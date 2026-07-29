export type AnimationPhase =
  | "idle"
  | "card_lift"
  | "super_freeze"
  | "flash"
  | "impact_lines"
  | "text_slam"
  | "character_pose"
  | "particle_burst"
  | "effect_apply"
  | "return";

export type ParticlePattern =
  | "radial"
  | "spiral"
  | "explosion"
  | "rain"
  | "shockwave";

export type TextSlamStyle = "objection" | "announce" | "impact" | "whisper";

export type CharacterPoseType =
  | "point"
  | "slam"
  | "rise"
  | "charge"
  | "shield";

export interface AbilityAnimationConfig {
  cardId: string;
  rarity: "epic" | "legendary";
  characterId: string;
  timing: {
    superFreezeDuration: number;
    flashDuration: number;
    textSlamDelay: number;
    textSlamDuration: number;
    particleBurstDelay: number;
    totalDuration: number;
  };
  visual: {
    flashColor: string;
    flashSecondaryColor: string;
    impactLineColor: string;
    impactLineCount: number;
    impactLineWeight: number;
    particleColor: string;
    particleCount: number;
    particlePattern: ParticlePattern;
    textStyle: TextSlamStyle;
    characterAnimationType: CharacterPoseType;
  };
  uniqueEffect?: string;
}

export interface ImpactLinesConfig {
  color: string;
  count: number;
  weight: number;
  duration: number;
  originPlayer: 1 | 2;
  style?: "epic" | "legendary";
}

export interface ParticleBurstConfig {
  color: string;
  count: number;
  pattern: ParticlePattern;
  targetPlayer: 1 | 2;
  secondary?: string;
}

export interface TextSlamConfig {
  text: string;
  style: TextSlamStyle;
  color: string;
}

export interface FullscreenSlamConfig {
  cardId: string;
  characterId: string;
  style: string;
  color: string;
  secondaryColor: string;
}

export interface SilhouetteConfig {
  characterId: string;
  backgroundColor: string;
  secondaryColor: string;
  duration: number;
}

export interface CharacterPoseConfig {
  type: CharacterPoseType;
  playerNum: 1 | 2;
}
