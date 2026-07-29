import type { Match } from "@/lib/game/types";
import type { BattleResultStats } from "@/components/game/battle-result";

/**
 * Считает итоги матча. Основной источник — turnHistory (числа урона и
 * длины массивов карт). combatLog — страховка на случай, если история
 * ещё не успела доехать в проекцию.
 */
export function computeBattleStats(
  match: Match,
  playerNum: 1 | 2,
): BattleResultStats {
  let totalDamageDealt = 0;
  let totalDamageTaken = 0;
  let cardsPlayed = 0;
  let maxDamageInOneTurn = 0;
  let totalHealed = 0;

  for (const turn of match.turnHistory) {
    const dealt =
      playerNum === 1 ? turn.damageDealt.to2 : turn.damageDealt.to1;
    const taken =
      playerNum === 1 ? turn.damageDealt.to1 : turn.damageDealt.to2;
    totalDamageDealt += dealt;
    totalDamageTaken += taken;
    maxDamageInOneTurn = Math.max(maxDamageInOneTurn, dealt);
    cardsPlayed +=
      playerNum === 1
        ? turn.player1Cards.length
        : turn.player2Cards.length;

    for (const ev of turn.events ?? []) {
      if (ev.toLowerCase().includes("hp") || ev.toLowerCase().includes("леч")) {
        const m = ev.match(/\+(\d+)/);
        if (m) totalHealed += Number(m[1]);
      }
    }
  }

  // Если история пуста (старый снапшот / незавершённый ход) — считаем по логу.
  if (cardsPlayed === 0 && match.combatLog?.length) {
    const seen = new Set<string>();
    for (const ev of match.combatLog) {
      if (ev.playerNum !== playerNum) continue;
      if (seen.has(ev.cardId)) continue;
      seen.add(ev.cardId);
    }
    cardsPlayed = seen.size;
  }

  for (const ev of match.combatLog ?? []) {
    if (ev.playerNum !== playerNum) continue;
    for (const effect of ev.effects) {
      if (effect.toLowerCase().includes("hp") || effect.includes("+")) {
        const m = effect.match(/\+(\d+)\s*HP/i) ?? effect.match(/\+(\d+)/);
        if (m) totalHealed += Number(m[1]);
      }
    }
  }

  // Урон из combatLog, если turnHistory не дал чисел (тот же фолбэк).
  if (totalDamageDealt === 0 && totalDamageTaken === 0 && match.combatLog?.length) {
    for (const ev of match.combatLog) {
      for (const effect of ev.effects) {
        const hit = effect.match(/(-?\d+)\s*(?:урона|dmg|damage)/i);
        if (!hit) continue;
        const amount = Math.abs(Number(hit[1]));
        if (ev.playerNum === playerNum) totalDamageDealt += amount;
        else totalDamageTaken += amount;
        if (ev.playerNum === playerNum) {
          maxDamageInOneTurn = Math.max(maxDamageInOneTurn, amount);
        }
      }
    }
  }

  return {
    totalTurns: match.currentTurn,
    totalDamageDealt,
    totalDamageTaken,
    cardsPlayed,
    totalHealed,
    maxDamageInOneTurn,
  };
}
