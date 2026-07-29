"use client";

import { create } from "zustand";
import * as THREE from "three";

export type ParticleBurstType =
  | "hit"
  | "block"
  | "heal"
  | "energy"
  | "death"
  | "transform"
  | "crit";

export interface ParticleBurst {
  id: string;
  position: [number, number, number];
  type: ParticleBurstType;
  color: string;
  count: number;
  timestamp: number;
}

export interface DamageNumberEvent {
  id: string;
  value: number;
  type: "damage" | "heal" | "energy" | "block" | "crit";
  position: [number, number, number];
  timestamp: number;
}

export type ShakeType = "damage" | "crit" | "light";

export interface ShakeEvent {
  id: string;
  type: ShakeType;
  timestamp: number;
}

export type PendingMeshEffect =
  | { type: "damage"; amount: number; isCrit?: boolean; id: string }
  | { type: "heal"; amount: number; id: string }
  | { type: "death"; id: string }
  | { type: "transform"; id: string }
  | { type: "block"; id: string };

interface EffectStoreState {
  particleBursts: ParticleBurst[];
  damageNumbers: DamageNumberEvent[];
  currentShake: ShakeEvent | null;
  pendingEffects: {
    player1: PendingMeshEffect | null;
    player2: PendingMeshEffect | null;
  };
  hitStopUntil: number;
  addParticleBurst: (
    burst: Omit<ParticleBurst, "id" | "timestamp"> & { id?: string },
  ) => void;
  addDamageNumber: (
    event: Omit<DamageNumberEvent, "id" | "timestamp"> & { id?: string },
  ) => void;
  triggerShake: (type: ShakeType) => void;
  setPendingEffect: (
    target: "player1" | "player2",
    effect: PendingMeshEffect | null,
  ) => void;
  triggerHitStop: (ms?: number) => void;
  clearExpired: () => void;
}

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export const useGameEffectStore = create<EffectStoreState>((set, get) => ({
  particleBursts: [],
  damageNumbers: [],
  currentShake: null,
  pendingEffects: { player1: null, player2: null },
  hitStopUntil: 0,

  addParticleBurst: (burst) => {
    const id = burst.id ?? nextId("burst");
    set((s) => ({
      particleBursts: [
        ...s.particleBursts.slice(-20),
        { ...burst, id, timestamp: Date.now() },
      ],
    }));
    setTimeout(() => {
      set((s) => ({
        particleBursts: s.particleBursts.filter((b) => b.id !== id),
      }));
    }, 1500);
  },

  addDamageNumber: (event) => {
    const id = event.id ?? nextId("dmg");
    set((s) => ({
      damageNumbers: [
        ...s.damageNumbers.slice(-15),
        { ...event, id, timestamp: Date.now() },
      ],
    }));
    setTimeout(() => {
      set((s) => ({
        damageNumbers: s.damageNumbers.filter((d) => d.id !== id),
      }));
    }, 1400);
  },

  triggerShake: (type) => {
    const id = nextId("shake");
    set({ currentShake: { id, type, timestamp: Date.now() } });
    setTimeout(() => {
      const cur = get().currentShake;
      if (cur?.id === id) set({ currentShake: null });
    }, 700);
  },

  setPendingEffect: (target, effect) => {
    set((s) => ({
      pendingEffects: { ...s.pendingEffects, [target]: effect },
    }));
    if (effect) {
      setTimeout(() => {
        set((s) => {
          if (s.pendingEffects[target]?.id !== effect.id) return s;
          return {
            pendingEffects: { ...s.pendingEffects, [target]: null },
          };
        });
      }, 500);
    }
  },

  triggerHitStop: (ms = 80) => {
    set({ hitStopUntil: Date.now() + ms });
  },

  clearExpired: () => {
    const now = Date.now();
    set((s) => ({
      particleBursts: s.particleBursts.filter((b) => now - b.timestamp < 2000),
      damageNumbers: s.damageNumbers.filter((d) => now - d.timestamp < 1600),
    }));
  },
}));

export function characterWorldPosition(
  isLeft: boolean,
): [number, number, number] {
  return isLeft ? [-2.5, 1.2, 0] : [2.5, 1.2, 0];
}

export function burstAt(
  position: [number, number, number],
  type: ParticleBurstType,
  color: string,
  count = 24,
) {
  useGameEffectStore.getState().addParticleBurst({
    position,
    type,
    color,
    count,
  });
}

export function floatDamageAt(
  position: [number, number, number],
  value: number,
  type: DamageNumberEvent["type"],
) {
  useGameEffectStore.getState().addDamageNumber({
    position: [
      position[0] + (Math.random() - 0.5) * 0.4,
      position[1],
      position[2],
    ],
    value,
    type,
  });
}

/** TZ v4: real hit-stop — return 0 while frozen so ambient useFrame loops pause. */
export function getPresentationDelta(delta: number): number {
  const until = useGameEffectStore.getState().hitStopUntil;
  if (Date.now() < until) return 0;
  return delta;
}

export function isHitStopActive(): boolean {
  return Date.now() < useGameEffectStore.getState().hitStopUntil;
}

export { THREE };
