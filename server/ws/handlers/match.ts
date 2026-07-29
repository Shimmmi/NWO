import {
  activateAbility,
  passAbilityPhase,
  passTurn,
  submitCard,
} from "@/lib/game/engine";
import type { Match } from "@/lib/game/types";
import { ProtocolError } from "@/lib/net/errors";
import { log } from "@/lib/net/log";
import type { ClientPayload, PlayerNum } from "@/lib/net/protocol";
import { getUserMatch, readMatch } from "@/lib/redis/match-store";
import * as presence from "@/lib/redis/presence-store";
import {
  apply,
  endGrace,
  finishMatch,
  graceWaitedMs,
  isInGrace,
  refreshDeadlineAfterGrace,
  resetStrikes,
  scheduleDeadline,
  startGrace,
  type Mutator,
} from "@/server/ws/match-hub";
import { registry, type Conn } from "@/server/ws/registry";

/** Столько ждущий обязан потерпеть, прежде чем закрывать матч досрочно. */
const CLAIM_AFTER_MS = 30_000;

/* ------------------------------------------------------------------ *
 * Действия в бою
 * ------------------------------------------------------------------ */

export async function onSubmitCard(
  conn: Conn,
  payload: ClientPayload<"submit_card">,
): Promise<void> {
  await act(conn, payload.matchId, "submit_card", (match, playerNum) =>
    submitCard(match, playerNum, payload.cardId),
  );
}

export async function onPassTurn(
  conn: Conn,
  payload: ClientPayload<"pass_turn">,
): Promise<void> {
  await act(conn, payload.matchId, "pass_turn", (match, playerNum) =>
    passTurn(match, playerNum),
  );
}

export async function onUseAbility(
  conn: Conn,
  payload: ClientPayload<"use_ability">,
): Promise<void> {
  await act(conn, payload.matchId, "use_ability", (match, playerNum) =>
    activateAbility(match, playerNum, payload.abilityId),
  );
}

export async function onPassAbility(
  conn: Conn,
  payload: ClientPayload<"pass_ability">,
): Promise<void> {
  await act(conn, payload.matchId, "pass_ability", (match, playerNum) =>
    passAbilityPhase(match, playerNum),
  );
}

export async function onSurrender(
  conn: Conn,
  payload: ClientPayload<"surrender">,
): Promise<void> {
  const playerNum = await requireSeat(conn, payload.matchId);
  await finishMatch(payload.matchId, playerNum === 1 ? 2 : 1, "surrender");
}

/**
 * Ждущий вправе не досиживать минуту целиком — но только после того, как
 * дал сопернику полминуты на возврат.
 */
export async function onClaimVictory(
  conn: Conn,
  payload: ClientPayload<"claim_victory">,
): Promise<void> {
  const playerNum = await requireSeat(conn, payload.matchId);
  const opponentNum: PlayerNum = playerNum === 1 ? 2 : 1;

  if (!(await isInGrace(payload.matchId, opponentNum))) {
    throw new ProtocolError("ILLEGAL_ACTION");
  }

  const waitedMs = (await graceWaitedMs(payload.matchId, opponentNum)) ?? 0;
  if (waitedMs < CLAIM_AFTER_MS) throw new ProtocolError("ILLEGAL_ACTION");

  await finishMatch(payload.matchId, playerNum, "disconnect_timeout");
}

export async function onRequestSnapshot(
  conn: Conn,
  payload: ClientPayload<"request_snapshot">,
): Promise<void> {
  const stored = await readMatch(payload.matchId);
  if (!stored) throw new ProtocolError("NOT_IN_MATCH");

  requireParticipant(stored.match, conn.userId);
  registry.pushMatchStateTo(conn, stored.match, stored.version);
}

/* ------------------------------------------------------------------ *
 * Общий путь действия
 * ------------------------------------------------------------------ */

type SeatMutator = (match: Match, playerNum: PlayerNum) => Match;

/**
 * Движок сам отвергает нелегальный ход, возвращая тот же объект. Отличить
 * «нельзя» от «ничего не изменилось» можно только по ссылке — на этом и
 * построена проверка легальности.
 */
async function act(
  conn: Conn,
  matchId: string,
  type: string,
  mutate: SeatMutator,
): Promise<void> {
  const startedAt = Date.now();
  const playerNum = await requireSeat(conn, matchId);

  let rejected = false;
  const mutator: Mutator = (match) => {
    if (match.status !== "in_progress") {
      rejected = true;
      return match;
    }

    const next = mutate(match, playerNum);
    if (next === match) rejected = true;
    return next;
  };

  const applied = await apply(matchId, mutator);

  if (rejected) throw new ProtocolError("ILLEGAL_ACTION");
  if (!applied) throw new ProtocolError("STORAGE_UNAVAILABLE");

  // Сыграл сам — прежние просрочки больше не в счёт.
  await resetStrikes(matchId, playerNum);

  log({
    evt: "match.action",
    matchId,
    type,
    latencyMs: Date.now() - startedAt,
  });
}

async function requireSeat(conn: Conn, matchId: string): Promise<PlayerNum> {
  const stored = await readMatch(matchId);
  if (!stored) throw new ProtocolError("NOT_IN_MATCH");

  return requireParticipant(stored.match, conn.userId);
}

function requireParticipant(match: Match, userId: string): PlayerNum {
  if (match.player1.id === userId) return 1;
  if (match.player2.id === userId) return 2;
  throw new ProtocolError("NOT_IN_MATCH");
}

/* ------------------------------------------------------------------ *
 * Разрыв и возврат
 * ------------------------------------------------------------------ */

/** Разрыв связи в бою: соперник узнаёт об этом, таймер хода замирает. */
export async function onMatchDisconnect(conn: Conn): Promise<void> {
  const matchId = await getUserMatch(conn.userId);
  if (!matchId) return;

  const stored = await readMatch(matchId);
  if (!stored || stored.match.status !== "in_progress") return;

  const playerNum: PlayerNum = stored.match.player1.id === conn.userId ? 1 : 2;
  await startGrace(matchId, playerNum);

  const opponent = registry.opponentOf(stored.match, conn.userId);
  if (opponent) {
    registry.send(opponent, "opponent_disconnected", { graceSeconds: 60 });
  }
}

/**
 * Возврат в бой: снимаем grace, отдаём снапшот и заново синхронизируем
 * дедлайн — клиент не доигрывает пропущенное, а принимает состояние целиком.
 */
export async function resumeIntoMatch(
  conn: Conn,
  matchId: string,
): Promise<void> {
  const stored = await readMatch(matchId);
  if (!stored || stored.match.status !== "in_progress") return;

  const playerNum: PlayerNum = stored.match.player1.id === conn.userId ? 1 : 2;
  conn.scope = { kind: "match", matchId, playerNum };

  if (await isInGrace(matchId, playerNum)) {
    await endGrace(matchId, playerNum);
    await refreshDeadlineAfterGrace(matchId);
    log({ evt: "match.grace", matchId, playerNum, phase: "end" });

    const opponent = registry.opponentOf(stored.match, conn.userId);
    if (opponent) registry.send(opponent, "opponent_reconnected", {});
  }

  await presence.touch(conn.userId, "in_match");

  // Перечитываем: продление дедлайна выше уже подняло версию матча.
  const fresh = (await readMatch(matchId)) ?? stored;
  registry.pushMatchStateTo(conn, fresh.match, fresh.version);
  scheduleDeadline(fresh.match);
}
