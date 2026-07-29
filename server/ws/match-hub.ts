import { BALANCE } from "@/lib/game/balance";
import { eloDelta } from "@/lib/game/rating";
import type { Match, MatchStatus } from "@/lib/game/types";
import { passAbilityPhase, passTurn } from "@/lib/game/engine";
import { findUserByIdSafe, updateMatchRecordSafe, updateUserStats } from "@/lib/models";
import { log, logError, warn } from "@/lib/net/log";
import type {
  FinishReason,
  PlayerNum,
  ServerPayload,
} from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";
import {
  casMatch,
  clearUserMatch,
  readMatch,
  type VersionedMatch,
} from "@/lib/redis/match-store";
import * as metrics from "@/lib/redis/metrics-store";
import * as presence from "@/lib/redis/presence-store";
import { registry } from "@/server/ws/registry";

/** Столько раз повторяем мутацию, если версия матча уехала под руками. */
const CAS_ATTEMPTS = 5;

/** Три пропущенных хода подряд — техническое поражение (ЧАСТЬ 9.5 ТЗ). */
const MAX_TIMEOUT_STRIKES = 3;

/** Пока идёт grace соперника, дедлайн только переспрашивается. */
const GRACE_RECHECK_MS = 5_000;

/** Полный срок хода: тот же, что показывает клиентский таймер. */
const TURN_DEADLINE_MS = BALANCE.TURN_TIMER * 1000;

/** Минимальная пауза перед проверкой дедлайна. */
const DEADLINE_MIN_DELAY_MS = 1_000;

export type Mutator = (match: Match) => Match;

/**
 * Мутации одного матча выстроены в цепочку: два действия, пришедшие в один
 * тик, иначе прочитают одну версию и одно из них потеряется на CAS.
 */
const chains = new Map<string, Promise<unknown>>();
const deadlines = new Map<string, NodeJS.Timeout>();

function serialize<T>(matchId: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(matchId) ?? Promise.resolve();
  const next = previous.then(task, task);

  // В цепочку кладём заглушенную версию: упавшая мутация не должна ронять следующую.
  chains.set(
    matchId,
    next.catch(() => {}),
  );

  return next;
}

/* ------------------------------------------------------------------ *
 * Мутация состояния
 * ------------------------------------------------------------------ */

/**
 * Читает матч, применяет мутатор и пишет через CAS. Возвращает null, если
 * матча нет или все попытки записи проиграли гонку.
 */
export async function apply(
  matchId: string,
  mutate: Mutator,
  /** С чем завершить матч, если мутация его закрыла. По умолчанию — по хп. */
  finishReason: FinishReason = "hp",
): Promise<VersionedMatch | null> {
  return serialize(matchId, async () => {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
      const current = await readMatch(matchId);
      if (!current) return null;

      const next = withFreshDeadline(current.match, mutate(current.match));

      // Мутатор отказался менять состояние — записывать нечего.
      if (next === current.match) return current;

      if (await casMatch(matchId, current.version, next)) {
        const applied = { match: next, version: current.version + 1 };
        await afterWrite(applied, finishReason);
        return applied;
      }

      log({ evt: "match.cas_conflict", matchId, attempt });
      metrics.bump("cas.conflict");
    }

    warn("match-hub", `CAS не сошёлся за ${CAS_ATTEMPTS} попыток: ${matchId}`);
    return null;
  });
}

/** Рассылка проекций и синхронизация серверных таймеров — общий хвост любой записи. */
async function afterWrite(
  applied: VersionedMatch,
  finishReason: FinishReason,
): Promise<void> {
  const { match, version } = applied;

  registry.pushMatchState(match, version);

  if (match.status === "finished") {
    clearDeadline(match.id);
    await finalize(match, match.winner === 1 ? 1 : 2, finishReason);
    return;
  }

  scheduleDeadline(match);
}

/* ------------------------------------------------------------------ *
 * Дедлайн хода
 * ------------------------------------------------------------------ */

/**
 * Кто именно сейчас должен ходить. Пока ключ не поменялся, идёт тот же ход и
 * таймер не трогаем: иначе действие одного игрока продлевало бы срок второму.
 */
function turnKey(match: Match): string {
  return `${match.currentTurn}:${match.phase}:${match.abilityOrder}`;
}

/** Ход сменился — значит новому ходящему полагается полный таймер. */
function withFreshDeadline(before: Match, after: Match): Match {
  if (after === before || after.status !== "in_progress") return after;
  if (turnKey(after) === turnKey(before)) return after;

  return { ...after, turnDeadline: freshDeadline() };
}

function freshDeadline(): string {
  return new Date(Date.now() + TURN_DEADLINE_MS).toISOString();
}

export function scheduleDeadline(match: Match): void {
  clearDeadline(match.id);

  const deadlineMs = Date.parse(match.turnDeadline);
  if (!Number.isFinite(deadlineMs)) return;

  const payload: ServerPayload<"turn_deadline"> = {
    matchId: match.id,
    deadlineMs,
  };
  registry.sendTo(match.player1.id, "turn_deadline", payload);
  registry.sendTo(match.player2.id, "turn_deadline", payload);

  const timer = setTimeout(
    () => void onDeadline(match.id),
    // Нижний порог: просроченный дедлайн не должен крутить таймауты в пустом цикле.
    Math.max(DEADLINE_MIN_DELAY_MS, deadlineMs - Date.now()),
  );
  timer.unref();
  deadlines.set(match.id, timer);
}

export function clearDeadline(matchId: string): void {
  const timer = deadlines.get(matchId);
  if (!timer) return;

  clearTimeout(timer);
  deadlines.delete(matchId);
}

async function onDeadline(matchId: string): Promise<void> {
  deadlines.delete(matchId);

  const current = await readMatch(matchId);
  if (!current || current.match.status !== "in_progress") return;

  // Наказывать за таймаут того, у кого нет связи, нечестно (ЧАСТЬ 9.4 ТЗ).
  if (await anyGraceActive(matchId)) {
    const timer = setTimeout(() => void onDeadline(matchId), GRACE_RECHECK_MS);
    timer.unref();
    deadlines.set(matchId, timer);
    return;
  }

  const late = playersWhoHaventActed(current.match);
  if (!late.length) return;

  // Пишем каждого просрочившего: в фазе боя их бывает двое сразу.
  for (const playerNum of late) log({ evt: "match.timeout", matchId, playerNum });

  const applied = await apply(matchId, (m) => autoPass(m, late));
  if (!applied) return;

  for (const playerNum of late) {
    const strikes = await bumpStrikes(matchId, playerNum);
    if (strikes < MAX_TIMEOUT_STRIKES) continue;

    const winner: PlayerNum = playerNum === 1 ? 2 : 1;
    await finishMatch(matchId, winner, "turn_timeout");
    return;
  }

  // Тот, кто ходил вовремя, теряет накопленные страйки.
  for (const playerNum of [1, 2] as const) {
    if (!late.includes(playerNum)) await resetStrikes(matchId, playerNum);
  }
}

function playersWhoHaventActed(match: Match): PlayerNum[] {
  if (match.phase === "ability") {
    const actor = match.abilityOrder;
    return match.abilityPhasePassed[actor] ? [] : [actor];
  }

  if (match.phase !== "battle") return [];

  return ([1, 2] as const).filter(
    (n) => !match.turnPassed[n] && !getPlayer(match, n).isAi,
  );
}

function autoPass(match: Match, late: PlayerNum[]): Match {
  let updated = match;

  for (const playerNum of late) {
    updated =
      updated.phase === "ability"
        ? passAbilityPhase(updated, playerNum)
        : passTurn(updated, playerNum);
  }

  return updated;
}

function getPlayer(match: Match, playerNum: PlayerNum) {
  return playerNum === 1 ? match.player1 : match.player2;
}

async function bumpStrikes(
  matchId: string,
  playerNum: PlayerNum,
): Promise<number> {
  const key = K.matchStrikes(matchId, playerNum);
  const value = await kv().incr(key);
  await kv().expire(key, TTL.MATCH_SEC);
  return value;
}

/** Ход в срок обнуляет накопленное: три пропуска считаются подряд, а не за матч. */
export async function resetStrikes(
  matchId: string,
  playerNum: PlayerNum,
): Promise<void> {
  await kv().del(K.matchStrikes(matchId, playerNum));
}

/* ------------------------------------------------------------------ *
 * Grace-период
 * ------------------------------------------------------------------ */

/** Таймер в Redis, а не в процессе: перезапуск не должен подвешивать матч. */
export async function startGrace(
  matchId: string,
  playerNum: PlayerNum,
): Promise<void> {
  // Значение — момент начала: по нему считается, сколько ждущий уже потерпел.
  await kv().set(K.matchGrace(matchId, playerNum), String(Date.now()), {
    ex: TTL.GRACE_SEC,
  });
  log({ evt: "match.grace", matchId, playerNum, phase: "start" });

  const timer = setTimeout(
    () => void onGraceExpired(matchId, playerNum),
    TTL.GRACE_SEC * 1000,
  );
  timer.unref();
}

export async function endGrace(
  matchId: string,
  playerNum: PlayerNum,
): Promise<void> {
  await kv().del(K.matchGrace(matchId, playerNum));
}

/**
 * Пока игрок переподключался, срок хода мог истечь. Вернувшемуся отдаём полный
 * таймер, иначе он проигрывает по таймауту в момент входа.
 *
 * Отдельная функция, а не хвост endGrace: finalize зовёт endGrace изнутри
 * цепочки мутаций, и вложенный apply встал бы в ожидание сам себя.
 */
export async function refreshDeadlineAfterGrace(matchId: string): Promise<void> {
  await apply(matchId, (m) =>
    Date.parse(m.turnDeadline) - Date.now() > TURN_DEADLINE_MS / 2
      ? m
      : { ...m, turnDeadline: freshDeadline() },
  );
}

export async function isInGrace(
  matchId: string,
  playerNum: PlayerNum,
): Promise<boolean> {
  return kv().exists(K.matchGrace(matchId, playerNum));
}

/** Сколько миллисекунд идёт grace-период, или null, если он не начинался. */
export async function graceWaitedMs(
  matchId: string,
  playerNum: PlayerNum,
): Promise<number | null> {
  const startedAt = await kv().get(K.matchGrace(matchId, playerNum));
  if (!startedAt) return null;

  return Math.max(0, Date.now() - Number(startedAt));
}

async function anyGraceActive(matchId: string): Promise<boolean> {
  return (
    (await isInGrace(matchId, 1)) || (await isInGrace(matchId, 2))
  );
}

async function onGraceExpired(
  matchId: string,
  playerNum: PlayerNum,
): Promise<void> {
  // Ключ ещё жив — значит игрок вернулся и grace был перезапущен новее.
  if (await isInGrace(matchId, playerNum)) {
    const current = await readMatch(matchId);
    if (!current || current.match.status !== "in_progress") return;

    const player = playerNum === 1 ? current.match.player1 : current.match.player2;
    if (registry.isOnline(player.id)) {
      await endGrace(matchId, playerNum);
      return;
    }
  }

  const current = await readMatch(matchId);
  if (!current || current.match.status !== "in_progress") return;

  await finishMatch(matchId, playerNum === 1 ? 2 : 1, "disconnect_timeout");
}

/* ------------------------------------------------------------------ *
 * Завершение матча
 * ------------------------------------------------------------------ */

export type { FinishReason };

export async function finishMatch(
  matchId: string,
  winner: PlayerNum,
  reason: FinishReason,
): Promise<void> {
  // Расчёт и рассылка идут внутри apply → afterWrite: там уже есть и свежее
  // состояние, и защита от повторного начисления.
  await apply(
    matchId,
    (m) =>
      m.status === "finished"
        ? m
        : ({ ...m, status: "finished" as MatchStatus, winner }),
    reason,
  );
}

/** Идемпотентно: рейтинг за матч начисляется ровно один раз. */
const finalized = new Set<string>();

async function finalize(
  match: Match,
  winner: PlayerNum,
  reason: FinishReason,
): Promise<void> {
  if (finalized.has(match.id)) return;
  finalized.add(match.id);

  clearDeadline(match.id);
  chains.delete(match.id);
  metrics.trackMatch(match.id, false);
  metrics.bump(`match.end.${reason}`);

  log({
    evt: "match.end",
    matchId: match.id,
    reason,
    turns: match.currentTurn,
    durationMs: Date.now() - Date.parse(match.createdAt),
  });

  const results = await Promise.all(
    ([1, 2] as const).map((n) => settlePlayer(match, n, winner)),
  );

  // Привязка снимается ДО рассылки: клиент вправе нажать «Играть снова» в тот
  // же миг, когда увидел результат, и не должен получить ALREADY_IN_MATCH.
  await Promise.all([
    clearUserMatch(match.player1.id),
    clearUserMatch(match.player2.id),
    resetStrikes(match.id, 1),
    resetStrikes(match.id, 2),
    endGrace(match.id, 1),
    endGrace(match.id, 2),
  ]);

  for (const player of [match.player1, match.player2]) {
    if (player.isAi) continue;

    const conn = registry.forUser(player.id);
    if (conn?.scope.kind === "match") conn.scope = { kind: "none" };
    await presence.touch(player.id, "online");
  }

  for (const result of results) {
    if (!result) continue;
    registry.sendTo(result.userId, "game_over", {
      matchId: match.id,
      winner,
      reason,
      ratingDelta: result.delta,
      newRating: result.rating,
    });
  }

  await updateMatchRecordSafe(match.id, {
    status: "finished",
    winnerId: winner === 1 ? match.player1.id : match.player2.id,
    turnsPlayed: match.currentTurn,
    finishedAt: new Date().toISOString(),
  });

  // Ключ реванша живёт своей минутой, а сам матч дотлевает по TTL — обе
  // стороны могут перечитать финальное состояние после переподключения.
  setTimeout(() => finalized.delete(match.id), TTL.REMATCH_SEC * 1000).unref();
}

interface Settlement {
  userId: string;
  delta: number;
  rating: number;
}

async function settlePlayer(
  match: Match,
  playerNum: PlayerNum,
  winner: PlayerNum,
): Promise<Settlement | null> {
  const me = getPlayer(match, playerNum);
  const opponent = getPlayer(match, playerNum === 1 ? 2 : 1);
  if (me.isAi) return null;

  const user = await findUserByIdSafe(me.id);
  const myRating = user?.rating ?? 1000;
  const games = (user?.wins ?? 0) + (user?.losses ?? 0);

  const opponentUser = opponent.isAi ? null : await findUserByIdSafe(opponent.id);
  const oppRating = opponentUser?.rating ?? myRating;

  const won = winner === playerNum;
  const delta = eloDelta(myRating, oppRating, won, games);
  const rating = Math.max(0, myRating + delta);

  try {
    await updateUserStats(me.id, {
      rating,
      wins: (user?.wins ?? 0) + (won ? 1 : 0),
      losses: (user?.losses ?? 0) + (won ? 0 : 1),
    });
  } catch (err) {
    // Без базы матч всё равно должен корректно завершиться для игроков.
    logError("match-hub", err);
  }

  return { userId: me.id, delta, rating };
}

/** Снимает таймеры при остановке процесса, чтобы shutdown не ждал их. */
export function stopAllTimers(): void {
  for (const timer of deadlines.values()) clearTimeout(timer);
  deadlines.clear();
}
