"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { MatchPlayer, BattleRoundState, PlayedCard } from "@/lib/game/types";
import { getArenaIdForMatch } from "@/lib/game/art";
import { COLORS } from "@/lib/design/tokens";
import { PlayerHud } from "@/components/game/player-hud";
import { PlayedCardsZone } from "@/components/game/played-cards-zone";
import { BattlefieldZone } from "@/components/game/battlefield-zone";
import { SkillCallout } from "@/components/game/skill-callout";
import {
  useGameAnimations,
  useSyncAbilityViewer,
} from "@/components/game/animation-provider";
import { useScreenShake } from "@/hooks/use-screen-shake";
import {
  burstAt,
  characterWorldPosition,
  floatDamageAt,
  useGameEffectStore,
} from "@/lib/three/effect-store";
import { cn } from "@/lib/utils";

const BattleScene = dynamic(
  () =>
    import("@/components/game/battle-scene").then((m) => m.BattleScene),
  { ssr: false, loading: () => null },
);

interface BattleArenaProps {
  opponent: MatchPlayer;
  player: MatchPlayer;
  playedCards: PlayedCard[];
  battleRound?: BattleRoundState;
  shakeTarget?: 1 | 2 | null;
  myPlayerNum?: 1 | 2;
  className?: string;
}

export function BattleArena({
  opponent,
  player,
  playedCards,
  battleRound,
  myPlayerNum = 1,
  className,
}: BattleArenaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useScreenShake(containerRef);
  useSyncAbilityViewer(myPlayerNum);

  const { current: animCurrent, activeCardName, callout } = useGameAnimations();
  const triggerShake = useGameEffectStore((s) => s.triggerShake);
  const setPendingEffect = useGameEffectStore((s) => s.setPendingEffect);
  const triggerHitStop = useGameEffectStore((s) => s.triggerHitStop);

  const matchP1 = myPlayerNum === 1 ? player : opponent;
  const matchP2 = myPlayerNum === 1 ? opponent : player;
  const arenaId = getArenaIdForMatch(matchP1.characterId, matchP2.characterId);
  const mySide: "player1" | "player2" =
    myPlayerNum === 1 ? "player1" : "player2";
  const oppSide: "player1" | "player2" =
    myPlayerNum === 1 ? "player2" : "player1";

  const lastAnimKey = useRef<string | null>(null);

  useEffect(() => {
    if (!animCurrent) return;
    const key = `${animCurrent.kind}-${animCurrent.playerNum}-${animCurrent.value}-${animCurrent.cardName}`;
    if (lastAnimKey.current === key) return;
    lastAnimKey.current = key;

    const targetNum = animCurrent.playerNum;
    if (!targetNum) return;

    const isLeftVisual = targetNum === myPlayerNum;
    const side: "player1" | "player2" =
      targetNum === 1 ? "player1" : "player2";
    const pos = characterWorldPosition(isLeftVisual);
    const effectId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (animCurrent.kind === "damage" && animCurrent.value) {
      const isCrit =
        typeof animCurrent.value === "number" && animCurrent.value >= 40;
      setPendingEffect(side, {
        type: "damage",
        amount: animCurrent.value,
        isCrit,
        id: effectId,
      });
      floatDamageAt(pos, animCurrent.value, isCrit ? "crit" : "damage");
      burstAt(pos, isCrit ? "crit" : "hit", isCrit ? "#FF8800" : COLORS.red_hot, isCrit ? 40 : 28);
      triggerShake(isCrit ? "crit" : "damage");
      if (isCrit) triggerHitStop(100); // TZ v4: real Three.js freeze via getPresentationDelta
    } else if (animCurrent.kind === "heal") {
      setPendingEffect(side, { type: "heal", amount: 15, id: effectId });
      floatDamageAt(pos, 15, "heal");
      burstAt(pos, "heal", COLORS.text_heal, 20);
    } else if (animCurrent.kind === "block") {
      setPendingEffect(side, { type: "block", id: effectId });
      floatDamageAt(pos, 0, "block");
      burstAt(pos, "block", COLORS.cyan_cool, 18);
      triggerShake("light");
    } else if (animCurrent.kind === "energy") {
      floatDamageAt(pos, 1, "energy");
      burstAt(pos, "energy", COLORS.gold, 16);
    } else if (animCurrent.kind === "form_change") {
      setPendingEffect(side, { type: "transform", id: effectId });
      burstAt(pos, "transform", COLORS.gold_glow, 36);
      triggerShake("crit");
    }
  }, [
    animCurrent,
    myPlayerNum,
    setPendingEffect,
    triggerShake,
    triggerHitStop,
  ]);

  const round = battleRound ?? {
    p1Card: null,
    p2Card: null,
    revealed: false,
    resolving: false,
  };

  const opponentSide = myPlayerNum === 1 ? "right" : "left";
  const playerSide = myPlayerNum === 1 ? "left" : "right";
  const showOpponentCallout =
    callout?.playerNum === (myPlayerNum === 1 ? 2 : 1);
  const showPlayerCallout = callout?.playerNum === myPlayerNum;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full min-h-[60vh] overflow-hidden rounded-xl border border-zinc-700/60",
        className,
      )}
      style={{ background: COLORS.bg_void }}
    >
      <BattleScene
        left={{
          characterId: player.characterId,
          form: player.currentForm,
          hp: player.hp,
          maxHp: player.maxHp,
          side: mySide,
        }}
        right={{
          characterId: opponent.characterId,
          form: opponent.currentForm,
          hp: opponent.hp,
          maxHp: opponent.maxHp,
          side: oppSide,
        }}
        arenaId={arenaId}
      />

      <PlayerHud
        player={opponent}
        label="Соперник"
        align="right"
        showEnergy={false}
        className="absolute right-3 top-3 z-20 max-w-[280px]"
      />
      <PlayerHud
        player={player}
        label="Вы"
        align="left"
        showEnergy
        className="absolute left-3 top-3 z-20 max-w-[280px]"
      />

      <SkillCallout
        label={callout?.cardName ?? ""}
        visible={!!showOpponentCallout && !!callout?.cardName}
        side={opponentSide}
        rarity={callout?.rarity}
      />
      <SkillCallout
        label={callout?.cardName ?? ""}
        visible={!!showPlayerCallout && !!callout?.cardName}
        side={playerSide}
        rarity={callout?.rarity}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-3 px-4">
        {(round.p1Card || round.p2Card) && (
          <div className="pointer-events-auto">
            <BattlefieldZone
              p1Card={round.p1Card}
              p2Card={round.p2Card}
              revealed={round.revealed}
              myPlayerNum={myPlayerNum}
            />
          </div>
        )}
        <div className="pointer-events-auto">
          <PlayedCardsZone
            cards={playedCards}
            highlightCardName={activeCardName}
          />
        </div>
      </div>
    </div>
  );
}
