"use client";

/** Procedural Ace Attorney–style stings via Web Audio (no asset files). */
export class AbilityAudioSystem {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playEpicSting(characterId: string) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const colors: Record<string, number> = {
      "donald-rumpf": 880,
      "vladimir-pu": 220,
      "jin-shi": 660,
      "vlado-zelenko": 1100,
    };

    const baseFreq = colors[characterId] ?? 440;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(baseFreq * 2, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      baseFreq,
      ctx.currentTime + 0.1,
    );
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  playLegendarySting(characterId: string) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.frequency.setValueAtTime(60, ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.3);
    subGain.gain.setValueAtTime(0.45, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    sub.start();
    sub.stop(ctx.currentTime + 0.5);

    // Character-colored mid sting
    const mid = ctx.createOscillator();
    const midGain = ctx.createGain();
    mid.connect(midGain);
    midGain.connect(ctx.destination);
    const midFreq =
      characterId === "vladimir-pu"
        ? 180
        : characterId === "donald-rumpf"
          ? 440
          : characterId === "jin-shi"
            ? 520
            : 660;
    mid.frequency.setValueAtTime(midFreq * 1.5, ctx.currentTime);
    mid.frequency.exponentialRampToValueAtTime(
      midFreq,
      ctx.currentTime + 0.15,
    );
    midGain.gain.setValueAtTime(0.2, ctx.currentTime);
    midGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    mid.start();
    mid.stop(ctx.currentTime + 0.35);

    setTimeout(() => {
      const c = this.getCtx();
      if (!c) return;
      const whoosh = c.createOscillator();
      const whooshGain = c.createGain();
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2000;

      whoosh.connect(filter);
      filter.connect(whooshGain);
      whooshGain.connect(c.destination);

      whoosh.type = "sawtooth";
      whoosh.frequency.setValueAtTime(4000, c.currentTime);
      whoosh.frequency.exponentialRampToValueAtTime(
        800,
        c.currentTime + 0.2,
      );
      whooshGain.gain.setValueAtTime(0.12, c.currentTime);
      whooshGain.gain.exponentialRampToValueAtTime(
        0.001,
        c.currentTime + 0.25,
      );
      whoosh.start();
      whoosh.stop(c.currentTime + 0.25);
    }, 350);
  }
}

export const audioSystem =
  typeof window !== "undefined" ? new AbilityAudioSystem() : null;
