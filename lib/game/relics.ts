import type { AbilityCard, MatchPlayer } from "@/lib/game/types";

export type RelicGameEvent =
  | { type: "hp_changed"; prevHp: number }
  | { type: "card_played"; card: AbilityCard }
  | { type: "turn_start" }
  | { type: "match_start" };

export interface Relic {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  icon: string;
  apply: (player: MatchPlayer, event: RelicGameEvent) => MatchPlayer;
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const ALL_RELICS: Relic[] = [
  {
    id: "iron-will",
    name: "Железная воля",
    description: "Когда HP падает ниже 30%, получить +2 энергии",
    flavorText: "Ломаться нельзя.",
    icon: "⚔️",
    apply: (player, event) => {
      if (event.type !== "hp_changed") return player;
      const crossed =
        event.prevHp / player.maxHp >= 0.3 && player.hp / player.maxHp < 0.3;
      if (!crossed) return player;
      return {
        ...player,
        energy: Math.min(player.energy + 2, player.maxEnergy),
      };
    },
  },
  {
    id: "blood-price",
    name: "Цена крови",
    description: "Карты стоимостью 0 наносят +5 урона",
    flavorText: "Бесплатно только сыр в мышеловке.",
    icon: "🩸",
    apply: (player, event) => {
      if (event.type !== "card_played" || event.card.cost !== 0) return player;
      return {
        ...player,
        activeEffects: [
          ...player.activeEffects,
          {
            type: "strength_up",
            value: 5,
            duration: 1,
            source: "relic-blood-price",
          },
        ],
      };
    },
  },
  {
    id: "dark-pact",
    name: "Тёмный пакт",
    description: "В начале хода: -5 HP, +1 энергия",
    flavorText: "Выгодная сделка для того, кто выживет.",
    icon: "🌑",
    apply: (player, event) => {
      if (event.type !== "turn_start") return player;
      return {
        ...player,
        hp: Math.max(1, player.hp - 5),
        energy: Math.min(player.maxEnergy, player.energy + 1),
      };
    },
  },
  {
    id: "echo-chamber",
    name: "Эхо-камера",
    description: "Карты с ценой ≥ 4 дают +1 силу на ход",
    flavorText: "Медиа-пространство работает на тебя.",
    icon: "📡",
    apply: (player, event) => {
      if (event.type !== "card_played" || event.card.cost < 4) return player;
      return {
        ...player,
        activeEffects: [
          ...player.activeEffects,
          {
            type: "strength_up",
            value: 3,
            duration: 1,
            source: "relic-echo-chamber",
          },
        ],
      };
    },
  },
  {
    id: "war-chest",
    name: "Военная казна",
    description: "Максимум энергии +1",
    flavorText: "Деньги решают.",
    icon: "💰",
    apply: (player, event) => {
      if (event.type !== "match_start") return player;
      return {
        ...player,
        maxEnergy: player.maxEnergy + 1,
        energy: player.energy + 1,
      };
    },
  },
];

export function getRelicById(id: string): Relic | undefined {
  return ALL_RELICS.find((r) => r.id === id);
}

export function offerRelics(count = 3): Relic[] {
  return shuffleArray(ALL_RELICS).slice(0, count);
}

export function applyRelic(
  player: MatchPlayer,
  relicId: string | undefined | null,
  event: RelicGameEvent,
): MatchPlayer {
  if (!relicId) return player;
  const relic = getRelicById(relicId);
  if (!relic) return player;
  return relic.apply(player, event);
}
