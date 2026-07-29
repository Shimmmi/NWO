"use client";

import { useCallback } from "react";
import { orchestrator } from "@/lib/animations/AbilityAnimationOrchestrator";
import { getCardAnimationConfig } from "@/lib/animations/cardConfigs";
import { useAbilityAnimationStore } from "@/lib/animations/store";

export function useAbilityAnimation() {
  const isLocked = useAbilityAnimationStore((s) => s.isAnimationLocked);
  const setLocalPlayerNum = useAbilityAnimationStore(
    (s) => s.setLocalPlayerNum,
  );

  const playCardAnimation = useCallback(
    (cardId: string, playerNum: 1 | 2, localPlayerNum?: 1 | 2) => {
      return new Promise<void>((resolve) => {
        if (localPlayerNum) setLocalPlayerNum(localPlayerNum);
        const config = getCardAnimationConfig(cardId);
        if (!config) {
          resolve();
          return;
        }
        void orchestrator.play(cardId, playerNum, () => resolve());
      });
    },
    [setLocalPlayerNum],
  );

  const hasCinematic = useCallback((cardId: string) => {
    return Boolean(getCardAnimationConfig(cardId));
  }, []);

  return { playCardAnimation, hasCinematic, isLocked, orchestrator };
}
