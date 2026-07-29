/**
 * Проверка инварианта из ЧАСТИ 10 ТЗ: ни на одном шаге матча в PlayerView
 * не появляется ничего, чего игрок знать не должен.
 *
 * Прогоняется несколько полных матчей на фиксированных сидах — движок использует
 * Math.random в шаффле и разрешении боя, а плавающий тест хуже отсутствующего.
 *
 * Запуск: npx tsx scripts/check-fog-of-war.ts
 */
import {
  activateAbility,
  createMultiplayerMatch,
  passAbilityPhase,
  passTurn,
  submitCard,
} from "@/lib/game/engine";
import { getCharacterById } from "@/lib/data";
import type { AbilityCard, Match, MatchPlayer } from "@/lib/game/types";
import { toPlayerView } from "@/lib/game/view";
import type { PlayerView } from "@/lib/net/protocol";

const SEEDS = [1, 2, 3, 4, 5];

const failures: string[] = [];
let steps = 0;
/** Сколько раз проверка застала подачу соперника до раскрытия. */
let hiddenSubmissions = 0;

function fail(message: string): void {
  failures.push(message);
}

function seedRandom(seed: number): void {
  let state = seed >>> 0 || 1;
  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function playerOf(match: Match, playerNum: 1 | 2): MatchPlayer {
  return playerNum === 1 ? match.player1 : match.player2;
}

function submittedCard(match: Match, playerNum: 1 | 2): AbilityCard | null {
  return playerNum === 1 ? match.battleRound.p1Card : match.battleRound.p2Card;
}

/**
 * Всё, что игрок имеет право видеть: свои карты, оба сброса, боевой лог,
 * разыгранные карты и события раскрытия (пункт 4 в 10.2 ТЗ).
 *
 * Собирать это приходится, потому что один и тот же экземпляр карты возвращается
 * в игру: сброс перемешивается назад в колоду, а часть эффектов передаёт карты
 * между игроками. Id, который клиент увидел ходы назад в публичном логе, не
 * становится утечкой от того, что карта снова оказалась в руке соперника.
 * Утечкой считается id или имя, попавшее в кадр вне этих источников.
 */
function allowedInFrame(
  match: Match,
  playerNum: 1 | 2,
): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>();
  const names = new Set<string>();

  const remember = (id: string, name: string) => {
    ids.add(id);
    names.add(name);
  };

  const me = playerOf(match, playerNum);
  for (const card of [...me.hand, ...me.deck, ...me.discardPile]) {
    remember(card.id, card.name);
  }
  for (const card of playerOf(match, playerNum === 1 ? 2 : 1).discardPile) {
    remember(card.id, card.name);
  }
  for (const e of match.combatLog) remember(e.cardId, e.cardName);
  for (const p of match.abilityPhaseCards) remember(p.card.id, p.card.name);
  for (const e of match.roundEvents) {
    if (e.kind !== "submit") remember(e.cardId, e.cardName);
  }
  for (const e of match.lastResolution?.combatEvents ?? []) {
    remember(e.cardId, e.cardName);
  }
  for (const e of match.lastResolution?.roundEvents ?? []) {
    remember(e.cardId, e.cardName);
  }

  // Эффект block_hand хранит id заблокированной карты в source, а движок тут же
  // объявляет её по имени в боевом логе (effects.ts:517) — раскрытие задумано,
  // и activeEffects соперника публичны по пункту 5 в 10.2 ТЗ.
  for (const e of playerOf(match, playerNum === 1 ? 2 : 1).activeEffects) {
    if (e.source.startsWith("blocked-")) ids.add(e.source.slice("blocked-".length));
  }

  return { ids, names };
}

/**
 * Часть кадра, куда скрытое могло бы просочиться. Боевой лог, сброс и своя
 * половина — публичны по построению, и имена карт в них встречаются законно:
 * события вида «заблокирована «X»» описывают уже случившееся.
 */
function fogSensitive(view: PlayerView): string {
  const { discardPile: _discardPile, ...opponent } = view.opponent;
  return JSON.stringify({
    opponent,
    battleRound: view.battleRound,
    roundEvents: view.roundEvents,
  });
}

function checkView(match: Match, playerNum: 1 | 2, label: string): void {
  const oppNum: 1 | 2 = playerNum === 1 ? 2 : 1;
  const opp = playerOf(match, oppNum);
  const view = toPlayerView(match, playerNum);
  const json = JSON.stringify(view);
  const fog = fogSensitive(view);
  const allowed = allowedInFrame(match, playerNum);

  for (const card of [...opp.hand, ...opp.deck]) {
    if (!allowed.ids.has(card.id) && json.includes(card.id)) {
      fail(
        `${label}: id карты соперника «${card.name}» (${card.id}) в кадре игрока ${playerNum}`,
      );
    }
    if (!allowed.names.has(card.name) && fog.includes(card.name)) {
      fail(`${label}: имя карты соперника «${card.name}» в кадре игрока ${playerNum}`);
    }
  }

  if (view.opponent.handCount !== opp.hand.length) {
    fail(`${label}: handCount ${view.opponent.handCount} вместо ${opp.hand.length}`);
  }
  if (view.opponent.deckCount !== opp.deck.length) {
    fail(`${label}: deckCount ${view.opponent.deckCount} вместо ${opp.deck.length}`);
  }
  if ("hand" in view.opponent || "deck" in view.opponent) {
    fail(`${label}: в opponent остались поля hand/deck`);
  }

  const oppCard = submittedCard(match, oppNum);
  if (oppCard && !match.battleRound.revealed) {
    hiddenSubmissions++;

    if (view.battleRound.opponentCard !== null) {
      fail(`${label}: opponentCard не null до раскрытия`);
    }
    if (!view.battleRound.opponentSubmitted) {
      fail(`${label}: opponentSubmitted false, хотя соперник подал карту`);
    }
    if (view.roundEvents.some((e) => e.kind === "submit" && e.playerNum === oppNum)) {
      fail(`${label}: submit-событие соперника не вырезано`);
    }
    if (!allowed.ids.has(oppCard.id) && json.includes(oppCard.id)) {
      fail(`${label}: id нераскрытой карты «${oppCard.name}» в кадре игрока ${playerNum}`);
    }
    if (!allowed.names.has(oppCard.name) && fog.includes(oppCard.name)) {
      fail(`${label}: имя нераскрытой карты «${oppCard.name}» в кадре игрока ${playerNum}`);
    }
  }

  // Обратная проверка: своё состояние не должно быть вырезано заодно.
  const me = playerOf(match, playerNum);
  if (view.me.hand.length !== me.hand.length) {
    fail(`${label}: своя рука урезана (${view.me.hand.length} из ${me.hand.length})`);
  }
  const myCard = submittedCard(match, playerNum);
  if (myCard && view.battleRound.myCard?.id !== myCard.id) {
    fail(`${label}: своя поданная карта не видна`);
  }
}

function checkBoth(match: Match, label: string): void {
  steps++;
  checkView(match, 1, label);
  checkView(match, 2, label);
}

function pickAbility(match: Match, playerNum: 1 | 2): string | null {
  const player = playerOf(match, playerNum);
  const ability = getCharacterById(player.characterId)?.uniqueAbilities.find(
    (a) => a.chargeCost <= player.charges,
  );
  return ability?.id ?? null;
}

/** Полный матч от создания до finished: обе фазы, много раундов, смена форм. */
function playMatch(seed: number): void {
  seedRandom(seed);

  let current = createMultiplayerMatch(
    "u1",
    "A",
    "donald-rumpf",
    "u2",
    "B",
    "vladimir-pu",
  );
  const secretIds = new Set(
    [...current.player2.hand, ...current.player2.deck].map((c) => c.id),
  );

  const firstView = JSON.stringify(toPlayerView(current, 1));
  for (const id of secretIds) {
    if (firstView.includes(id)) {
      fail(`сид ${seed}, создание матча: id ${id} в кадре игрока 1`);
    }
  }
  checkBoth(current, `сид ${seed}, создание матча`);

  let guard = 0;
  while (current.status !== "finished" && guard < 600) {
    guard++;

    if (current.phase === "ability") {
      const num = current.abilityOrder;
      const abilityId = guard % 3 === 0 ? pickAbility(current, num) : null;
      current = abilityId
        ? activateAbility(current, num, abilityId)
        : passAbilityPhase(current, num);
      checkBoth(current, `сид ${seed}, ход ${current.currentTurn}, способности`);
      continue;
    }

    if (current.phase === "battle") {
      // Соперник игрока 1 подаёт первым — именно этот момент и утекал раньше.
      for (const num of [2, 1] as const) {
        if (current.phase !== "battle" || current.status === "finished") break;
        if (current.turnPassed[num] || submittedCard(current, num)) continue;

        const card = playerOf(current, num).hand[0];
        current = card
          ? submitCard(current, num, card.id)
          : passTurn(current, num);
        checkBoth(
          current,
          `сид ${seed}, ход ${current.currentTurn}, подача игрока ${num}`,
        );
      }

      for (const num of [1, 2] as const) {
        if (current.phase !== "battle" || current.status === "finished") break;
        if (current.turnPassed[num]) continue;
        current = passTurn(current, num);
        checkBoth(
          current,
          `сид ${seed}, ход ${current.currentTurn}, пас игрока ${num}`,
        );
      }
      continue;
    }

    break;
  }

  if (current.status !== "finished") {
    fail(`сид ${seed}: матч не дошёл до конца за ${guard} шагов (фаза ${current.phase})`);
  }
}

function main(): void {
  for (const seed of SEEDS) playMatch(seed);

  if (hiddenSubmissions === 0) {
    fail("ни одной нераскрытой подачи не проверено — тест бесполезен");
  }

  if (failures.length) {
    console.error("FOG OF WAR: FAIL");
    for (const f of failures.slice(0, 20)) console.error(`  - ${f}`);
    console.error(`  всего нарушений: ${failures.length}`);
    process.exit(1);
  }

  console.log(`Матчей: ${SEEDS.length}, состояний проверено: ${steps}`);
  console.log(`Нераскрытых подач соперника проверено: ${hiddenSubmissions}`);
  console.log("FOG OF WAR: OK");
}

main();
