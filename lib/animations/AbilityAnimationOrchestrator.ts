"use client";

import gsap from "gsap";
import { CARD_ANIMATION_CONFIGS } from "./cardConfigs";
import { useAbilityAnimationStore } from "./store";
import type { AbilityAnimationConfig } from "./types";
import { audioSystem } from "@/lib/audio/AbilityAudioSystem";

export type { AbilityAnimationConfig, AnimationPhase } from "./types";

export class AbilityAnimationOrchestrator {
  private currentTimeline: gsap.core.Timeline | null = null;

  async play(
    cardId: string,
    casterPlayer: 1 | 2,
    onComplete: () => void,
  ): Promise<void> {
    const baseId = cardId.split("#")[0];
    const config = CARD_ANIMATION_CONFIGS[baseId];
    if (!config) {
      onComplete();
      return;
    }

    this.currentTimeline?.kill();

    const store = useAbilityAnimationStore.getState();
    store.setAnimationLock(true);
    store.clearAllLayers();

    const targetPlayer: 1 | 2 = casterPlayer === 1 ? 2 : 1;

    // Build paused, then play — avoids racing the first frames while chaining.
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        useAbilityAnimationStore.getState().setAnimationLock(false);
        useAbilityAnimationStore.getState().clearAllLayers();
        this.currentTimeline = null;
        onComplete();
      },
    });

    this.currentTimeline = tl;

    if (config.rarity === "legendary") {
      audioSystem?.playLegendarySting(config.characterId);
      this.buildLegendarySequence(tl, config, casterPlayer, targetPlayer);
    } else {
      audioSystem?.playEpicSting(config.characterId);
      this.buildEpicSequence(tl, config, casterPlayer, targetPlayer);
    }

    tl.play(0);
  }

  kill() {
    this.currentTimeline?.kill();
    this.currentTimeline = null;
    const store = useAbilityAnimationStore.getState();
    store.setAnimationLock(false);
    store.clearAllLayers();
  }

  private buildEpicSequence(
    tl: gsap.core.Timeline,
    config: AbilityAnimationConfig,
    casterPlayer: 1 | 2,
    targetPlayer: 1 | 2,
  ) {
    const { timing, visual } = config;
    const store = () => useAbilityAnimationStore.getState();

    tl.call(() => store().setPhase("card_lift"))
      .to({}, { duration: (timing.textSlamDelay / 1000) * 0.3 })

      .call(() => {
        store().setPhase("super_freeze");
        store().triggerFreeze(timing.superFreezeDuration);
      })
      .to({}, { duration: timing.superFreezeDuration / 1000 })

      .call(() => {
        store().setPhase("flash");
        store().triggerFlash(visual.flashColor, timing.flashDuration);
        store().triggerImpactLines({
          color: visual.impactLineColor,
          count: visual.impactLineCount,
          weight: visual.impactLineWeight,
          duration: timing.flashDuration * 1.2,
          originPlayer: casterPlayer,
          style: "epic",
        });
        store().triggerCharacterPose({
          type: visual.characterAnimationType,
          playerNum: casterPlayer,
        });
      })
      .to({}, { duration: (timing.flashDuration / 1000) * 0.4 })

      .call(() => {
        store().setPhase("text_slam");
        store().triggerTextSlam({
          text: config.cardId,
          style: visual.textStyle,
          color: visual.flashColor,
        });
      })
      .to({}, { duration: timing.textSlamDuration / 1000 })

      .call(() => {
        store().setPhase("particle_burst");
        store().triggerParticleBurst({
          color: visual.particleColor,
          count: visual.particleCount,
          pattern: visual.particlePattern,
          targetPlayer,
        });
      })
      .to({}, { duration: 0.3 })

      .call(() => store().setPhase("return"))
      .to({}, { duration: 0.35 });
  }

  private buildLegendarySequence(
    tl: gsap.core.Timeline,
    config: AbilityAnimationConfig,
    casterPlayer: 1 | 2,
    targetPlayer: 1 | 2,
  ) {
    const { timing, visual } = config;
    const store = () => useAbilityAnimationStore.getState();

    tl.call(() => store().setPhase("card_lift"))
      .to({}, { duration: 0.2 })

      .call(() => {
        store().setPhase("super_freeze");
        store().triggerFreeze(timing.superFreezeDuration);
        store().triggerScreenDarken(0.9, timing.superFreezeDuration);
      })
      .to({}, { duration: timing.superFreezeDuration / 1000 })

      .call(() => {
        store().triggerSilhouette({
          characterId: config.characterId,
          backgroundColor: visual.flashColor,
          secondaryColor: visual.flashSecondaryColor,
          duration: 400,
        });
      })
      .to({}, { duration: 0.15 })

      .call(() => {
        store().setPhase("flash");
        store().triggerFlash(
          visual.flashColor,
          timing.flashDuration,
          "legendary",
        );
        store().triggerImpactLines({
          color: visual.impactLineColor,
          count: visual.impactLineCount,
          weight: visual.impactLineWeight,
          duration: timing.flashDuration * 1.5,
          originPlayer: casterPlayer,
          style: "legendary",
        });
        store().triggerCharacterPose({
          type: visual.characterAnimationType,
          playerNum: casterPlayer,
        });
      })
      .to({}, { duration: (timing.flashDuration / 1000) * 0.35 })

      .call(() => {
        store().setPhase("text_slam");
        store().triggerFullscreenSlam({
          cardId: config.cardId,
          characterId: config.characterId,
          style: visual.textStyle,
          color: visual.flashColor,
          secondaryColor: visual.flashSecondaryColor,
        });
      })
      .to({}, { duration: timing.textSlamDuration / 1000 })

      .call(() => {
        if (config.uniqueEffect) {
          store().triggerUniqueEffect(config.uniqueEffect, {
            targetPlayer,
            color: visual.flashColor,
            secondary: visual.flashSecondaryColor,
          });
        }
      })
      .to({}, { duration: 0.5 })

      .call(() => {
        store().setPhase("particle_burst");
        store().triggerParticleBurst({
          color: visual.particleColor,
          count: visual.particleCount,
          pattern: visual.particlePattern,
          targetPlayer,
          secondary: visual.flashSecondaryColor,
        });
      })
      .to({}, { duration: 0.6 })

      .call(() => store().setPhase("return"))
      .to({}, { duration: 0.5 });
  }
}

export const orchestrator = new AbilityAnimationOrchestrator();
