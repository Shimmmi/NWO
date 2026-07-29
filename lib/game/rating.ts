const K_FACTOR = 32; // новички
const K_FACTOR_ESTABLISHED = 16; // после 30 матчей

/** Elo-дельта по итогу матча (ЧАСТЬ 6.7 ТЗ). Стартовый рейтинг — 1000. */
export function eloDelta(
  myRating: number,
  oppRating: number,
  won: boolean,
  games: number,
): number {
  const expected = 1 / (1 + 10 ** ((oppRating - myRating) / 400));
  const k = games < 30 ? K_FACTOR : K_FACTOR_ESTABLISHED;
  return Math.round(k * ((won ? 1 : 0) - expected));
}
