"use client";

import type { CombatEvent, TurnRecord } from "@/lib/game/types";
import { getRarityLabel } from "@/lib/game/art";
import { cn } from "@/lib/utils";

interface CombatLogPanelProps {
  combatLog: CombatEvent[];
  turnHistory?: TurnRecord[];
  lastResolutionTurn?: number;
  className?: string;
}

export function CombatLogPanel({
  combatLog,
  turnHistory = [],
  lastResolutionTurn,
  className,
}: CombatLogPanelProps) {
  const entries =
    combatLog.length > 0
      ? combatLog.slice(-20).reverse()
      : turnHistory
          .slice(-5)
          .reverse()
          .flatMap((t) =>
            (t.combatEvents ?? []).map((e) => ({ ...e, fromHistory: true })),
          );

  return (
    <section
      className={cn(
        "rounded-lg border border-zinc-700/80 bg-black/60 backdrop-blur-sm",
        className,
      )}
    >
      {!className?.includes("border-0") && (
        <h2 className="border-b border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300">
          Журнал боя
        </h2>
      )}
      <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-zinc-500">Событий пока нет</p>
        ) : (
          entries.map((entry, i) => (
            <div
              key={`${entry.turn}-${entry.cardId}-${entry.playerNum}-${i}`}
              className={cn(
                "rounded border border-zinc-800 bg-zinc-900/80 p-2 text-xs",
                entry.turn === lastResolutionTurn && "border-yellow-500/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-200">
                  Ход {entry.turn} · {entry.playerName}
                </span>
                {entry.rarity && (
                  <span className="text-zinc-500">
                    {getRarityLabel(entry.rarity)}
                  </span>
                )}
              </div>
              <p className="font-medium text-zinc-300">«{entry.cardName}»</p>
              <ul className="mt-1 space-y-0.5 text-zinc-400">
                {entry.effects.map((effect, j) => (
                  <li key={j}>→ {effect}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
