import { createMultiplayerMatch } from "@/lib/game/engine";
import type { Match } from "@/lib/game/types";
import { createMatchRecordSafe } from "@/lib/models";
import { log } from "@/lib/net/log";
import type { PlayerBrief, ServerPayload } from "@/lib/net/protocol";
import { createMatch, setUserMatch } from "@/lib/redis/match-store";
import * as metrics from "@/lib/redis/metrics-store";
import * as presence from "@/lib/redis/presence-store";
import { scheduleDeadline } from "@/server/ws/match-hub";
import { registry } from "@/server/ws/registry";

/** Пауза перед первым ходом: клиент успевает проиграть заставку «соперник найден». */
const COUNTDOWN_MS = 3000;

export type MatchSource = ServerPayload<"match_found">["source"];

export interface StartSide {
  userId: string;
  nickname: string;
  rating: number;
  characterId: string;
}

/**
 * Единственная точка создания мультиплеерного матча. Очередь, лобби и реванш
 * приходят сюда, чтобы порядок записи в сторы и рассылки был один и тот же.
 */
export async function startMatch(
  first: StartSide,
  second: StartSide,
  source: MatchSource,
): Promise<Match> {
  const match = createMultiplayerMatch(
    first.userId,
    first.nickname,
    first.characterId,
    second.userId,
    second.nickname,
    second.characterId,
  );

  await createMatch(match);
  await Promise.all([
    setUserMatch(first.userId, match.id),
    setUserMatch(second.userId, match.id),
    presence.touch(first.userId, "in_match"),
    presence.touch(second.userId, "in_match"),
  ]);

  await createMatchRecordSafe({
    matchId: match.id,
    player1Id: first.userId,
    player2Id: second.userId,
    winnerId: null,
    status: "in_progress",
    characterP1: first.characterId,
    characterP2: second.characterId,
    turnsPlayed: 0,
    startedAt: match.createdAt,
    finishedAt: null,
    createdAt: match.createdAt,
  });

  log({ evt: "match.start", matchId: match.id, source });
  metrics.trackMatch(match.id, true);
  if (source === "queue") metrics.bump("queue.match");

  announce(match, first, second, source);

  return match;
}

function announce(
  match: Match,
  first: StartSide,
  second: StartSide,
  source: MatchSource,
): void {
  const sides = [
    { side: first, opponent: second, playerNum: 1 as const },
    { side: second, opponent: first, playerNum: 2 as const },
  ];

  for (const { side, opponent, playerNum } of sides) {
    const brief: PlayerBrief = {
      userId: opponent.userId,
      nickname: opponent.nickname,
      rating: opponent.rating,
      characterId: opponent.characterId,
    };

    registry.sendTo(side.userId, "match_found", {
      matchId: match.id,
      playerNum,
      opponent: brief,
      countdownMs: COUNTDOWN_MS,
      source,
    });
  }

  registry.pushMatchState(match, 1);
  scheduleDeadline(match);
}
