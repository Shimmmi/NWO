"use client";

import { create } from "zustand";
import type {
  AnimationPhase,
  CharacterPoseConfig,
  FullscreenSlamConfig,
  ImpactLinesConfig,
  ParticleBurstConfig,
  SilhouetteConfig,
  TextSlamConfig,
} from "./types";

interface AbilityAnimationState {
  phase: AnimationPhase;
  isAnimationLocked: boolean;
  freezeActive: boolean;
  flashActive: boolean;
  flashColor: string;
  flashIntensity: number;
  impactLinesConfig: ImpactLinesConfig | null;
  particleBurstConfig: ParticleBurstConfig | null;
  textSlamConfig: TextSlamConfig | null;
  fullscreenSlamConfig: FullscreenSlamConfig | null;
  silhouetteConfig: SilhouetteConfig | null;
  uniqueEffect: { type: string; params: Record<string, unknown> } | null;
  screenDarkness: number;
  characterPose: CharacterPoseConfig | null;
  /** Match player number currently viewing from the left of the screen */
  localPlayerNum: 1 | 2;

  setPhase: (phase: AnimationPhase) => void;
  setAnimationLock: (locked: boolean) => void;
  setLocalPlayerNum: (n: 1 | 2) => void;
  triggerFreeze: (durationMs: number) => void;
  triggerFlash: (color: string, durationMs: number, style?: string) => void;
  triggerImpactLines: (config: ImpactLinesConfig) => void;
  triggerParticleBurst: (config: ParticleBurstConfig) => void;
  triggerTextSlam: (config: TextSlamConfig) => void;
  triggerFullscreenSlam: (config: FullscreenSlamConfig) => void;
  triggerSilhouette: (config: SilhouetteConfig) => void;
  triggerUniqueEffect: (type: string, params: Record<string, unknown>) => void;
  triggerScreenDarken: (opacity: number, durationMs: number) => void;
  triggerCharacterPose: (config: CharacterPoseConfig) => void;
  clearAllLayers: () => void;
}

export const useAbilityAnimationStore = create<AbilityAnimationState>((set) => ({
  phase: "idle",
  isAnimationLocked: false,
  freezeActive: false,
  flashActive: false,
  flashColor: "#ffffff",
  flashIntensity: 0,
  impactLinesConfig: null,
  particleBurstConfig: null,
  textSlamConfig: null,
  fullscreenSlamConfig: null,
  silhouetteConfig: null,
  uniqueEffect: null,
  screenDarkness: 0,
  characterPose: null,
  localPlayerNum: 1,

  setPhase: (phase) => set({ phase }),
  setAnimationLock: (locked) => set({ isAnimationLocked: locked }),
  setLocalPlayerNum: (n) => set({ localPlayerNum: n }),

  triggerFreeze: (durationMs) => {
    set({ freezeActive: true });
    setTimeout(() => set({ freezeActive: false }), durationMs);
  },

  triggerFlash: (color, durationMs, style = "epic") => {
    const intensity = style === "legendary" ? 1.0 : 0.7;
    set({ flashActive: true, flashColor: color, flashIntensity: intensity });
    setTimeout(
      () => set({ flashActive: false, flashIntensity: 0 }),
      durationMs,
    );
  },

  triggerImpactLines: (config) => {
    set({ impactLinesConfig: config });
    setTimeout(() => set({ impactLinesConfig: null }), config.duration);
  },

  triggerParticleBurst: (config) => set({ particleBurstConfig: config }),

  triggerTextSlam: (config) => {
    set({ textSlamConfig: config });
    setTimeout(() => set({ textSlamConfig: null }), 1200);
  },

  triggerFullscreenSlam: (config) => {
    set({ fullscreenSlamConfig: config });
    setTimeout(() => set({ fullscreenSlamConfig: null }), 1800);
  },

  triggerSilhouette: (config) => {
    set({ silhouetteConfig: config });
    setTimeout(
      () => set({ silhouetteConfig: null }),
      config.duration + 300,
    );
  },

  triggerUniqueEffect: (type, params) => {
    set({ uniqueEffect: { type, params } });
    setTimeout(() => set({ uniqueEffect: null }), 1200);
  },

  triggerScreenDarken: (opacity, durationMs) => {
    set({ screenDarkness: opacity });
    setTimeout(() => set({ screenDarkness: 0 }), durationMs);
  },

  triggerCharacterPose: (config) => {
    set({ characterPose: config });
    setTimeout(() => set({ characterPose: null }), 700);
  },

  clearAllLayers: () =>
    set({
      phase: "idle",
      impactLinesConfig: null,
      particleBurstConfig: null,
      textSlamConfig: null,
      fullscreenSlamConfig: null,
      silhouetteConfig: null,
      uniqueEffect: null,
      screenDarkness: 0,
      flashActive: false,
      characterPose: null,
      freezeActive: false,
    }),
}));
