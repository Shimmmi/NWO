"use client";

import { presentationClock } from "./PresentationClock";
import { usePresentationStore } from "./presentationStore";

export type GateReason =
  | "idle"
  | "presentation_busy"
  | "network_playing"
  | "phase_locked"
  | "already_submitted"
  | "match_over";

export interface ActionGateState {
  canAct: boolean;
  reason: GateReason;
  softLockVisual: boolean;
}

export function getBattleGate(input: {
  phaseAllowsBattle: boolean;
  hasSubmitted: boolean;
  networkPlaying: boolean;
  matchFinished: boolean;
  /** Prefer React store for reactivity; falls back to clock */
  presentationIdle?: boolean;
}): ActionGateState {
  if (input.matchFinished) {
    return { canAct: false, reason: "match_over", softLockVisual: false };
  }
  if (!input.phaseAllowsBattle) {
    return { canAct: false, reason: "phase_locked", softLockVisual: false };
  }
  if (input.hasSubmitted) {
    return { canAct: false, reason: "already_submitted", softLockVisual: false };
  }
  if (input.networkPlaying) {
    return { canAct: false, reason: "network_playing", softLockVisual: true };
  }

  const idle =
    input.presentationIdle ??
    (usePresentationStore.getState().isIdle && presentationClock.isIdle);

  if (!idle) {
    return { canAct: false, reason: "presentation_busy", softLockVisual: true };
  }

  return { canAct: true, reason: "idle", softLockVisual: false };
}

export function getAbilityGate(input: {
  phaseAllowsAbility: boolean;
  networkPlaying: boolean;
  matchFinished: boolean;
  presentationIdle?: boolean;
}): ActionGateState {
  if (input.matchFinished) {
    return { canAct: false, reason: "match_over", softLockVisual: false };
  }
  if (!input.phaseAllowsAbility) {
    return { canAct: false, reason: "phase_locked", softLockVisual: false };
  }
  if (input.networkPlaying) {
    return { canAct: false, reason: "network_playing", softLockVisual: true };
  }

  const idle =
    input.presentationIdle ??
    (usePresentationStore.getState().isIdle && presentationClock.isIdle);

  if (!idle) {
    return { canAct: false, reason: "presentation_busy", softLockVisual: true };
  }

  return { canAct: true, reason: "idle", softLockVisual: false };
}
