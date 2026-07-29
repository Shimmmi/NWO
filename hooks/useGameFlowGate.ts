"use client";

import { useMemo } from "react";
import {
  getAbilityGate,
  getBattleGate,
  type ActionGateState,
} from "@/lib/game-flow/ActionGate";
import { usePresentationStore } from "@/lib/game-flow/presentationStore";

export function useBattleFlowGate(input: {
  phaseAllowsBattle: boolean;
  hasSubmitted: boolean;
  networkPlaying: boolean;
  matchFinished: boolean;
}): ActionGateState {
  const presentationIdle = usePresentationStore((s) => s.isIdle);

  return useMemo(
    () =>
      getBattleGate({
        ...input,
        presentationIdle,
      }),
    [
      input.phaseAllowsBattle,
      input.hasSubmitted,
      input.networkPlaying,
      input.matchFinished,
      presentationIdle,
    ],
  );
}

export function useAbilityFlowGate(input: {
  phaseAllowsAbility: boolean;
  networkPlaying: boolean;
  matchFinished: boolean;
}): ActionGateState {
  const presentationIdle = usePresentationStore((s) => s.isIdle);

  return useMemo(
    () =>
      getAbilityGate({
        ...input,
        presentationIdle,
      }),
    [
      input.phaseAllowsAbility,
      input.networkPlaying,
      input.matchFinished,
      presentationIdle,
    ],
  );
}

export function usePresentationSoftLock(): boolean {
  return usePresentationStore((s) => s.softLock);
}
