import type { AbilityCard, Match, MatchPlayer } from "@/lib/game/types";
import type { PlayerView } from "@/lib/net/protocol";

/**
 * Обратная сторона fog of war: сервер шлёт проекцию, а вся боевая сцена
 * написана вокруг Match. Здесь проекция разворачивается обратно, причём
 * скрытые карты соперника становятся заглушками — на экране они и так
 * рубашки, а настоящих id у клиента нет и быть не должно.
 */
export function viewToMatch(view: PlayerView): Match {
  const me = stripSeat(view.me);
  const opponent = hydrateOpponent(view.opponent);

  const [player1, player2] =
    view.me.playerNum === 1 ? [me, opponent] : [opponent, me];

  const myCard = view.battleRound.myCard;
  const oppCard = view.battleRound.revealed
    ? view.battleRound.opponentCard
    : view.battleRound.opponentSubmitted
      ? faceDownCard()
      : null;

  const [p1Card, p2Card] =
    view.me.playerNum === 1 ? [myCard, oppCard] : [oppCard, myCard];

  return {
    id: view.id,
    player1,
    player2,
    currentTurn: view.currentTurn,
    currentPlayer: view.abilityOrder,
    phase: view.phase,
    abilityOrder: view.abilityOrder,
    abilityPhasePassed: view.abilityPhasePassed,
    battleRound: {
      p1Card,
      p2Card,
      revealed: view.battleRound.revealed,
      resolving: view.battleRound.resolving,
    },
    roundEvents: view.roundEvents,
    // История отыгранных ходов публична и нужна экрану итогов: по ней считается
    // статистика матча (сыгранные карты, урон).
    turnHistory: view.turnHistory,
    status: view.status,
    winner: view.winner,
    pendingActions: { 1: null, 2: null },
    turnPassed: view.turnPassed,
    abilityPhaseCards: view.abilityPhaseCards,
    combatLog: view.combatLog,
    ...(view.lastResolution ? { lastResolution: view.lastResolution } : {}),
    turnDeadline: view.turnDeadline,
    createdAt: view.createdAt,
  };
}

/** playerNum живёт рядом с матчем, а не внутри игрока. */
function stripSeat(me: PlayerView["me"]): MatchPlayer {
  const player = { ...me } as MatchPlayer & { playerNum?: unknown };
  delete player.playerNum;
  return player;
}

function hydrateOpponent(opponent: PlayerView["opponent"]): MatchPlayer {
  return {
    id: opponent.id,
    nickname: opponent.nickname,
    characterId: opponent.characterId,
    currentForm: opponent.currentForm,
    hp: opponent.hp,
    maxHp: opponent.maxHp,
    armor: opponent.armor,
    energy: opponent.energy,
    maxEnergy: opponent.maxEnergy,
    strength: opponent.strength,
    speed: opponent.speed,
    charges: opponent.charges,
    hand: Array.from({ length: opponent.handCount }, (_, i) =>
      faceDownCard(`hand-${i}`),
    ),
    deck: Array.from({ length: opponent.deckCount }, (_, i) =>
      faceDownCard(`deck-${i}`),
    ),
    discardPile: opponent.discardPile,
    activeEffects: opponent.activeEffects,
    isAi: opponent.isAi,
    ...(opponent.relicId ? { relicId: opponent.relicId } : {}),
  };
}

function faceDownCard(suffix = "card"): AbilityCard {
  return {
    id: `hidden-${suffix}`,
    name: "Неизвестно",
    cost: 0,
    speed: 0,
    effect: "",
    rarity: "common",
    description: "",
    type: "active",
  };
}
