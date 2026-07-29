import type { AbilityCard, Character, FormStats, UniqueAbility } from "@/lib/game/types";
import { FORM_STATS } from "@/lib/game/types";

type CardDef = [
  string,
  string,
  number,
  number,
  AbilityCard["rarity"],
  AbilityCard["type"],
  string,
  string,
  string?,
];

function cards(defs: CardDef[]): AbilityCard[] {
  return defs.map(
    ([id, name, cost, speed, rarity, type, effect, description, flavorText]) => ({
      id,
      name,
      cost,
      speed,
      effect,
      rarity,
      type,
      description,
      ...(flavorText ? { flavorText } : {}),
    }),
  );
}

const DONALD_RUMPF_CARDS = cards([
  ["dr-tweet", "Твит-шторм", 1, 3, "common", "active", "distraction:1", "Рассеивает внимание: -1 к скорости след. карты противника"],
  ["dr-wall", "Великая стена", 2, 1, "common", "active", "block:30", "Блокирует 30 ед. урона на этот ход"],
  ["dr-tariff", "Тариф на импорт", 2, 2, "common", "active", "damage:20 sanction:1", "Наносит 20 ед. урона, блокирует +1 энергии врагу в след. ходу"],
  ["dr-rally", "Митинг MAGA", 1, 2, "common", "active", "energy:1 draw_discard:1", "+1 энергии, вернуть 1 карту из сброса"],
  ["dr-deal", "Искусство сделки", 0, 1, "common", "passive", "cost_reduce:1 duration:1", "Следующий ход: стоимость карт -1"],
  ["dr-fake-news", "Фейк-ньюс", 2, 3, "common", "active", "armor_reduce:10 duration:1", "Снижает броню противника на 10 до конца хода"],
  ["dr-ban", "Президентский бан", 3, 1, "rare", "active", "block_hand:1", "Блокирует одну карту противника в руке (случайно)"],
  ["dr-sanctions", "Пакет санкций", 3, 2, "rare", "active", "damage:25 sanction:1", "25 ед. урона + блокировка восстановления энергии врага"],
  ["dr-media", "Медиашторм", 2, 3, "rare", "active", "speed_up:2 draw:1", "+2 к скорости следующей карты, +1 карта в руку"],
  ["dr-golf", "Игра в гольф", 0, 0, "rare", "passive", "heal:15", "Восстанавливает 15 HP"],
  ["dr-executive", "Указ президента", 4, 1, "epic", "active", "damage:40 armor_ignore", "40 ед. урона, игнорирует броню"],
  ["dr-trade-war", "Торговая война", 4, 2, "epic", "active", "damage:30 energy_steal:2", "30 ед. урона + steal 2 энергии у противника"],
  ["dr-veto", "Право вето", 3, 1, "epic", "active", "invulnerability duration:1", "Неуязвимость на 1 фазу"],
  ["dr-fire", "Вы уволены!", 3, 3, "epic", "active", "cancel_last:1", "Отменяет последнюю сыгранную карту противника"],
  ["dr-maga-hat", "Красная кепка", 2, 2, "rare", "active", "strength_up:5 duration:2", "+5 к силе на 2 хода"],
  ["dr-twitter-ban", "Бан Твиттера", 5, 1, "legendary", "active", "damage:50 skip_ability:1", "50 ед. урона + противник пропускает фазу способностей"],
  ["dr-wall-2", "Мексиканская стена", 4, 0, "rare", "active", "block:50 duration:2", "Блокирует 50 ед. урона, действует 2 хода"],
  ["dr-nuclear", "Большая кнопка", 6, 0, "legendary", "ultimate", "damage:80 armor_ignore ignore_defense", "80 ед. урона, игнорирует броню и эффекты защиты"],
  ["dr-maga-phoenix", "Возрождение MAGA", 5, 1, "legendary", "ultimate", "heal:40 energy:3", "Восстанавливает 40 HP + +3 энергии немедленно"],
  ["dr-impeach", "Импичмент... снова?", 3, 2, "epic", "active", "hp_percent:50", "Снижает HP противника до 50% текущего значения (мин. 1)"],
]);

const VLADIMIR_PU_CARDS = cards([
  ["vp-hybrid", "Гибридная война", 2, 3, "common", "active", "damage:15 propaganda:1", "Наносит 15 ед. урона + пропаганда на 1 ход"],
  ["vp-gas", "Газовый рычаг", 2, 1, "common", "active", "sanction:1 duration:2", "Блокирует +1 энергии у противника на 2 хода"],
  ["vp-judo", "Дзюдо-бросок", 1, 3, "common", "active", "damage:10 speed_up:2", "10 ед. урона, +2 к скорости в этом ходу"],
  ["vp-bunker", "Бункер", 2, 0, "common", "active", "block:35", "Блокирует 35 ед. урона на этот ход"],
  ["vp-disinfo", "Дезинформация", 1, 2, "common", "active", "propaganda:1", "Снижает точность след. карты врага (50% chance miss)"],
  ["vp-siloviki", "Силовики", 3, 1, "common", "active", "damage:20 armor_up:10 duration:1", "20 ед. урона + +10 к броне на 1 ход"],
  ["vp-pipeline", "Трубопровод", 3, 1, "rare", "active", "energy:2 heal:10", "Восстанавливает 2 энергии + 10 HP"],
  ["vp-oligarch", "Олигарх", 2, 2, "rare", "active", "steal_card", "Steal 1 карту из руки противника (случайно)"],
  ["vp-nuke-hint", "Намёк на ядерку", 4, 0, "rare", "active", "block:999 duration:1", "Блокирует любую карту с уроном >30 в этом ходу"],
  ["vp-tass", "Официальная версия", 2, 3, "rare", "active", "clear_effects", "Отменяет один активный эффект у противника"],
  ["vp-bear", "Медвежья хватка", 4, 1, "epic", "active", "damage:45", "45 ед. урона"],
  ["vp-nerve", "Нервный агент", 5, 2, "epic", "active", "damage:35 poison:10 duration:2", "35 ед. урона + яд: -10 HP врагу в теч. 2 ходов"],
  ["vp-fortress", "Крепость", 4, 0, "epic", "active", "invulnerability duration:1 heal:15", "Неуязвимость 1 ход + +15 HP"],
  ["vp-special-op", "Спецоперация", 5, 1, "epic", "active", "damage:55 armor_ignore", "55 ед. урона, игнорирует броню"],
  ["vp-fsb", "Сигнал ФСБ", 3, 3, "rare", "active", "sanction:1 duration:1", "Противник не может разыграть карты стоимостью >3 в след. ход"],
  ["vp-sputnik", "Спутник-5", 3, 2, "rare", "active", "heal:25", "Восстанавливает 25 HP"],
  ["vp-cyber", "Кибератака", 4, 3, "epic", "active", "discard_hand:2", "Сбрасывает 2 случайные карты из руки противника"],
  ["vp-sovereign", "Суверенная ядерка", 6, 0, "legendary", "ultimate", "damage:90 ignore_defense", "90 ед. урона, игнорирует все защитные эффекты"],
  ["vp-eternal", "Вечный президент", 5, 1, "legendary", "ultimate", "heal:50 energy:2 armor_up:10", "+50 HP, +2 энергии, +10 к броне навсегда (до трансформации)"],
  ["vp-bearmode", "Режим медведя", 5, 2, "legendary", "ultimate", "sanction:2 duration:2", "Следующие 2 хода все карты противника стоят +2 энергии"],
]);

const JIN_SHI_CARDS = cards([
  ["js-belt", "Один пояс", 1, 1, "common", "active", "energy:2 duration:1", "+2 энергии следующий ход"],
  ["js-road", "Один путь", 1, 1, "common", "active", "draw:1 draw_next:1", "+1 карта в руку, +1 карта в след. ходу"],
  ["js-factory", "Мировая фабрика", 2, 0, "common", "active", "cost_reduce:2 duration:1", "Снижает стоимость след. карты на 2"],
  ["js-censor", "Великий файервол", 2, 1, "common", "active", "propaganda:1 duration:1", "Блокирует все карты типа информация у врага (1 ход)"],
  ["js-panda", "Дипломатия панды", 1, 2, "common", "passive", "heal:10 strength_down:5 duration:1", "Heal 10 HP + снизить силу следующей атаки врага на 5"],
  ["js-five-year", "Пятилетний план", 0, 0, "common", "passive", "draw:1 duration:5", "На 5 ходов: каждый ход +1 доп. карта в руку"],
  ["js-yuan", "Курс юаня", 3, 2, "rare", "active", "energy_steal:2", "Steal 2 энергии у противника"],
  ["js-social", "Социальный рейтинг", 3, 1, "rare", "active", "skip_ability:1", "Противник пропускает разыгрывание 1 карты в след. ход"],
  ["js-tech", "Технологический шпионаж", 2, 3, "rare", "active", "copy_last", "Копирует эффект последней карты противника"],
  ["js-army", "НОАК", 4, 2, "rare", "active", "damage:30", "30 ед. урона"],
  ["js-xi-thought", "Мысль Ши", 3, 1, "rare", "active", "energy:3 cost_reduce:99 duration:1", "+3 энергии, следующая карта бесплатна"],
  ["js-tariff-back", "Контртарифы", 3, 2, "rare", "active", "reflect:50 duration:1", "Отражает 50% урона следующей атаки врага"],
  ["js-dragon", "Пробуждение дракона", 5, 1, "epic", "active", "damage:50", "50 ед. урона"],
  ["js-bri", "Инициатива пояса", 4, 0, "epic", "active", "energy:3 heal:20", "+3 энергии + Heal 20 HP"],
  ["js-propaganda", "Пропаганда CCTV", 4, 2, "epic", "active", "speed_down:1 duration:1", "Все карты противника в руке теряют по 1 к скорости"],
  ["js-censure", "Внутренняя критика", 3, 3, "epic", "active", "discard_hand:1", "Сбрасывает 1 случайную карту врага"],
  ["js-emperor", "Новый Сын Неба", 5, 1, "legendary", "ultimate", "heal:60 energy:4", "Heal 60 HP + +4 энергии немедленно"],
  ["js-eternal-rule", "Пожизненный мандат", 6, 0, "legendary", "ultimate", "damage:75 sanction:2 duration:2", "75 ед. урона + противник не восстанавливает энергию 2 хода"],
  ["js-century", "Век унижений прошёл", 5, 2, "legendary", "ultimate", "clear_effects damage:40", "Все активные эффекты врага отменяются + 40 ед. урона"],
  ["js-dragon-fire", "Огонь дракона", 6, 1, "legendary", "ultimate", "damage:65 armor_ignore copy_last", "65 ед. урона, игнорирует броню + копирует один эффект врага"],
]);

const VLADO_ZELENKO_CARDS = cards([
  ["vz-speech", "Речь к Конгрессу", 1, 3, "common", "active", "speed_up:2 draw:1", "+2 к скорости следующей карты, нарратив: +1 карта"],
  ["vz-green", "Зелёная футболка", 0, 2, "common", "passive", "heal:8", "Heal 8 HP — легендарная броня народного президента"],
  ["vz-drone", "FPV-дрон", 2, 3, "common", "active", "damage:18 armor_ignore", "18 ед. урона, игнорирует броню"],
  ["vz-javelin", "Джавелин", 3, 2, "common", "active", "damage:30", "30 ед. урона"],
  ["vz-comedian", "Стенд-ап", 1, 3, "common", "active", "speed_down:2 duration:1", "Снижает скорость след. карты врага на 2"],
  ["vz-resilience", "Мы не сдамся", 0, 1, "common", "passive", "energy:2 hp_threshold:30", "При HP <30% — получить +2 энергии"],
  ["vz-nato", "Зов в НАТО", 2, 2, "rare", "active", "heal:15 armor_up:1 duration:2", "+15 HP + +1 к броне на 2 хода"],
  ["vz-himars", "HIMARS", 4, 2, "rare", "active", "damage:35 ignore_defense", "35 ед. урона, точный удар — игнорирует блок"],
  ["vz-selfie", "Фронтовое селфи", 2, 3, "rare", "active", "copy_next", "Копирует эффект следующей карты (сыграть как бонус)"],
  ["vz-press", "Брифинг для прессы", 2, 3, "rare", "active", "speed_down:2 duration:1", "Противник теряет 2 к скорости всех карт в этом ходу"],
  ["vz-macro", "Гарантии безопасности", 3, 1, "rare", "active", "block:40 duration:1", "Неуязвимость на половину хода (block: 40)"],
  ["vz-cluster", "Кассетные боеприпасы", 4, 2, "rare", "active", "damage:25 hits:2", "25 ед. урона × 2 (двойное применение, -5 каждый)"],
  ["vz-counteroffensive", "Контрнаступ", 5, 2, "epic", "active", "damage:45 armor_reduce:15", "45 ед. урона + снизить броню врага на 15"],
  ["vz-bradley", "Бредли", 4, 2, "epic", "active", "damage:35 energy_steal:1", "35 ед. урона + steal 1 энергии"],
  ["vz-azov", "Азовсталь", 4, 1, "epic", "active", "block:55 duration:1", "Блокирует 55 ед. урона, действует 1 ход"],
  ["vz-zelensky-on-air", "В прямом эфире", 3, 3, "epic", "active", "clear_effects", "Обнуляет все активные эффекты врага"],
  ["vz-slava", "Слава Україні!", 5, 3, "legendary", "ultimate", "speed_up:5 duration:2 damage:20", "+5 к скорости всех карт в руке на 2 хода + 20 ед. урона"],
  ["vz-iron-resolve", "Железная воля", 5, 1, "legendary", "ultimate", "heal:50 survive_lethal", "Heal 50 HP + следующий удар по тебе не убивает (остаётся 1 HP)"],
  ["vz-trident", "Трезубец", 6, 1, "legendary", "ultimate", "damage:70 ignore_defense heal:30", "70 ед. урона, игнорирует все эффекты + +30 HP"],
  ["vz-freedom", "Воля к победе", 6, 3, "legendary", "ultimate", "free_cards", "Все твои карты в этом ходу стоят 0 + скорость +3 ко всем"],
]);

const DONALD_RUMPF_ABILITIES: UniqueAbility[] = [
  {
    id: "dr-ua-tweet",
    name: "Твит в 3 ночи",
    chargeCost: 1,
    description: "Наносит 4 урона и накладывает «Медийный скандал» на 2 хода.",
    effect: "damage:4 propaganda:1 duration:2",
  },
  {
    id: "dr-ua-sanctions",
    name: "Введём санкции",
    chargeCost: 2,
    description: "Блокирует одну карту оппонента на следующий раунд.",
    effect: "block_hand:1",
  },
  {
    id: "dr-ua-wall",
    name: "Построить стену",
    chargeCost: 3,
    description: "Добавляет 15 брони и блокирует 15 урона на 2 хода.",
    effect: "block:15 armor_up:15 duration:2",
  },
];

const VLADIMIR_PU_ABILITIES: UniqueAbility[] = [
  {
    id: "vp-ua-hybrid",
    name: "Гибридный удар",
    chargeCost: 1,
    description: "15 урона и пропаганда на 1 ход.",
    effect: "damage:15 propaganda:1 duration:1",
  },
  {
    id: "vp-ua-gas",
    name: "Газовый рычаг",
    chargeCost: 2,
    description: "Санкции: +1 к стоимости карт противника на 2 хода.",
    effect: "sanction:1 duration:2",
  },
  {
    id: "vp-ua-bear",
    name: "Медвежья хватка",
    chargeCost: 3,
    description: "30 урона и блок 20 на этот ход.",
    effect: "damage:30 block:20",
  },
];

const JIN_SHI_ABILITIES: UniqueAbility[] = [
  {
    id: "js-ua-belt",
    name: "Один пояс — один путь",
    chargeCost: 1,
    description: "+2 энергии и 1 карта в руку.",
    effect: "energy:2 draw:1",
  },
  {
    id: "js-ua-social",
    name: "Социальный рейтинг",
    chargeCost: 2,
    description: "Противник пропускает фазу способностей.",
    effect: "skip_ability:1",
  },
  {
    id: "js-ua-dragon",
    name: "Пробуждение дракона",
    chargeCost: 3,
    description: "25 урона и +15 HP.",
    effect: "damage:25 heal:15",
  },
];

const VLADO_ZELENKO_ABILITIES: UniqueAbility[] = [
  {
    id: "vz-ua-congress",
    name: "Речь к Конгрессу",
    chargeCost: 1,
    description: "+12 HP и 1 карта в руку.",
    effect: "heal:12 draw:1",
  },
  {
    id: "vz-ua-drone",
    name: "Удар дрона",
    chargeCost: 2,
    description: "20 урона, игнорирует броню.",
    effect: "damage:20 armor_ignore",
  },
  {
    id: "vz-ua-slava",
    name: "Слава Україні!",
    chargeCost: 3,
    description: "15 урона и +3 к скорости на 2 хода.",
    effect: "damage:15 speed_up:3 duration:2",
  },
];

const CHARACTERS: Character[] = [
  {
    id: "donald-rumpf",
    name: "Дональд Рампф",
    country: "США",
    countryCode: "us",
    countryAccent: "blue",
    description: "Агрессия, медийный хаос, экономическое давление",
    quote: "Я сделаю мир снова великим. Поверьте мне, поверьте.",
    stats: FORM_STATS["donald-rumpf"][0],
    forms: FORM_STATS["donald-rumpf"].map((f) => f.name),
    passiveAbility: "Торговая сделка",
    passiveDescription: "Каждый чётный ход +2 энергии",
    uniqueAbilities: DONALD_RUMPF_ABILITIES,
    abilityCards: DONALD_RUMPF_CARDS,
  },
  {
    id: "vladimir-pu",
    name: "Владимир Пу",
    country: "Россия",
    countryCode: "ru",
    countryAccent: "red",
    description: "Контроль, дезинформация, жёсткая защита",
    quote: "Россия не блефует. Россия никогда не блефует.",
    stats: FORM_STATS["vladimir-pu"][0],
    forms: FORM_STATS["vladimir-pu"].map((f) => f.name),
    passiveAbility: "Вертикаль власти",
    passiveDescription: "Каждый чётный ход -20% входящего урона",
    uniqueAbilities: VLADIMIR_PU_ABILITIES,
    abilityCards: VLADIMIR_PU_CARDS,
  },
  {
    id: "jin-shi",
    name: "Джин Ши",
    country: "Китай",
    countryCode: "cn",
    countryAccent: "crimson",
    description: "Долгосрочная стратегия, экономическая экспансия, самовоспроизводство ресурсов",
    quote: "Сила Китая — это сила миллиарда голосов. И все они говорят то же, что и я.",
    stats: FORM_STATS["jin-shi"][0],
    forms: FORM_STATS["jin-shi"].map((f) => f.name),
    passiveAbility: "Народный консенсус",
    passiveDescription: "Каждый чётный ход возвращает 1 случайную карту из сброса в руку",
    uniqueAbilities: JIN_SHI_ABILITIES,
    abilityCards: JIN_SHI_CARDS,
  },
  {
    id: "vlado-zelenko",
    name: "Владо Зеленко",
    country: "Украина",
    countryCode: "ua",
    countryAccent: "gold",
    description: "Высокая скорость, мобильность, медийная привлекательность, поддержка союзников",
    quote: "Мне нужны не такси — мне нужны боеприпасы.",
    stats: FORM_STATS["vlado-zelenko"][0],
    forms: FORM_STATS["vlado-zelenko"].map((f) => f.name),
    passiveAbility: "Поддержка союзников",
    passiveDescription: "Каждый чётный ход +3 к скорости следующей карты",
    uniqueAbilities: VLADO_ZELENKO_ABILITIES,
    abilityCards: VLADO_ZELENKO_CARDS,
  },
];

const CARD_INDEX = new Map<string, AbilityCard>();
for (const character of CHARACTERS) {
  for (const card of character.abilityCards) {
    CARD_INDEX.set(card.id, card);
  }
}

export function getCharacterById(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

export function getAllCharacters(): Character[] {
  return CHARACTERS;
}

export function getCardById(id: string): AbilityCard | undefined {
  return CARD_INDEX.get(id);
}

const CARD_OWNER = new Map<string, string>();
for (const character of CHARACTERS) {
  for (const card of character.abilityCards) {
    CARD_OWNER.set(card.id, character.id);
  }
}

export function getCharacterIdForCard(cardId: string): string | undefined {
  return CARD_OWNER.get(cardId);
}

export function getDefaultDeck(characterId: string): AbilityCard[] {
  const character = getCharacterById(characterId);
  if (!character) return [];
  return character.abilityCards.map((c) => ({ ...c }));
}

export function getFormStats(characterId: string): FormStats[] {
  return FORM_STATS[characterId] ?? [];
}

export { CHARACTERS, DONALD_RUMPF_CARDS, VLADIMIR_PU_CARDS, JIN_SHI_CARDS, VLADO_ZELENKO_CARDS };
