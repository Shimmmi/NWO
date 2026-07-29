import type { Match } from "@/lib/game/types";
import {
  casMatch,
  createMatch,
  deleteMatch as deleteStoredMatch,
  normalizeMatch,
  readMatch,
} from "@/lib/redis/match-store";

export { normalizeMatch };

export async function getMatch(id: string): Promise<Match | undefined> {
  const stored = await readMatch(id);
  return stored?.match;
}

/**
 * Create-or-overwrite без CAS. Годится для AI-режима, где писать в матч может
 * только один игрок. Мультиплеер обязан идти через casMatch.
 */
export async function saveMatch(match: Match): Promise<void> {
  const current = await readMatch(match.id);
  if (!current) {
    await createMatch(match);
    return;
  }
  await casMatch(match.id, current.version, match);
}

export async function deleteMatch(id: string): Promise<boolean> {
  const existed = (await readMatch(id)) !== null;
  await deleteStoredMatch(id);
  return existed;
}
