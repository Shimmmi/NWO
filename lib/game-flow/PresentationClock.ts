"use client";

import { usePresentationStore } from "./presentationStore";

export type BeatKind =
  | "local_ack"
  | "card_flip"
  | "cinematic"
  | "category"
  | "impact"
  | "callout_chip"
  | "phase_banner"
  | "settle";

export interface PresentationBeat {
  id: string;
  kind: BeatKind;
  durationMs: number;
  run: () => Promise<void>;
  parallelGroup?: string;
}

export interface PresentationBatch {
  id: string;
  source: "round_resolve" | "turn_resolution" | "ability" | "local";
  roundKey: string;
  beats: PresentationBeat[];
}

export interface PresentationClock {
  readonly isIdle: boolean;
  readonly activeBatchId: string | null;
  beginBatch(
    batch: Omit<PresentationBatch, "id"> & { id?: string },
  ): Promise<void>;
  waitUntilIdle(): Promise<void>;
  onIdle(cb: () => void): () => void;
  hardReset(): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function groupBeats(beats: PresentationBeat[]): PresentationBeat[][] {
  const groups: PresentationBeat[][] = [];
  for (const beat of beats) {
    const last = groups[groups.length - 1];
    if (
      last &&
      beat.parallelGroup &&
      last[0]?.parallelGroup === beat.parallelGroup
    ) {
      last.push(beat);
    } else {
      groups.push([beat]);
    }
  }
  return groups;
}

class PresentationClockImpl implements PresentationClock {
  private chain: Promise<void> = Promise.resolve();
  private activeId: string | null = null;
  private pendingDepth = 0;
  private generation = 0;
  private idleListeners = new Set<() => void>();
  private resetControllers = new Set<AbortController>();

  get isIdle(): boolean {
    return (
      this.pendingDepth === 0 && usePresentationStore.getState().isIdle
    );
  }

  get activeBatchId(): string | null {
    return this.activeId;
  }

  private notifyIdle(): void {
    for (const cb of [...this.idleListeners]) {
      try {
        cb();
      } catch {
        /* ignore */
      }
    }
  }

  beginBatch(
    batch: Omit<PresentationBatch, "id"> & { id?: string },
  ): Promise<void> {
    if (batch.beats.length === 0) return Promise.resolve();

    const id =
      batch.id ??
      `${batch.source}-${batch.roundKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const full: PresentationBatch = { ...batch, id };

    // Lock gate immediately — including while waiting on the serial chain
    this.pendingDepth += 1;
    usePresentationStore.getState().setBusy(id, "settle");

    const run = async () => {
      const gen = this.generation;
      const ac = new AbortController();
      this.resetControllers.add(ac);

      this.activeId = id;
      usePresentationStore.getState().setBusy(id);

      try {
        for (const step of groupBeats(full.beats)) {
          if (ac.signal.aborted || gen !== this.generation) return;

          usePresentationStore
            .getState()
            .setBusy(id, step[0]?.kind ?? "settle");

          await Promise.all(
            step.map((beat) =>
              Promise.race([
                beat.run().catch((err) => {
                  console.warn("[PresentationClock] beat failed", beat.id, err);
                }),
                sleep(beat.durationMs + 500),
              ]),
            ),
          );
        }
      } finally {
        this.resetControllers.delete(ac);
        if (gen === this.generation) {
          this.pendingDepth = Math.max(0, this.pendingDepth - 1);
          if (this.activeId === id) {
            this.activeId = null;
          }
          // Stay busy if another batch is queued / running
          if (this.pendingDepth === 0) {
            usePresentationStore.getState().setIdle();
            this.notifyIdle();
          }
        }
      }
    };

    // Serialize batches: never stack round presentations
    const next = this.chain.then(run, run);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  waitUntilIdle(): Promise<void> {
    if (this.isIdle && !this.activeId) return Promise.resolve();
    return new Promise((resolve) => {
      const off = this.onIdle(() => {
        off();
        resolve();
      });
    });
  }

  onIdle(cb: () => void): () => void {
    this.idleListeners.add(cb);
    if (this.isIdle && !this.activeId) {
      queueMicrotask(() => {
        if (this.isIdle && !this.activeId) cb();
      });
    }
    return () => {
      this.idleListeners.delete(cb);
    };
  }

  hardReset(): void {
    this.generation += 1;
    for (const ac of this.resetControllers) {
      ac.abort();
    }
    this.resetControllers.clear();
    this.activeId = null;
    this.pendingDepth = 0;
    this.chain = Promise.resolve();
    usePresentationStore.getState().setIdle();
    this.notifyIdle();
  }
}

export const presentationClock: PresentationClock = new PresentationClockImpl();
