import type { UserRecord } from "@/lib/schema";
import { ECONOMY } from "@/lib/shop/economy";

export function computeMatchRewards(didWin: boolean): {
  xp: number;
  credits: number;
} {
  return didWin
    ? { xp: ECONOMY.MATCH_WIN_XP, credits: ECONOMY.MATCH_WIN_CREDITS }
    : { xp: ECONOMY.MATCH_LOSS_XP, credits: ECONOMY.MATCH_LOSS_CREDITS };
}

export function applyXp(
  user: UserRecord,
  gainedXp: number,
): { user: UserRecord; levelsGained: number } {
  let xp = (user.xp ?? 0) + gainedXp;
  let level = user.level ?? 1;
  let levelsGained = 0;
  while (xp >= ECONOMY.XP_PER_LEVEL) {
    xp -= ECONOMY.XP_PER_LEVEL;
    level += 1;
    levelsGained += 1;
  }
  return { user: { ...user, xp, level }, levelsGained };
}
