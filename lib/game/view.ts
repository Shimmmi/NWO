import type { Match, RoundEvent, TurnRecord } from "@/lib/game/types";
import type { OpponentView, PlayerNum, PlayerView } from "@/lib/net/protocol";

/**
 * Единственная проекция матча, которой разрешено покидать сервер (ЧАСТЬ 10 ТЗ).
 * Всё, что игрок не должен знать — рука и колода соперника, его нераскрытая
 * карта раунда, его submit-события — здесь не появляется вообще, а не
 * маскируется: замаскированный массив рано или поздно наполнят реальными id.
 */
export function toPlayerView(match: Match, playerNum: PlayerNum): PlayerView {
  const opponentNum: PlayerNum = playerNum === 1 ? 2 : 1;
  const me = playerNum === 1 ? match.player1 : match.player2;
  const opp = playerNum === 1 ? match.player2 : match.player1;

  const { revealed } = match.battleRound;
  const myCard = playerNum === 1 ? match.battleRound.p1Card : match.battleRound.p2Card;
  const opponentCard =
    playerNum === 1 ? match.battleRound.p2Card : match.battleRound.p1Card;

  const opponent: OpponentView = {
    playerNum: opponentNum,
    id: opp.id,
    nickname: opp.nickname,
    characterId: opp.characterId,
    currentForm: opp.currentForm,
    hp: opp.hp,
    maxHp: opp.maxHp,
    armor: opp.armor,
    energy: opp.energy,
    maxEnergy: opp.maxEnergy,
    strength: opp.strength,
    speed: opp.speed,
    charges: opp.charges,
    handCount: opp.hand.length,
    deckCount: opp.deck.length,
    // Сброс публичен: карты уже отыграны, а их счёт — элемент скилла.
    discardPile: opp.discardPile,
    activeEffects: opp.activeEffects,
    isAi: opp.isAi,
    relicId: opp.relicId,
  };

  return {
    id: match.id,
    currentTurn: match.currentTurn,
    phase: match.phase,
    abilityOrder: match.abilityOrder,
    abilityPhasePassed: match.abilityPhasePassed,
    status: match.status,
    winner: match.winner,
    turnDeadline: match.turnDeadline,
    createdAt: match.createdAt,

    me: { ...me, playerNum },
    opponent,

    battleRound: {
      myCard,
      opponentCard: revealed ? opponentCard : null,
      opponentSubmitted: opponentCard !== null,
      revealed,
      resolving: match.battleRound.resolving,
    },

    roundEvents: visibleRoundEvents(match.roundEvents, playerNum, revealed),
    combatLog: match.combatLog,
    turnHistory: match.turnHistory.map((turn) => redactTurn(turn, playerNum)),
    turnPassed: match.turnPassed,
    abilityPhaseCards: match.abilityPhaseCards,
    lastResolution: match.lastResolution,
  };
}

/**
 * История ходов нужна экрану итогов, но только числами: сколько карт сыграно и
 * сколько урона прошло. Чужие id из неё вычищаются — сброс тасуется обратно в
 * колоду, и старая запись превратилась бы в подсказку о её содержимом.
 */
function redactTurn(turn: TurnRecord, playerNum: PlayerNum): TurnRecord {
  const mask = (cards: string[]): string[] =>
    cards.map((_, i) => `played-${turn.turn}-${i}`);

  return {
    turn: turn.turn,
    player1Cards: playerNum === 1 ? turn.player1Cards : mask(turn.player1Cards),
    player2Cards: playerNum === 2 ? turn.player2Cards : mask(turn.player2Cards),
    damageDealt: turn.damageDealt,
    events: turn.events,
  };
}

/** Чужая подача до раскрытия несёт id, имя, категорию и скорость — вырезаем событие целиком. */
function visibleRoundEvents(
  events: RoundEvent[],
  playerNum: PlayerNum,
  revealed: boolean,
): RoundEvent[] {
  if (revealed) return events;
  return events.filter(
    (e) => !(e.kind === "submit" && e.playerNum !== playerNum),
  );
}
