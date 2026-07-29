/** «0:42» — единый формат таймеров лобби: очередь, отсчёт старта, инвайты. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const PLURAL_SEARCHING: [string, string, string] = ["игрок", "игрока", "игроков"];

export function pluralize(
  count: number,
  forms: [string, string, string] = PLURAL_SEARCHING,
): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** 1247 → «1 247»: длинные числа в очереди иначе не читаются. */
export function formatCount(value: number): string {
  return value.toLocaleString("ru-RU");
}
