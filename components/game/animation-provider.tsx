"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CardCategory,
  CombatEvent,
  RoundEvent,
  TurnResolution,
} from "@/lib/game/types";
import { CardAttackAnimation } from "@/components/game/card-attack-animation";
import { CardDefenseAnimation } from "@/components/game/card-defense-animation";
import { CardSupportAnimation } from "@/components/game/card-support-animation";
import { AbilityAnimationProvider } from "@/components/animations/AbilityAnimationProvider";
import { orchestrator } from "@/lib/animations/AbilityAnimationOrchestrator";
import { getCardAnimationConfig } from "@/lib/animations/cardConfigs";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import {
  presentationClock,
  type BeatKind,
  type PresentationBeat,
} from "@/lib/game-flow/PresentationClock";

export type AnimationKind =
  | "card_play"
  | "card_reveal"
  | "card_flip"
  | "callout"
  | "attack"
  | "defense"
  | "support"
  | "damage"
  | "heal"
  | "block"
  | "energy"
  | "form_change"
  | "objection";

export interface AnimationEvent {
  kind: AnimationKind;
  playerNum?: 1 | 2;
  value?: number;
  cardName?: string;
  cardId?: string;
  characterId?: string;
  rarity?: CombatEvent["rarity"];
  category?: CardCategory;
}

interface AnimationContextValue {
  queue: AnimationEvent[];
  current: AnimationEvent | null;
  activeCardName: string | null;
  callout: AnimationEvent | null;
  enqueueFromResolution: (resolution: TurnResolution | undefined) => void;
  enqueueRoundEvents: (events: RoundEvent[]) => void;
  enqueueCallout: (event: {
    cardName: string;
    playerNum: 1 | 2;
    rarity?: CombatEvent["rarity"];
  }) => void;
}

const AnimationContext = createContext<AnimationContextValue | null>(null);

const HIGHLIGHT_KINDS: AnimationKind[] = [
  "card_play",
  "card_flip",
  "callout",
  "attack",
  "defense",
  "support",
];

const CALLOUT_CHIP_MS = 400;
const FLIP_MS = 300;
const CATEGORY_MS = 400;
const IMPACT_MS = 400;
const SETTLE_MS = 150;

function baseCardId(cardId: string | undefined): string {
  return (cardId ?? "").split("#")[0];
}

function resolveCinematicRarity(
  cardId: string | undefined,
  rarity?: CombatEvent["rarity"],
): "epic" | "legendary" | null {
  if (rarity === "epic" || rarity === "legendary") return rarity;
  const cfg = getCardAnimationConfig(baseCardId(cardId));
  return cfg?.rarity ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Short name chip only — never 3–5s rarity callouts (TZ v4). */
function withChipCallout(event: AnimationEvent): AnimationEvent[] {
  if (!event.cardName) return [event];
  if (
    event.kind === "objection" ||
    event.kind === "damage" ||
    event.kind === "heal" ||
    event.kind === "block" ||
    event.kind === "energy"
  ) {
    return [event];
  }
  return [
    {
      kind: "callout",
      playerNum: event.playerNum,
      cardName: event.cardName,
      rarity: event.rarity ?? "rare",
    },
    event,
  ];
}

function buildRoundQueue(
  events: RoundEvent[],
  alreadyPlayed: Set<string>,
): AnimationEvent[] {
  const queue: AnimationEvent[] = [];

  for (const event of events) {
    if (event.kind === "submit") continue;

    const cinematic = resolveCinematicRarity(event.cardId);
    const rarity = cinematic ?? "rare";

    if (event.kind === "reveal") {
      // Impact-first: flip only, no blocking callout
      queue.push({
        kind: "card_flip",
        playerNum: event.playerNum,
        cardName: event.cardName,
        cardId: event.cardId,
        category: event.category,
        rarity,
      });
    }

    if (event.kind === "resolve") {
      if (cinematic && !alreadyPlayed.has(event.cardId)) {
        alreadyPlayed.add(event.cardId);
        queue.push({
          kind: "objection",
          cardName: event.cardName,
          cardId: event.cardId,
          playerNum: event.playerNum,
          rarity: cinematic,
        });
      }

      if (cinematic) {
        queue.push({
          kind: event.category,
          playerNum: event.playerNum,
          cardName: event.cardName,
          cardId: event.cardId,
          category: event.category,
          rarity: cinematic,
        });
      } else {
        // Ordinary/rare: short chip + category (impact follows from resolution tail)
        queue.push(
          ...withChipCallout({
            kind: event.category,
            playerNum: event.playerNum,
            cardName: event.cardName,
            cardId: event.cardId,
            category: event.category,
            rarity,
          }),
        );
      }
    }
  }

  return queue;
}

function buildResolutionTail(
  resolution: TurnResolution,
  cinematicPlayed: Set<string>,
  impactPlayed: Set<string>,
): AnimationEvent[] {
  const queue: AnimationEvent[] = [];
  let addedCombatImpacts = false;

  for (const event of resolution.combatEvents) {
    const impactKey = `${event.cardId}:${event.turn}`;
    if (impactPlayed.has(impactKey)) continue;
    impactPlayed.add(impactKey);
    addedCombatImpacts = true;

    const cinematic = resolveCinematicRarity(event.cardId, event.rarity);

    if (cinematic && !cinematicPlayed.has(event.cardId)) {
      cinematicPlayed.add(event.cardId);
      queue.push({
        kind: "objection",
        cardName: event.cardName,
        cardId: event.cardId,
        playerNum: event.playerNum,
        rarity: cinematic,
      });
    }

    if (!cinematic) {
      queue.push({
        kind: "card_play",
        playerNum: event.playerNum,
        cardName: event.cardName,
        cardId: event.cardId,
        rarity: event.rarity,
        category: event.category,
      });
    }

    for (const effect of event.effects) {
      const lower = effect.toLowerCase();
      if (
        lower.includes("урона") ||
        lower.includes("урон") ||
        lower.includes("крит")
      ) {
        const match =
          effect.match(/(\d+)\s*урона/) ?? effect.match(/крит\s*(\d+)/i);
        queue.push({
          kind: "damage",
          playerNum: event.playerNum === 1 ? 2 : 1,
          value: match ? Number(match[1]) : undefined,
        });
      } else if (lower.includes("hp") || lower.includes("леч")) {
        queue.push({ kind: "heal", playerNum: event.playerNum });
      } else if (lower.includes("блок")) {
        queue.push({ kind: "block", playerNum: event.playerNum });
      } else if (lower.includes("энерг")) {
        queue.push({ kind: "energy", playerNum: event.playerNum });
      }
    }
  }

  // Aggregate damage only when combat-event impacts were not already staged
  if (!addedCombatImpacts) {
    if (resolution.damageDealt.to1 > 0) {
      queue.push({
        kind: "damage",
        playerNum: 1,
        value: resolution.damageDealt.to1,
      });
    }
    if (resolution.damageDealt.to2 > 0) {
      queue.push({
        kind: "damage",
        playerNum: 2,
        value: resolution.damageDealt.to2,
      });
    }
  }

  if (queue.length > 0) {
    queue.push({ kind: "card_play", cardName: "__settle__" });
  }

  return queue;
}

function getEventDuration(event: AnimationEvent): number {
  if (event.kind === "callout") return CALLOUT_CHIP_MS;
  if (event.kind === "objection") {
    const cfg = event.cardId
      ? getCardAnimationConfig(event.cardId)
      : undefined;
    return (
      cfg?.timing.totalDuration ??
      (event.rarity === "legendary" ? 2800 : 1400)
    );
  }
  if (
    event.kind === "attack" ||
    event.kind === "defense" ||
    event.kind === "support"
  ) {
    return CATEGORY_MS;
  }
  if (event.kind === "card_flip") return FLIP_MS;
  if (event.cardName === "__settle__") return SETTLE_MS;
  return IMPACT_MS;
}

function toBeatKind(event: AnimationEvent): BeatKind {
  if (event.kind === "objection") return "cinematic";
  if (event.kind === "card_flip") return "card_flip";
  if (event.kind === "callout") return "callout_chip";
  if (
    event.kind === "attack" ||
    event.kind === "defense" ||
    event.kind === "support"
  ) {
    return "category";
  }
  if (
    event.kind === "damage" ||
    event.kind === "heal" ||
    event.kind === "block" ||
    event.kind === "energy"
  ) {
    return "impact";
  }
  if (event.cardName === "__settle__") return "settle";
  return "settle";
}

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AnimationEvent | null>(null);
  const [categoryAnim, setCategoryAnim] = useState<AnimationEvent | null>(
    null,
  );
  const [callout, setCallout] = useState<AnimationEvent | null>(null);
  const cinematicPlayedRef = useRef(new Set<string>());
  const impactPlayedRef = useRef(new Set<string>());
  const playEventRef = useRef<(event: AnimationEvent) => Promise<void>>(
    async () => undefined,
  );

  const activeCardName =
    current &&
    HIGHLIGHT_KINDS.includes(current.kind) &&
    current.cardName &&
    current.cardName !== "__settle__"
      ? current.cardName
      : (callout?.cardName ?? null);

  playEventRef.current = async (event: AnimationEvent) => {
    if (event.cardName === "__settle__") {
      await sleep(SETTLE_MS);
      return;
    }

    setCurrent(event);

    try {
      if (event.kind === "objection") {
        const playerNum = event.playerNum ?? 1;
        const cardId = event.cardId ?? "";
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          void orchestrator.play(cardId, playerNum, done);
          window.setTimeout(done, getEventDuration(event) + 800);
        });
        return;
      }

      if (event.kind === "callout") {
        setCallout(event);
        await sleep(CALLOUT_CHIP_MS);
        setCallout(null);
        return;
      }

      if (
        event.kind === "attack" ||
        event.kind === "defense" ||
        event.kind === "support"
      ) {
        setCategoryAnim(event);
        await sleep(CATEGORY_MS);
        setCategoryAnim(null);
        return;
      }

      await sleep(getEventDuration(event));
    } finally {
      setCurrent(null);
    }
  };

  const scheduleBatch = useCallback(
    (
      events: AnimationEvent[],
      source: "round_resolve" | "turn_resolution" | "ability",
      roundKey: string,
    ) => {
      if (events.length === 0) return;

      const beats: PresentationBeat[] = events.map((event, index) => ({
        id: `${source}-${roundKey}-${event.kind}-${index}`,
        kind: toBeatKind(event),
        durationMs: getEventDuration(event),
        run: () => playEventRef.current(event),
      }));

      void presentationClock.beginBatch({
        source,
        roundKey,
        beats,
      });
    },
    [],
  );

  const enqueueFromResolution = useCallback(
    (resolution: TurnResolution | undefined) => {
      if (!resolution) return;
      const tail = buildResolutionTail(
        resolution,
        cinematicPlayedRef.current,
        impactPlayedRef.current,
      );
      if (tail.length === 0) return;
      scheduleBatch(
        tail,
        "turn_resolution",
        `turn-${resolution.turn}-${Date.now()}`,
      );
      if (cinematicPlayedRef.current.size > 64) {
        cinematicPlayedRef.current.clear();
      }
      if (impactPlayedRef.current.size > 128) {
        impactPlayedRef.current.clear();
      }
    },
    [scheduleBatch],
  );

  const enqueueRoundEvents = useCallback(
    (events: RoundEvent[]) => {
      if (events.length === 0) return;
      const built = buildRoundQueue(events, cinematicPlayedRef.current);
      if (built.length === 0) return;
      const key = `round-${events.map((e) => e.cardId).join("-").slice(0, 48)}-${Date.now()}`;
      scheduleBatch(built, "round_resolve", key);
    },
    [scheduleBatch],
  );

  const enqueueCallout = useCallback(
    (event: {
      cardName: string;
      playerNum: 1 | 2;
      rarity?: CombatEvent["rarity"];
    }) => {
      scheduleBatch(
        [
          {
            kind: "callout",
            cardName: event.cardName,
            playerNum: event.playerNum,
            rarity: event.rarity ?? "rare",
          },
        ],
        "ability",
        `ability-${event.cardName}-${Date.now()}`,
      );
    },
    [scheduleBatch],
  );

  useEffect(() => {
    return () => {
      presentationClock.hardReset();
      orchestrator.kill();
    };
  }, []);

  return (
    <AnimationContext.Provider
      value={{
        queue: [],
        current,
        activeCardName,
        callout,
        enqueueFromResolution,
        enqueueRoundEvents,
        enqueueCallout,
      }}
    >
      <AbilityAnimationProvider>
        {children}
        {categoryAnim?.kind === "attack" && (
          <CardAttackAnimation
            visible
            side={categoryAnim.playerNum === 1 ? "left" : "right"}
          />
        )}
        {categoryAnim?.kind === "defense" && (
          <CardDefenseAnimation
            visible
            side={categoryAnim.playerNum === 1 ? "left" : "right"}
          />
        )}
        {categoryAnim?.kind === "support" && (
          <CardSupportAnimation
            visible
            side={categoryAnim.playerNum === 1 ? "left" : "right"}
          />
        )}
      </AbilityAnimationProvider>
    </AnimationContext.Provider>
  );
}

export function useSyncAbilityViewer(localPlayerNum: 1 | 2) {
  useEffect(() => {
    useAbilityAnimationStore.getState().setLocalPlayerNum(localPlayerNum);
  }, [localPlayerNum]);
}

export function useGameAnimations() {
  const ctx = useContext(AnimationContext);
  if (!ctx) {
    throw new Error("useGameAnimations must be used within AnimationProvider");
  }
  return ctx;
}
