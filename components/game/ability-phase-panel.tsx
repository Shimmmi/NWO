"use client";

import { Loader2, SkipForward, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Match, MatchPlayer } from "@/lib/game/types";
import { getCharacterById } from "@/lib/data";
import { hasSkipAbility } from "@/lib/game/effects";
import { cn } from "@/lib/utils";

interface AbilityPhasePanelProps {
  player: MatchPlayer;
  match: Match;
  playerNum: 1 | 2;
  playing: boolean;
  softLock?: boolean;
  onUseAbility: (abilityId: string) => void;
  onPassPhase: () => void;
}

export function AbilityPhasePanel({
  player,
  match,
  playerNum,
  playing,
  softLock = false,
  onUseAbility,
  onPassPhase,
}: AbilityPhasePanelProps) {
  const character = getCharacterById(player.characterId);
  const isMyTurn = match.abilityOrder === playerNum;
  const hasPassed = match.abilityPhasePassed[playerNum];
  const blocked = hasSkipAbility(player);

  if (hasPassed || !isMyTurn) {
    return (
      <section className="rounded-t-xl border border-zinc-700/80 bg-black/70 p-4 backdrop-blur-md">
        <p className="text-center text-sm text-zinc-400">
          {hasPassed
            ? "Вы пропустили фазу способностей"
            : "Ожидание хода соперника в фазе способностей..."}
        </p>
      </section>
    );
  }

  const handleUse = (abilityId: string) => {
    if (softLock || playing) return;
    if (blocked) {
      toast.error("Фаза способностей заблокирована");
      return;
    }
    onUseAbility(abilityId);
  };

  return (
    <section
      className={cn(
        "rounded-t-xl border border-amber-700/50 bg-black/70 p-4 backdrop-blur-md transition-[opacity,filter] duration-150",
        softLock && "cursor-wait",
      )}
      style={{
        opacity: softLock ? 0.55 : 1,
        filter: softLock ? "saturate(0.7)" : undefined,
      }}
      aria-busy={softLock || playing}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <Sparkles className="h-4 w-4" />
            Закрытое заседание
          </h2>
          <p className="text-xs text-zinc-500">
            {softLock
              ? "Разыгрывается эффект…"
              : `Заряды: ${player.charges} · Ваш ход в фазе способностей`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={playing || blocked}
          onClick={() => {
            if (blocked) {
              toast.error("Фаза способностей заблокирована");
              return;
            }
            onPassPhase();
          }}
        >
          {playing ? <Loader2 className="animate-spin" /> : <SkipForward />}
          Пропустить фазу
        </Button>
      </div>

      {blocked && (
        <p className="mb-3 text-center text-sm text-red-400">
          Фаза способностей заблокирована эффектом противника
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {character?.uniqueAbilities.map((ability) => {
          const affordable = player.charges >= ability.chargeCost;
          const locked = playing || blocked || softLock;
          return (
            <button
              key={ability.id}
              type="button"
              disabled={locked || !affordable}
              onClick={() => handleUse(ability.id)}
              className={cn(
                "rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 text-left transition-all",
                affordable && !locked && "hover:border-amber-500/60 hover:bg-zinc-800",
                (!affordable || locked) && "cursor-not-allowed opacity-40",
              )}
            >
              <p className="text-sm font-semibold text-zinc-100">{ability.name}</p>
              <p className="mt-1 text-xs text-amber-400">
                Стоимость: {ability.chargeCost} заряд
                {ability.chargeCost > 1 ? "а" : ""}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                {ability.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
