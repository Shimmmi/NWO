"use client";

import { create } from "zustand";

export type OpeningPhase =
  | "idle"
  | "purchase_handoff"
  | "pack_present"
  | "tear_rip"
  | "stack_rise"
  | "reveal"
  | "legendary_interrupt"
  | "bonus_tease"
  | "summary"
  | "exit";

interface OpeningUiState {
  phase: OpeningPhase;
  revealIndex: number;
  skipped: boolean;
  setPhase: (p: OpeningPhase) => void;
  setRevealIndex: (i: number) => void;
  setSkipped: (v: boolean) => void;
  reset: () => void;
}

export const useOpeningStore = create<OpeningUiState>((set) => ({
  phase: "idle",
  revealIndex: -1,
  skipped: false,
  setPhase: (phase) => set({ phase }),
  setRevealIndex: (revealIndex) => set({ revealIndex }),
  setSkipped: (skipped) => set({ skipped }),
  reset: () => set({ phase: "idle", revealIndex: -1, skipped: false }),
}));
