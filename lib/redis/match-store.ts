import type { Match } from "@/lib/game/types";
import { emptyBattleRound } from "@/lib/game/types";
import { logError } from "@/lib/net/log";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";

export interface VersionedMatch {
  match: Match;
  version: number;
}

/**
 * Заполняет поля, которых может не быть в старых записях: матчи живут 6 часов
 * и переживают выкат новой версии схемы.
 */
export function normalizeMatch(match: Match): Match {
  return {
    ...match,
    combatLog: match.combatLog ?? [],
    abilityPhaseCards: match.abilityPhaseCards ?? [],
    pendingActions: match.pendingActions ?? { 1: null, 2: null },
    turnPassed: match.turnPassed ?? { 1: false, 2: false },
    abilityOrder: match.abilityOrder ?? 1,
    abilityPhasePassed: match.abilityPhasePassed ?? { 1: false, 2: false },
    battleRound: match.battleRound ?? emptyBattleRound(),
    roundEvents: match.roundEvents ?? [],
    lastResolution: match.lastResolution
      ? {
          ...match.lastResolution,
          roundEvents: match.lastResolution.roundEvents ?? [],
        }
      : undefined,
  };
}

export async function readMatch(id: string): Promise<VersionedMatch | null> {
  const [raw, rawVersion] = await kv().mget([K.match(id), K.matchVer(id)]);
  if (!raw) return null;

  let parsed: Match;
  try {
    parsed = JSON.parse(raw) as Match;
  } catch (err) {
    logError("match-store", err);
    return null;
  }

  return { match: normalizeMatch(parsed), version: Number(rawVersion ?? 0) };
}

export async function createMatch(match: Match): Promise<void> {
  const json = JSON.stringify(normalizeMatch(match));
  await kv().set(K.match(match.id), json, { ex: TTL.MATCH_SEC });
  await kv().set(K.matchVer(match.id), "1", { ex: TTL.MATCH_SEC });
}

/** false — версия устарела: вызывающий перечитывает матч и повторяет мутацию. */
export async function casMatch(
  id: string,
  expectedVersion: number,
  next: Match,
): Promise<boolean> {
  const result = await kv().script(
    "casMatch",
    [K.match(id), K.matchVer(id)],
    [
      String(expectedVersion),
      JSON.stringify(normalizeMatch(next)),
      String(TTL.MATCH_SEC),
    ],
  );
  return result === 1;
}

export async function deleteMatch(id: string): Promise<void> {
  await kv().del(K.match(id), K.matchVer(id), K.matchSnap(id));
}

export async function setUserMatch(
  userId: string,
  matchId: string,
): Promise<void> {
  await kv().set(K.userMatch(userId), matchId, { ex: TTL.MATCH_SEC });
}

export async function getUserMatch(userId: string): Promise<string | null> {
  return kv().get(K.userMatch(userId));
}

export async function clearUserMatch(userId: string): Promise<void> {
  await kv().del(K.userMatch(userId));
}
