/** Display names for epic/legendary ability card slam text */
export const CARD_DISPLAY_NAMES: Record<string, string> = {
  "dr-executive": "Указ президента",
  "dr-trade-war": "Торговая война",
  "dr-veto": "Право вето",
  "dr-fire": "Вы уволены!",
  "dr-impeach": "Импичмент... снова?",
  "dr-twitter-ban": "Бан Твиттера",
  "dr-nuclear": "Большая кнопка",
  "dr-maga-phoenix": "Возрождение MAGA",

  "vp-bear": "Медвежья хватка",
  "vp-nerve": "Нервный агент",
  "vp-fortress": "Крепость",
  "vp-special-op": "Спецоперация",
  "vp-cyber": "Кибератака",
  "vp-sovereign": "Суверенная ядерка",
  "vp-eternal": "Вечный президент",
  "vp-bearmode": "Режим медведя",

  "js-dragon": "Пробуждение дракона",
  "js-bri": "Инициатива пояса",
  "js-propaganda": "Пропаганда CCTV",
  "js-censure": "Внутренняя критика",
  "js-emperor": "Новый Сын Неба",
  "js-eternal-rule": "Пожизненный мандат",
  "js-century": "Век унижений прошёл",
  "js-dragon-fire": "Огонь дракона",

  "vz-counteroffensive": "Контрнаступ",
  "vz-bradley": "Бредли",
  "vz-azov": "Азовсталь",
  "vz-zelensky-on-air": "В прямом эфире",
  "vz-slava": "Слава Україні!",
  "vz-iron-resolve": "Железная воля",
  "vz-trident": "Трезубец",
  "vz-freedom": "Воля к победе",
};

export const CHARACTER_TITLES: Record<string, string> = {
  "donald-rumpf": "DONALD RUMPF",
  "vladimir-pu": "VLADIMIR PU",
  "jin-shi": "JIN SHI",
  "vlado-zelenko": "VLADO ZELENKO",
};

export function resolveCardDisplayName(cardIdOrName: string): string {
  const baseId = cardIdOrName.split("#")[0];
  return CARD_DISPLAY_NAMES[baseId] ?? cardIdOrName;
}
