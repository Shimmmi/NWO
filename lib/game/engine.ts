import { randomUUID } from "crypto";
import type {
  AbilityCard,
  Match,
  MatchPlayer,
  PlayedCard,
  RoundEvent,
  TurnRecord,
  TurnResolution,
} from "@/lib/game/types";
import {
  FORM_STATS,
  emptyBattleRound,
} from "@/lib/game/types";
import { getCharacterById, getDefaultDeck } from "@/lib/data";
import { cloneCard, hasEffect, inferCardCategory } from "@/lib/game/cards";
import {
  applyAbilityEffects,
  applyCardEffects,
  applyPassiveBlock,
  applyPassiveSpeedBoost,
  discardRemainingHand,
  drawToMaxHand,
  drawCardsForPlayer,
  getEffectiveCardCost,
  getSanctionPenalty,
  getTotalSpeed,
  hasSanction,
  hasSkipAbility,
  recycleFromDiscardForPassive,
  removeCardsFromHand,
  takeCardFromHand,
  tickEffects,
} from "@/lib/game/effects";
import { makeAiAbilityDecision, makeAiBattleDecision } from "@/lib/game/ai";
import { BALANCE } from "@/lib/game/balance";
import { applyRelic, ALL_RELICS } from "@/lib/game/relics";

const TURN_DEADLINE_MS = BALANCE.TURN_TIMER * 1000;
const INITIAL_HAND = 5;
const ABSOLUTE_MAX_ENERGY = BALANCE.ABSOLUTE_MAX_ENERGY;
const MAX_COMBAT_LOG = 50;

const battleSnapshots = new Map<string, Match>();

/** Снапшот battle-фазы для эффекта cancel_last — чтобы внешний код мог его персистить. */
export function exportBattleSnapshot(matchId: string): Match | undefined {
  return battleSnapshots.get(matchId);
}

export function importBattleSnapshot(matchId: string, match: Match): void {
  battleSnapshots.set(matchId, match);
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getPlayer(match: Match, num: 1 | 2): MatchPlayer {
  return num === 1 ? match.player1 : match.player2;
}

function setPlayer(match: Match, num: 1 | 2, player: MatchPlayer): Match {
  return num === 1 ? { ...match, player1: player } : { ...match, player2: player };
}

function createEmptyMatchFields(): Pick<
  Match,
  | "combatLog"
  | "abilityPhaseCards"
  | "pendingActions"
  | "turnPassed"
  | "abilityOrder"
  | "abilityPhasePassed"
  | "battleRound"
  | "roundEvents"
> {
  return {
    pendingActions: { 1: null, 2: null },
    turnPassed: { 1: false, 2: false },
    abilityPhaseCards: [],
    combatLog: [],
    abilityOrder: 1,
    abilityPhasePassed: { 1: false, 2: false },
    battleRound: emptyBattleRound(),
    roundEvents: [],
  };
}

function instanceDeck(characterId: string): AbilityCard[] {
  return shuffle(
    getDefaultDeck(characterId).map((c) => ({
      ...c,
      id: `${c.id}#${randomUUID().slice(0, 8)}`,
    })),
  );
}

export function createPlayer(
  id: string,
  nickname: string,
  characterId: string,
  isAi = false,
  relicId?: string,
): MatchPlayer {
  const formStats = FORM_STATS[characterId][0];
  const deck = instanceDeck(characterId);
  const resolvedRelic =
    relicId ??
    (isAi
      ? ALL_RELICS[Math.floor(Math.random() * ALL_RELICS.length)]?.id
      : undefined);

  let player: MatchPlayer = {
    id,
    nickname,
    characterId,
    currentForm: 1,
    hp: formStats.maxHp,
    maxHp: formStats.maxHp,
    armor: formStats.armor,
    energy: formStats.maxEnergy,
    maxEnergy: formStats.maxEnergy,
    strength: formStats.strength,
    speed: formStats.speed,
    charges: formStats.charges,
    hand: [],
    deck,
    discardPile: [],
    activeEffects: [],
    isAi,
    relicId: resolvedRelic,
  };

  player = drawCardsForPlayer(player, INITIAL_HAND);
  player = applyRelic(player, player.relicId, { type: "match_start" });
  return player;
}

function applyEnergyRecovery(match: Match): Match {
  let updated = { ...match };

  for (const num of [1, 2] as const) {
    let player = getPlayer(updated, num);
    const prevHp = player.hp;

    if (!hasSanction(player)) {
      const newMax = Math.min(ABSOLUTE_MAX_ENERGY, player.maxEnergy + 1);
      player = {
        ...player,
        maxEnergy: newMax,
        energy: newMax,
      };
    }

    player = applyRelic(player, player.relicId, { type: "turn_start" });

    if (updated.currentTurn % 2 === 0) {
      player = applyPassiveAbility(player, updated.currentTurn);
    }

    if (player.hp !== prevHp) {
      player = applyRelic(player, player.relicId, {
        type: "hp_changed",
        prevHp,
      });
    }

    updated = setPlayer(updated, num, player);
  }

  return updated;
}

function applyPassiveAbility(player: MatchPlayer, turn: number): MatchPlayer {
  if (turn % 2 !== 0) return player;

  switch (player.characterId) {
    case "donald-rumpf":
      return {
        ...player,
        energy: Math.min(player.energy + BALANCE.ENERGY_REGEN, player.maxEnergy),
      };
    case "vladimir-pu":
      return applyPassiveBlock(player);
    case "jin-shi":
      return recycleFromDiscardForPassive(player, 1);
    case "vlado-zelenko":
      return applyPassiveSpeedBoost(player);
    default:
      return player;
  }
}

function applyFormTransformation(player: MatchPlayer): MatchPlayer {
  const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  const shouldTransform =
    player.currentForm < 3 &&
    (player.hp <= 0 || hpRatio <= BALANCE.TRANSFORM_THRESHOLD);

  if (shouldTransform) {
    const nextForm = FORM_STATS[player.characterId][player.currentForm];
    return {
      ...player,
      currentForm: (player.currentForm + 1) as 2 | 3,
      hp: Math.floor(nextForm.maxHp * 0.55),
      maxHp: nextForm.maxHp,
      armor: nextForm.armor,
      maxEnergy: nextForm.maxEnergy,
      strength: nextForm.strength,
      speed: nextForm.speed,
      charges: nextForm.charges,
    };
  }
  return player;
}

function checkWinner(match: Match): Match {
  const p1Dead = match.player1.hp <= 0 && match.player1.currentForm >= 3;
  const p2Dead = match.player2.hp <= 0 && match.player2.currentForm >= 3;

  if (p1Dead && p2Dead) {
    return { ...match, status: "finished", winner: null };
  }
  if (p1Dead) {
    return { ...match, status: "finished", winner: 2 };
  }
  if (p2Dead) {
    return { ...match, status: "finished", winner: 1 };
  }
  return match;
}

function cloneMatchState(match: Match): Match {
  return structuredClone(match);
}

function resolveBattle(match: Match): Match {
  let updated = { ...match };

  for (const num of [1, 2] as const) {
    let player = getPlayer(updated, num);
    player = applyFormTransformation(player);
    updated = setPlayer(updated, num, player);
  }

  return updated;
}

function resetTurn(match: Match): Match {
  const nextAbilityOrder: 1 | 2 =
    match.currentTurn % 2 === 0 ? 2 : 1;
  return {
    ...match,
    pendingActions: { 1: null, 2: null },
    turnPassed: { 1: false, 2: false },
    abilityPhaseCards: [],
    abilityPhasePassed: { 1: false, 2: false },
    abilityOrder: nextAbilityOrder,
    battleRound: emptyBattleRound(),
    roundEvents: [],
    phase: "energy_recovery",
    turnDeadline: new Date(Date.now() + TURN_DEADLINE_MS).toISOString(),
  };
}

function enterAbilityPhase(match: Match): Match {
  let updated: Match = {
    ...match,
    phase: "ability",
    abilityPhasePassed: { 1: false, 2: false },
    abilityOrder: match.abilityOrder ?? (match.currentTurn % 2 === 1 ? 1 : 2),
  };

  for (const num of [1, 2] as const) {
    const player = getPlayer(updated, num);
    if (shouldAutoPassAbility(player)) {
      updated = {
        ...updated,
        abilityPhasePassed: {
          ...updated.abilityPhasePassed,
          [num]: true,
        },
      };
    }
  }

  if (updated.abilityPhasePassed[1] && updated.abilityPhasePassed[2]) {
    return enterBattlePhase(updated);
  }

  updated = autoPassAbilityIfNoCharges(updated);
  return updated;
}

function enterBattlePhase(match: Match): Match {
  const updated: Match = {
    ...match,
    phase: "battle",
    turnPassed: { 1: false, 2: false },
    battleRound: emptyBattleRound(),
  };
  battleSnapshots.set(updated.id, cloneMatchState(updated));
  return updated;
}

function startTurnPhases(match: Match): Match {
  let updated: Match = { ...match, phase: "energy_recovery" };
  updated = applyEnergyRecovery(updated);
  updated = { ...updated, phase: "card_draw" };

  for (const num of [1, 2] as const) {
    const player = drawToMaxHand(getPlayer(updated, num));
    updated = setPlayer(updated, num, player);
  }

  updated = enterAbilityPhase(updated);
  return maybeRunAiAbilityPhase(updated);
}

function getLastOpponentCard(
  match: Match,
  playerNum: 1 | 2,
): PlayedCard["card"] | undefined {
  for (let i = match.abilityPhaseCards.length - 1; i >= 0; i--) {
    if (match.abilityPhaseCards[i].playerNum !== playerNum) {
      return match.abilityPhaseCards[i].card;
    }
  }
  return undefined;
}

function replayBattlePlays(base: Match, plays: PlayedCard[]): Match {
  let m: Match = {
    ...cloneMatchState(base),
    abilityPhaseCards: [],
  };

  for (const played of plays) {
    const player = getPlayer(m, played.playerNum);
    if (!player.hand.some((c) => c.id === played.card.id)) continue;

    m = setPlayer(
      m,
      played.playerNum,
      removeCardsFromHand(player, [played.card.id]),
    );

    const lastOpponentCard = getLastOpponentCard(m, played.playerNum);
    const result = applyCardEffects(m, played, { lastOpponentCard });
    if (result.success) {
      m = {
        ...result.match,
        abilityPhaseCards: [...m.abilityPhaseCards, played],
      };
    }
  }

  return m;
}

function canAffordCard(player: MatchPlayer, card: AbilityCard): boolean {
  const cost = getEffectiveCardCost(player, card) + getSanctionPenalty(player);
  return player.energy >= cost;
}

function switchAbilityTurn(match: Match): Match {
  const other: 1 | 2 = match.abilityOrder === 1 ? 2 : 1;
  if (match.abilityPhasePassed[other]) {
    return resolveAbilityPhase(match);
  }
  let updated = { ...match, abilityOrder: other };
  updated = autoPassAbilityIfNoCharges(updated);
  return updated;
}

function advanceAbilityPhaseIfDone(match: Match): Match {
  if (match.abilityPhasePassed[1] && match.abilityPhasePassed[2]) {
    return enterBattlePhase(match);
  }
  return match;
}

function shouldAutoPassAbility(player: MatchPlayer): boolean {
  return player.charges === 0 || hasSkipAbility(player);
}

function autoPassAbilityIfNoCharges(match: Match): Match {
  if (match.phase !== "ability") return match;

  let updated = match;
  let guard = 0;

  while (updated.phase === "ability" && guard < 8) {
    guard++;
    const active = updated.abilityOrder;
    const player = getPlayer(updated, active);

    if (updated.abilityPhasePassed[active]) {
      const other: 1 | 2 = active === 1 ? 2 : 1;
      if (updated.abilityPhasePassed[other]) {
        return resolveAbilityPhase(updated);
      }
      updated = { ...updated, abilityOrder: other };
      continue;
    }

    if (!shouldAutoPassAbility(player)) {
      return updated;
    }

    updated = {
      ...updated,
      abilityPhasePassed: {
        ...updated.abilityPhasePassed,
        [active]: true,
      },
    };

    updated = advanceAbilityPhaseIfDone(updated);
    if (updated.phase === "battle") {
      return updated;
    }

    const other: 1 | 2 = active === 1 ? 2 : 1;
    if (updated.abilityPhasePassed[other]) {
      return resolveAbilityPhase(updated);
    }
    updated = { ...updated, abilityOrder: other };
  }

  return updated;
}

function resolveAbilityPhase(match: Match): Match {
  let updated = advanceAbilityPhaseIfDone(match);
  if (updated.phase === "battle") {
    updated = maybeRunAiBattleTurn(updated);
  }
  return updated;
}

export function activateAbility(
  match: Match,
  playerNum: 1 | 2,
  abilityId: string,
): Match {
  if (match.status === "finished") return match;
  if (match.phase !== "ability") return match;
  if (match.abilityPhasePassed[playerNum]) return match;
  if (playerNum !== match.abilityOrder) return match;

  const player = getPlayer(match, playerNum);
  if (hasSkipAbility(player)) return match;

  const character = getCharacterById(player.characterId);
  const ability = character?.uniqueAbilities.find((a) => a.id === abilityId);
  if (!ability) return match;
  if (player.charges < ability.chargeCost) return match;

  let updated = setPlayer(match, playerNum, {
    ...player,
    charges: player.charges - ability.chargeCost,
  });

  const result = applyAbilityEffects(updated, playerNum, ability);
  updated = result.match;
  updated = checkWinner(updated);
  if (updated.status === "finished") return updated;

  const actor = getPlayer(updated, playerNum);
  if (actor.charges === 0) {
    updated = {
      ...updated,
      abilityPhasePassed: {
        ...updated.abilityPhasePassed,
        [playerNum]: true,
      },
    };
    updated = advanceAbilityPhaseIfDone(updated);
    if (updated.phase === "battle") {
      return maybeRunAiBattleTurn(updated);
    }
    updated = switchAbilityTurn(updated);
  } else {
    updated = switchAbilityTurn(updated);
  }

  return maybeRunAiAbilityPhase(updated);
}

export function passAbilityPhase(
  match: Match,
  playerNum: 1 | 2,
): Match {
  if (match.status === "finished") return match;
  if (match.phase !== "ability") return match;
  if (match.abilityPhasePassed[playerNum]) return match;
  if (playerNum !== match.abilityOrder) return match;

  let updated: Match = {
    ...match,
    abilityPhasePassed: {
      ...match.abilityPhasePassed,
      [playerNum]: true,
    },
  };

  updated = advanceAbilityPhaseIfDone(updated);
  if (updated.phase === "battle") {
    return maybeRunAiBattleTurn(updated);
  }

  updated = switchAbilityTurn(updated);
  return maybeRunAiAbilityPhase(updated);
}

function addRoundEvent(
  match: Match,
  event: RoundEvent,
): Match {
  return {
    ...match,
    roundEvents: [...match.roundEvents, event],
  };
}

function bothCardsSubmitted(match: Match): boolean {
  const { battleRound, turnPassed } = match;
  const p1Submitted = battleRound.p1Card !== null;
  const p2Submitted = battleRound.p2Card !== null;

  if (p1Submitted && p2Submitted) return true;
  if (p1Submitted && turnPassed[2]) return true;
  if (p2Submitted && turnPassed[1]) return true;

  return false;
}

function resolveBattleRound(match: Match): Match {
  const { battleRound } = match;
  let updated: Match = {
    ...match,
    battleRound: { ...battleRound, revealed: true, resolving: true },
  };

  const plays: Array<{ playerNum: 1 | 2; card: AbilityCard }> = [];
  if (battleRound.p1Card) {
    plays.push({ playerNum: 1, card: battleRound.p1Card });
  }
  if (battleRound.p2Card) {
    plays.push({ playerNum: 2, card: battleRound.p2Card });
  }

  for (const play of plays) {
    updated = addRoundEvent(updated, {
      kind: "reveal",
      playerNum: play.playerNum,
      cardId: play.card.id,
      cardName: play.card.name,
      category: inferCardCategory(play.card),
      totalSpeed: getTotalSpeed(getPlayer(updated, play.playerNum), play.card),
    });
  }

  plays.sort((a, b) => {
    const speedA = getTotalSpeed(getPlayer(updated, a.playerNum), a.card);
    const speedB = getTotalSpeed(getPlayer(updated, b.playerNum), b.card);
    return speedB - speedA;
  });

  let order = 1 as 1 | 2;
  for (const play of plays) {
    const player = getPlayer(updated, play.playerNum);
    if (!canAffordCard(player, play.card)) {
      const discardPlayer = {
        ...player,
        discardPile: [...player.discardPile, play.card],
      };
      updated = setPlayer(updated, play.playerNum, discardPlayer);
      updated = addRoundEvent(updated, {
        kind: "resolve",
        playerNum: play.playerNum,
        cardId: play.card.id,
        cardName: play.card.name,
        category: inferCardCategory(play.card),
        totalSpeed: getTotalSpeed(player, play.card),
        order,
      });
      order = order === 1 ? 2 : 1;
      continue;
    }

    const played: PlayedCard = {
      playerId: player.id,
      playerNum: play.playerNum,
      card: cloneCard(play.card),
    };

    const lastOpponentCard = getLastOpponentCard(updated, play.playerNum);
    let result = applyCardEffects(updated, played, { lastOpponentCard });

    if (result.success && hasEffect(played.card.effect, "cancel_last")) {
      const oppNum = play.playerNum === 1 ? 2 : 1;
      for (let i = updated.abilityPhaseCards.length - 1; i >= 0; i--) {
        if (updated.abilityPhaseCards[i].playerNum === oppNum) {
          const cancelledName = updated.abilityPhaseCards[i].card.name;
          const remaining = updated.abilityPhaseCards.filter((_, idx) => idx !== i);
          const base = battleSnapshots.get(updated.id);
          if (base) {
            updated = replayBattlePlays(base, remaining);
          }
          result = applyCardEffects(updated, played, {
            lastOpponentCard: getLastOpponentCard(updated, play.playerNum),
          });
          if (result.success) {
            result.events.push(`${played.card.name}: отменена «${cancelledName}»`);
          }
          break;
        }
      }
    }

    if (result.success) {
      updated = {
        ...result.match,
        abilityPhaseCards: [...result.match.abilityPhaseCards, played],
        combatLog: [...result.match.combatLog, result.combatEvent].slice(
          -MAX_COMBAT_LOG,
        ),
      };
      updated = setPlayer(updated, play.playerNum, {
        ...getPlayer(updated, play.playerNum),
        discardPile: [
          ...getPlayer(updated, play.playerNum).discardPile,
          play.card,
        ],
      });
    } else {
      const p = getPlayer(updated, play.playerNum);
      updated = setPlayer(updated, play.playerNum, {
        ...p,
        discardPile: [...p.discardPile, play.card],
      });
    }

    updated = addRoundEvent(updated, {
      kind: "resolve",
      playerNum: play.playerNum,
      cardId: play.card.id,
      cardName: play.card.name,
      category: inferCardCategory(play.card),
      totalSpeed: getTotalSpeed(getPlayer(updated, play.playerNum), play.card),
      order,
    });
    order = order === 1 ? 2 : 1;
  }

  updated = {
    ...updated,
    battleRound: emptyBattleRound(),
  };

  updated = checkWinner(updated);
  return updated;
}

export function submitCard(
  match: Match,
  playerNum: 1 | 2,
  cardId: string,
): Match {
  if (match.status === "finished") return match;
  if (match.phase !== "battle") return match;
  if (match.turnPassed[playerNum]) return match;

  const { battleRound } = match;
  const existing =
    playerNum === 1 ? battleRound.p1Card : battleRound.p2Card;
  if (existing) return match;

  const player = getPlayer(match, playerNum);
  const taken = takeCardFromHand(player, cardId);
  if (!taken.card) return match;

  const newRound = {
    ...battleRound,
    [playerNum === 1 ? "p1Card" : "p2Card"]: cloneCard(taken.card),
  };

  let updated: Match = {
    ...match,
    battleRound: newRound,
    roundEvents: [
      ...match.roundEvents,
      {
        kind: "submit" as const,
        playerNum,
        cardId: taken.card.id,
        cardName: taken.card.name,
        category: inferCardCategory(taken.card),
        totalSpeed: getTotalSpeed(taken.player, taken.card),
      },
    ],
  };
  updated = setPlayer(updated, playerNum, taken.player);

  if (bothCardsSubmitted(updated)) {
    updated = resolveBattleRound(updated);
    if (updated.status === "finished") return updated;
  }

  return maybeRunAiBattleTurn(updated);
}

/** @deprecated Use submitCard */
export function playCard(
  match: Match,
  playerNum: 1 | 2,
  cardId: string,
): Match {
  return submitCard(match, playerNum, cardId);
}

function getAiPlayerNum(match: Match): 1 | 2 | null {
  if (match.player1.isAi) return 1;
  if (match.player2.isAi) return 2;
  return null;
}

function maybeRunAiAbilityPhase(match: Match): Match {
  const aiNum = getAiPlayerNum(match);
  if (!aiNum || match.phase !== "ability") return match;

  let updated = match;
  let guard = 0;

  while (
    updated.phase === "ability" &&
    updated.status !== "finished" &&
    guard < 10
  ) {
    guard++;
    if (updated.abilityPhasePassed[aiNum]) break;
    if (updated.abilityOrder !== aiNum) break;

    const decision = makeAiAbilityDecision(updated, aiNum);
    if (decision === "pass") {
      updated = passAbilityPhase(updated, aiNum);
    } else {
      updated = activateAbility(updated, aiNum, decision);
    }
  }

  return updated;
}

function maybeRunAiBattleTurn(match: Match): Match {
  const aiNum = getAiPlayerNum(match);
  if (!aiNum || match.phase !== "battle" || match.status === "finished") {
    return match;
  }

  let updated = match;
  let guard = 0;

  while (
    updated.phase === "battle" &&
    updated.status !== "finished" &&
    !updated.turnPassed[aiNum] &&
    guard < 20
  ) {
    guard++;
    const aiCard = updated.battleRound[aiNum === 1 ? "p1Card" : "p2Card"];
    if (aiCard) break;

    const decision = makeAiBattleDecision(updated, aiNum);
    if (decision === "pass") {
      updated = passTurn(updated, aiNum);
      break;
    }

    updated = submitCard(updated, aiNum, decision);
    if (updated.status === "finished") break;
  }

  return updated;
}

export function finishTurn(match: Match): Match {
  if (match.status === "finished") return match;

  const hpBefore1 = match.player1.hp;
  const hpBefore2 = match.player2.hp;
  const discardBefore1 = match.player1.discardPile.length;
  const discardBefore2 = match.player2.discardPile.length;

  const turnEvents: string[] = [
    ...match.abilityPhaseCards.map(
      (p) =>
        `${p.card.name} (${p.playerNum === 1 ? match.player1.nickname : match.player2.nickname})`,
    ),
    ...(match.battleRound.p1Card
      ? [`${match.battleRound.p1Card.name} (${match.player1.nickname})`]
      : []),
    ...(match.battleRound.p2Card
      ? [`${match.battleRound.p2Card.name} (${match.player2.nickname})`]
      : []),
  ];
  const combatEvents = match.combatLog.filter(
    (e) => e.turn === match.currentTurn,
  );

  let updated = resolveBattle(match);
  updated = { ...updated, phase: "end_turn" };

  for (const num of [1, 2] as const) {
    const player = discardRemainingHand(getPlayer(updated, num));
    updated = setPlayer(updated, num, player);
  }

  const damageTo1 = hpBefore1 - updated.player1.hp;
  const damageTo2 = hpBefore2 - updated.player2.hp;

  for (const num of [1, 2] as const) {
    const player = tickEffects(getPlayer(updated, num));
    updated = setPlayer(updated, num, player);
  }

  updated = checkWinner(updated);

  // В историю входят и карты фазы способностей, и карта боя — иначе экран
  // итогов показывает «0 карт сыграно» после полноценного раунда.
  const battleCard = (card: typeof match.battleRound.p1Card): string[] =>
    card ? [card.id] : [];
  const player1Cards = [
    ...match.abilityPhaseCards
      .filter((p) => p.playerNum === 1)
      .map((p) => p.card.id),
    ...battleCard(match.battleRound.p1Card),
  ];
  const player2Cards = [
    ...match.abilityPhaseCards
      .filter((p) => p.playerNum === 2)
      .map((p) => p.card.id),
    ...battleCard(match.battleRound.p2Card),
  ];

  const lastResolution: TurnResolution = {
    turn: updated.currentTurn,
    combatEvents,
    roundEvents: match.roundEvents,
    player1EnergyAfter: updated.player1.energy,
    player2EnergyAfter: updated.player2.energy,
    player1DiscardAdded: updated.player1.discardPile.length - discardBefore1,
    player2DiscardAdded: updated.player2.discardPile.length - discardBefore2,
    damageDealt: { to1: Math.max(0, damageTo1), to2: Math.max(0, damageTo2) },
  };

  const record: TurnRecord = {
    turn: updated.currentTurn,
    player1Cards,
    player2Cards,
    damageDealt: { to1: Math.max(0, damageTo1), to2: Math.max(0, damageTo2) },
    events: turnEvents,
    combatEvents,
  };

  updated = {
    ...updated,
    lastResolution,
    turnHistory: [...updated.turnHistory, record],
  };

  if (updated.status !== "finished") {
    updated = resetTurn(updated);
    updated = { ...updated, currentTurn: updated.currentTurn + 1 };
    updated = startTurnPhases(updated);
  } else {
    battleSnapshots.delete(updated.id);
  }

  return updated;
}

export function passTurn(match: Match, playerNum: 1 | 2): Match {
  if (match.status === "finished") return match;
  if (match.phase !== "battle") return match;
  if (match.turnPassed[playerNum]) return match;

  let updated: Match = {
    ...match,
    turnPassed: { ...match.turnPassed, [playerNum]: true },
  };

  const { battleRound } = updated;
  const hasPending =
    (playerNum === 1 && battleRound.p1Card) ||
    (playerNum === 2 && battleRound.p2Card);

  if (hasPending || bothCardsSubmitted(updated)) {
    updated = resolveBattleRound(updated);
    if (updated.status === "finished") return updated;
  }

  if (updated.turnPassed[1] && updated.turnPassed[2]) {
    return finishTurn(updated);
  }

  updated = maybeRunAiBattleTurn(updated);

  if (updated.turnPassed[1] && updated.turnPassed[2]) {
    return finishTurn(updated);
  }

  return updated;
}

/** @deprecated Use submitCard + passTurn */
export function submitPlayerActions(
  match: Match,
  playerNum: 1 | 2,
  cardIds: string[],
): Match {
  if (match.status === "finished") return match;
  if (match.phase !== "battle") return match;

  let updated = match;
  for (const cardId of cardIds) {
    updated = submitCard(updated, playerNum, cardId);
  }
  return passTurn(updated, playerNum);
}

export function createMatch(
  playerId: string,
  playerNickname: string,
  characterId: string,
  vsAi: boolean,
  aiCharacterId?: string,
  relicId?: string,
): Match {
  const resolvedAiCharacter = aiCharacterId ?? "vladimir-pu";
  const player1 = createPlayer(
    playerId,
    playerNickname,
    characterId,
    false,
    relicId,
  );
  const player2 = createPlayer(
    vsAi ? "ai-opponent" : randomUUID(),
    vsAi ? "ИИ-противник" : "Ожидание...",
    resolvedAiCharacter,
    vsAi,
  );

  let match: Match = {
    id: randomUUID(),
    player1,
    player2,
    currentTurn: 1,
    currentPlayer: 1,
    phase: "energy_recovery",
    turnHistory: [],
    status: vsAi ? "in_progress" : "waiting",
    winner: null,
    turnDeadline: new Date(Date.now() + TURN_DEADLINE_MS).toISOString(),
    createdAt: new Date().toISOString(),
    ...createEmptyMatchFields(),
  };

  match = startTurnPhases(match);
  return { ...match, status: "in_progress" };
}

export function createMultiplayerMatch(
  player1Id: string,
  player1Nickname: string,
  player1CharacterId: string,
  player2Id: string,
  player2Nickname: string,
  player2CharacterId: string,
): Match {
  const player1 = createPlayer(
    player1Id,
    player1Nickname,
    player1CharacterId,
    false,
  );
  const player2 = createPlayer(
    player2Id,
    player2Nickname,
    player2CharacterId,
    false,
  );

  const match: Match = {
    id: randomUUID(),
    player1,
    player2,
    currentTurn: 1,
    currentPlayer: 1,
    phase: "energy_recovery",
    turnHistory: [],
    status: "in_progress",
    winner: null,
    turnDeadline: new Date(Date.now() + TURN_DEADLINE_MS).toISOString(),
    createdAt: new Date().toISOString(),
    ...createEmptyMatchFields(),
  };

  return startTurnPhases(match);
}
