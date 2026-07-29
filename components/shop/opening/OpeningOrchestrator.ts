import type { OpeningPhase } from "@/lib/stores/openingStore";
import type { PackOpenResult } from "@/lib/shop/packRoll";
import type { BoosterSku } from "@/lib/shop/catalog";

export interface OpeningInput {
  sku: BoosterSku;
  result: PackOpenResult;
  reducedMotion: boolean;
  onPhase: (phase: OpeningPhase, revealIndex: number) => void;
  onComplete: () => void;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Lightweight timeline driver (no GSAP dependency required for shop path).
 * Timings aligned with TZ v6 §7.3.
 */
export class OpeningOrchestrator {
  private timers: Timer[] = [];
  private aborted = false;
  private input: OpeningInput | null = null;
  private revealAt = 0;

  play(input: OpeningInput): void {
    this.dispose();
    this.aborted = false;
    this.input = input;
    const scale = input.reducedMotion ? 0.35 : 1;

    const at = (ms: number, fn: () => void) => {
      this.timers.push(setTimeout(fn, ms * scale));
    };

    const cards = input.result.cards;
    const hasBonus = cards.some((c) => c.slot === "bonus");
    const elite = cards.find((c) => c.slot === "elite");
    const legendary = elite?.rarity === "legendary";

    input.onPhase("purchase_handoff", -1);
    at(400, () => input.onPhase("pack_present", -1));
    at(1600, () => input.onPhase("tear_rip", -1));
    at(2400, () => input.onPhase("stack_rise", -1));

    const revealStarts = [3000, 3400, 3800, 4200, 4600, 5200, 5800];
    const mainCards = cards.filter((c) => c.slot !== "bonus");
    mainCards.forEach((card, i) => {
      const t = revealStarts[i] ?? 5800 + i * 400;
      at(t, () => {
        if (card.rarity === "legendary" && card.slot === "elite") {
          input.onPhase("legendary_interrupt", i);
        } else {
          input.onPhase("reveal", i);
        }
      });
    });

    const afterElite = legendary ? 6600 : 6400;
    if (hasBonus) {
      at(afterElite, () => input.onPhase("bonus_tease", mainCards.length));
      at(afterElite + 600, () => {
        this.revealAt = cards.length - 1;
        input.onPhase("summary", cards.length - 1);
      });
    } else {
      at(afterElite + 200, () => {
        this.revealAt = mainCards.length - 1;
        input.onPhase("summary", mainCards.length - 1);
      });
    }
  }

  skipOne(): void {
    if (!this.input) return;
    const cards = this.input.result.cards.filter((c) => c.slot !== "bonus");
    const next = Math.min(cards.length - 1, this.revealAt + 1);
    this.revealAt = next;
    this.input.onPhase("reveal", next);
  }

  skipToSummary(): void {
    if (!this.input) return;
    this.clearTimers();
    const last = this.input.result.cards.length - 1;
    this.revealAt = last;
    this.input.onPhase("summary", last);
  }

  complete(): void {
    if (this.aborted || !this.input) return;
    this.input.onPhase("exit", this.revealAt);
    this.input.onComplete();
  }

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  dispose(): void {
    this.aborted = true;
    this.clearTimers();
    this.input = null;
  }
}
