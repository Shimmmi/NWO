"use client";

import { create } from "zustand";

interface PresentationState {
  isIdle: boolean;
  activeBatchId: string | null;
  activeBeatKind: string | null;
  softLock: boolean;
  setBusy: (batchId: string, beatKind?: string) => void;
  setIdle: () => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  isIdle: true,
  activeBatchId: null,
  activeBeatKind: null,
  softLock: false,
  setBusy: (batchId, beatKind) =>
    set({
      isIdle: false,
      activeBatchId: batchId,
      activeBeatKind: beatKind ?? null,
      softLock: true,
    }),
  setIdle: () =>
    set({
      isIdle: true,
      activeBatchId: null,
      activeBeatKind: null,
      softLock: false,
    }),
}));
