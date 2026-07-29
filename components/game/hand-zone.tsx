"use client";

import { useRef, useState } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { AbilityCard, MatchPlayer } from "@/lib/game/types";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { EnergyDisplay } from "@/components/game/energy-display";
import { PileIndicator } from "@/components/game/pile-indicator";
import {
  getEffectiveCardCost,
  getSanctionPenalty,
} from "@/lib/game/effects";
import { COLORS } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { useCardPlayAnimation } from "@/hooks/use-card-play-animation";
import type { GateReason } from "@/lib/game-flow/ActionGate";

interface HandZoneProps {
  player: MatchPlayer;
  visible: boolean;
  canInteract: boolean;
  playing: boolean;
  softLock?: boolean;
  gateReason?: GateReason;
  onPlayCard: (cardId: string) => void;
  onPassTurn: () => void;
}

function statusHint(
  canInteract: boolean,
  softLock: boolean,
  gateReason?: GateReason,
): string {
  if (canInteract) return "Выберите карту для раунда";
  if (softLock || gateReason === "presentation_busy") {
    return "Разыгрывается эффект…";
  }
  if (gateReason === "network_playing") return "Отправка действия…";
  if (gateReason === "already_submitted") {
    return "Карта выбрана — ожидание соперника";
  }
  return "Ожидание соперника";
}

export function HandZone({
  player,
  visible,
  canInteract,
  playing,
  softLock = false,
  gateReason,
  onPlayCard,
  onPassTurn,
}: HandZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const cardEls = useRef<Map<string, HTMLElement>>(new Map());
  const { playAnimation } = useCardPlayAnimation();

  if (!visible) return null;

  const count = player.hand.length;
  const centerIndex = (count - 1) / 2;
  const MAX_ANGLE = Math.min(8, count * 1.5);
  const xSpacing = count > 0 ? Math.min(120, 900 / Math.max(count, 1)) : 0;
  const locked = !canInteract || playing;

  const handlePlay = (cardId: string) => {
    if (locked) return;
    const el = cardEls.current.get(cardId);
    if (el) {
      playAnimation(el);
    }
    onPlayCard(cardId);
  };

  return (
    <section
      className={cn(
        "rounded-t-xl border border-zinc-700/80 p-4 backdrop-blur-md transition-[opacity,filter] duration-150",
        softLock && "cursor-wait",
      )}
      style={{
        background: "rgba(0,0,0,0.7)",
        opacity: softLock ? 0.55 : 1,
        filter: softLock ? "saturate(0.7)" : undefined,
      }}
      aria-busy={softLock || playing}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2
            className="font-ui text-sm font-medium"
            style={{ color: COLORS.text_primary }}
          >
            Ваша рука
          </h2>
          <p
            className="font-ui text-xs"
            style={{ color: COLORS.text_secondary }}
          >
            {statusHint(canInteract, softLock, gateReason)}
          </p>
        </div>
        <EnergyDisplay current={player.energy} max={player.maxEnergy} />
      </div>

      <div className="flex items-end gap-4">
        <div className="flex shrink-0 gap-3 pb-2">
          <PileIndicator count={player.deck.length} label="Колода" />
          <PileIndicator count={player.discardPile.length} label="Сброс" />
        </div>

        <div className="relative h-[340px] flex-1">
          {player.hand.map((card: AbilityCard, i: number) => {
            const cost =
              getEffectiveCardCost(player, card) + getSanctionPenalty(player);
            const unaffordable = cost > player.energy;
            const playable = canInteract && !unaffordable && !playing;
            const offset = i - centerIndex;
            const angle =
              count <= 1
                ? 0
                : (offset / Math.max(centerIndex, 1)) * MAX_ANGLE;
            const yOffset = Math.abs(offset) * 8;
            const x = offset * xSpacing;
            const isHovered = hoveredId === card.id;

            return (
              <motion.div
                key={card.id}
                className="absolute bottom-0 left-1/2 origin-bottom"
                style={{ marginLeft: -80 }}
                initial={false}
                animate={{
                  x,
                  y: isHovered && playable ? -28 : yOffset,
                  rotate: isHovered && playable ? 0 : angle,
                  scale: isHovered && playable ? 1.06 : 1,
                  zIndex: isHovered ? 100 : i,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                onHoverStart={() => setHoveredId(card.id)}
                onHoverEnd={() =>
                  setHoveredId((id) => (id === card.id ? null : id))
                }
                ref={(node) => {
                  if (node) cardEls.current.set(card.id, node);
                  else cardEls.current.delete(card.id);
                }}
              >
                <AbilityCardView
                  card={card}
                  variant="hand"
                  disabled={!playable}
                  isPlayable={playable}
                  playerEnergy={player.energy}
                  onClick={
                    playable ? () => handlePlay(card.id) : undefined
                  }
                />
              </motion.div>
            );
          })}

          {count === 0 && (
            <p
              className={cn(
                "absolute inset-0 flex items-center justify-center font-ui text-sm",
              )}
              style={{ color: COLORS.text_secondary }}
            >
              Рука пуста
            </p>
          )}
        </div>
      </div>

      {(canInteract || softLock) && (
        <div className="mt-3 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={onPassTurn}
          >
            <SkipForward />
            Пропустить
          </Button>
          <Button size="sm" disabled={locked} onClick={onPassTurn}>
            {playing ? <Loader2 className="animate-spin" /> : "Завершить ход"}
          </Button>
        </div>
      )}
    </section>
  );
}
