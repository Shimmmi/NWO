# WORLD ORDER — TZ v4.0: DECK BUILDER
## AAA Card Collection & Deck Construction System
> Стандарт: MTG Arena × Hearthstone Deckbuilder × Marvel Snap Collection
> Движок: Next.js 15 + Three.js + Framer Motion + DynamoDB
> Режим Cursor: Multi-Agent Parallel с Critic Loop (принимать только 9.5+/10)

---

## СОДЕРЖАНИЕ

- [ЧАСТЬ 0: Референсный анализ и диагноз](#часть-0-референсный-анализ)
- [ЧАСТЬ 1: Правила колоды](#часть-1-правила-колоды)
- [ЧАСТЬ 2: Мульти-агентная система v4](#часть-2-мульти-агентная-система)
- [ЧАСТЬ 3: Архитектура и данные](#часть-3-архитектура)
- [ЧАСТЬ 4: Layout — трёхпанельная система](#часть-4-layout)
- [ЧАСТЬ 5: Коллекция карт (Collection Panel)](#часть-5-коллекция)
- [ЧАСТЬ 6: Card Preview — 3D-превью](#часть-6-card-preview)
- [ЧАСТЬ 7: Deck List Panel](#часть-7-deck-list)
- [ЧАСТЬ 8: Stats & Curve Panel](#часть-8-stats)
- [ЧАСТЬ 9: Deck Codes — импорт/экспорт](#часть-9-deck-codes)
- [ЧАСТЬ 10: Анимации и ThreeJS](#часть-10-анимации)
- [ЧАСТЬ 11: Cursor Prompts & Critic Loop](#часть-11-cursor-prompts)

---

## ЧАСТЬ 0: РЕФЕРЕНСНЫЙ АНАЛИЗ

### 0.1 Что не так с текущим deck builder

| Проблема | Симптом | Приоритет |
|----------|---------|-----------|
| localStorage вместо БД | Колоды теряются при смене браузера | 🔴 КРИТИЧНО |
| Нет кривой маны/энергии | Игрок не видит баланс колоды | 🔴 КРИТИЧНО |
| Плоский список без визуала | Карты — строчки текста | 🟡 ВЫСОКИЙ |
| Нет предпросмотра карты | Нельзя прочесть эффект не кликая | 🟡 ВЫСОКИЙ |
| Нет deck code | Нельзя поделиться колодой | 🟡 ВЫСОКИЙ |
| Нет умной валидации | Непонятно почему колода невалидна | 🟡 ВЫСОКИЙ |
| Нет фильтров | Найти нужную карту сложно | 🟢 СРЕДНИЙ |
| Нет статистики колоды | Неясно насколько она сбалансирована | 🟢 СРЕДНИЙ |

### 0.2 Лучшие практики TCG из референсов

**MTG Arena:**
- Трёхпанельный layout: коллекция / дека / статы
- Цветовая полоска кривой манакоста прямо в header
- Ограничения по копиям чётко видны: `2/3` у карты
- Deck code одной кнопкой (copy/paste)
- Real-time валидация с понятными сообщениями
- Smart suggests: "Curve слишком тяжёлая, добавь карт cost 1-2"

**Hearthstone:**
- Большой превью карты при hover (не tooltip, а БОЛЬШОЙ)
- Drag & drop из коллекции в деку
- Счётчик карт `[14/30]` постоянно виден
- Кнопка "Завершить деку" становится активной при валидности

**Marvel Snap:**
- Лаконичная карточка с арт-акцентом
- Серия `×2` вместо двух строчек одной карты
- Анимация добавления карты в деку

### 0.3 Целевое состояние

```
До:  Две колонки с карточками и кнопка "Сохранить" в localStorage
После: MTG Arena-уровень — трёхпанельный builder с кривой энергии,
       3D-превью карты, real-time статистикой, deck codes, анимациями
       добавления и DynamoDB-бэкендом
```

---

## ЧАСТЬ 1: ПРАВИЛА КОЛОДЫ

### 1.1 Базовые ограничения (вдохновлено MTG)

```typescript
// lib/game/deckRules.ts

export const DECK_RULES = {
  // Размер колоды
  MIN_CARDS: 20,
  MAX_CARDS: 30,

  // Максимум копий по редкости (MTG-стиль: меньше = ценнее)
  MAX_COPIES: {
    common:    3,   // как MTG's "4-of": базовые карты можно стакать
    rare:      2,   // ценные, но можно иметь 2
    epic:      1,   // одна копия — сильная карта
    legendary: 1,   // уникальная — одна в колоде
  } as Record<Rarity, number>,

  // Обязательный состав колоды
  REQUIRED: {
    minDistinctCards: 8,    // минимум 8 разных карт (не всё на один тип)
    maxSameCostCards: 8,    // не больше 8 карт одной стоимости
  },

  // Рекомендованный состав (для "умных подсказок")
  RECOMMENDED: {
    lowCost: {   costRange: [0, 2], minCount: 6 },   // быстрые карты
    midCost: {   costRange: [3, 4], minCount: 6 },   // среднее тело
    highCost: {  costRange: [5, 6], minCount: 3 },   // финишеры
    protective:  { types: ["block", "heal"], minCount: 4 },
  },
} as const;

export type DeckValidationResult = {
  isValid: boolean;
  totalCards: number;
  errors: DeckError[];       // блокируют сохранение
  warnings: DeckWarning[];   // рекомендации
};

export type DeckError = {
  type: "too_few" | "too_many" | "wrong_character" | "copy_limit";
  message: string;
  cardId?: string;
};

export type DeckWarning = {
  type: "curve_heavy" | "curve_light" | "no_protection" | "no_finisher";
  message: string;
  suggestion: string;
};
```

### 1.2 Полный валидатор

```typescript
// lib/game/deckValidator.ts

export function validateDeck(
  cards: DeckEntry[],
  characterId: string
): DeckValidationResult {
  const errors: DeckError[] = [];
  const warnings: DeckWarning[] = [];
  const totalCards = cards.reduce((sum, e) => sum + e.count, 0);

  // ── ОШИБКИ (блокируют сохранение) ──────────────────────────────

  // 1. Размер
  if (totalCards < DECK_RULES.MIN_CARDS) {
    errors.push({
      type: "too_few",
      message: `В колоде ${totalCards} карт — нужно минимум ${DECK_RULES.MIN_CARDS}`,
    });
  }
  if (totalCards > DECK_RULES.MAX_CARDS) {
    errors.push({
      type: "too_many",
      message: `В колоде ${totalCards} карт — максимум ${DECK_RULES.MAX_CARDS}`,
    });
  }

  // 2. Копии по редкости
  for (const entry of cards) {
    const maxCopies = DECK_RULES.MAX_COPIES[entry.card.rarity];
    if (entry.count > maxCopies) {
      errors.push({
        type: "copy_limit",
        message: `"${entry.card.name}": максимум ${maxCopies} копи${maxCopies === 1 ? "я" : "и"}`,
        cardId: entry.card.id,
      });
    }
  }

  // 3. Карты не принадлежат персонажу
  const wrongChar = cards.filter(e =>
    !e.card.id.startsWith(getCharacterPrefix(characterId))
  );
  if (wrongChar.length > 0) {
    errors.push({
      type: "wrong_character",
      message: `${wrongChar.length} карт не принадлежат этому персонажу`,
    });
  }

  // ── ПРЕДУПРЕЖДЕНИЯ (рекомендации) ──────────────────────────────

  // Кривая энергии
  const allCards = cards.flatMap(e => Array(e.count).fill(e.card));
  const lowCostCount  = allCards.filter(c => c.cost <= 2).length;
  const highCostCount = allCards.filter(c => c.cost >= 5).length;

  if (lowCostCount < DECK_RULES.RECOMMENDED.lowCost.minCount) {
    warnings.push({
      type: "curve_heavy",
      message: "Мало дешёвых карт",
      suggestion: `Добавь ${DECK_RULES.RECOMMENDED.lowCost.minCount - lowCostCount}+ карт стоимостью 0-2`,
    });
  }
  if (highCostCount > 8) {
    warnings.push({
      type: "curve_heavy",
      message: "Слишком много дорогих карт",
      suggestion: "Замени часть 5-6 карт на карты стоимостью 2-3",
    });
  }

  // Нет защиты
  const hasProtection = allCards.some(c =>
    c.effect.includes("block") || c.effect.includes("heal")
  );
  if (!hasProtection) {
    warnings.push({
      type: "no_protection",
      message: "Нет защитных карт",
      suggestion: "Добавь хотя бы одну карту с блоком или лечением",
    });
  }

  // Нет финишера
  const hasFinisher = allCards.some(c =>
    c.type === "ultimate" || c.rarity === "legendary"
  );
  if (!hasFinisher) {
    warnings.push({
      type: "no_finisher",
      message: "Нет легендарных карт",
      suggestion: "Добавь хотя бы одну legendary-карту в качестве финишера",
    });
  }

  return {
    isValid: errors.length === 0,
    totalCards,
    errors,
    warnings,
  };
}
```

### 1.3 Система deck codes (как MTG Arena)

```typescript
// lib/game/deckCode.ts
// Формат: BASE64URL-кодировка JSON с версией
// Пример: WO1_donald-rumpf_dr-wall:2,dr-tweet:3,vp-bear:1,...

export function encodeDeck(deck: Deck): string {
  const payload = {
    v: 1,                          // версия формата
    c: deck.characterId,           // персонаж
    n: deck.name,                  // название
    cards: deck.entries.map(e => `${e.card.id}:${e.count}`).join(","),
  };
  return "WO1_" + btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function decodeDeck(code: string): Omit<Deck, "id" | "userId"> | null {
  try {
    if (!code.startsWith("WO1_")) return null;
    const b64 = code.slice(4)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload = JSON.parse(atob(b64));

    const entries: DeckEntry[] = payload.cards
      .split(",")
      .map((part: string) => {
        const [cardId, countStr] = part.split(":");
        const card = findCardById(cardId);
        if (!card) return null;
        return { card, count: parseInt(countStr, 10) };
      })
      .filter(Boolean);

    return {
      name: payload.n,
      characterId: payload.c,
      entries,
    };
  } catch {
    return null;
  }
}
```

---

## ЧАСТЬ 2: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА v4

### 2.1 Структура агентов

```
┌──────────────────────────────────────────────────────────────────────┐
│                      CURSOR ORCHESTRATOR v4                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ DECK-A   │ DECK-B   │ DECK-C   │ DECK-D   │ DECK-E   │   DECK-F    │
│ Layout & │Collection│ 3D Card  │ Deck List│ Stats &  │ Rules, UX   │
│ Router   │  Grid    │ Preview  │  Panel   │  Curve   │ Deck Codes  │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┤
│                    DECK-CRITIC (жёсткий ревьюер)                    │
│    Эталон: MTG Arena Deckbuilder. Принимает только 9.5+/10.         │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Системный промпт DECK-CRITIC

```
Ты — Lead UX Designer, который проектировал deckbuilder в MTG Arena и
работал старшим продакт-менеджером в Hearthstone.

ЭТАЛОН: Открой MTG Arena Deckbuilder (или скриншоты на YouTube).
Это твой внутренний стандарт — сравнивай с ним буквально.

КРИТЕРИИ (каждый 1-10, принимать только 9.5+):

  1. LAYOUT CLARITY — "За 3 секунды понятно куда кликнуть чтобы
     добавить карту в деку?" Принять только "абсолютно понятно".

  2. CARD DENSITY — "Влезает ли достаточно карт на экран без скролла?"
     MTG Arena показывает 8-12 карт сразу. Принять если >= 8.

  3. COPY COUNT VISIBILITY — "Я вижу сколько копий карты в деке и
     сколько максимум допустимо — БЕЗ ХОРОВЕРА?"
     Например: "2/3" или "●●○" прямо на карточке.

  4. CURVE READABILITY — "Кривая энергии обновляется в реальном
     времени и понятна за 1 взгляд?"
     Принять только если "да, и выглядит красиво".

  5. DECK PROGRESS — "Счётчик [N/30] всегда виден и акцентирован?"
     Это критически важный элемент — размер должен быть >= 28px.

  6. VALIDATION UX — "Ошибки объясняют ПОЧЕМУ и ЧТО сделать?"
     Не "Ошибка", а "Добавь ещё 4 карты — нужно минимум 20".

  7. FILTER SPEED — "Фильтрация происходит мгновенно (<50ms)?"
     Принять только если нет видимого лага.

  8. CARD PREVIEW — "Превью карты достаточно большое чтобы
     прочитать текст эффекта без напряжения?"
     Минимум 280px ширина превью.

  9. SAVE FLOW — "Сохранение колоды — 1 нажатие, без модалок?"
     MTG Arena сохраняет автоматически. Принять если <= 1 клик.

  10. COMPETITIVE FEEL — "Это ощущается как builder в серьёзной TCG
      или как форма на сайте?" Принять только "серьёзная TCG".

ЕСЛИ ЛЮБОЙ < 9.5:
  Точный issue: компонент + prop + что именно не работает.
  REJECT → агент исправляет → повторный ревью.

ПРИНЯТЬ только "APPROVED — Deck Builder готов к продакшену".
```

---

## ЧАСТЬ 3: АРХИТЕКТУРА

### 3.1 Типы и модели

```typescript
// lib/game/deckTypes.ts

export interface DeckEntry {
  card: AbilityCard;
  count: number;    // 1, 2 или 3 (в зависимости от rarity)
}

export interface Deck {
  id: string;
  userId: string;
  name: string;
  characterId: string;
  entries: DeckEntry[];
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeckBuilderState {
  // Выбранный персонаж
  characterId: string | null;

  // Текущая колода (редактируемая)
  currentDeck: {
    id: string | null;      // null = новая колода
    name: string;
    entries: DeckEntry[];
  };

  // UI-состояние
  filters: DeckFilters;
  sortBy: DeckSortOption;
  previewCard: AbilityCard | null;
  activePanel: "collection" | "deckList" | "stats";

  // Список сохранённых колод
  savedDecks: Deck[];
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

export interface DeckFilters {
  search: string;
  rarity: Rarity | "all";
  type: "all" | "active" | "passive" | "ultimate";
  costMin: number;          // 0
  costMax: number;          // 6
  showOnlyInDeck: boolean;
  showOnlyAvailable: boolean; // не в деке / ещё можно добавить
}

export type DeckSortOption =
  | "cost_asc"
  | "cost_desc"
  | "name_asc"
  | "rarity_desc"
  | "in_deck_first";
```

### 3.2 Zustand Store

```typescript
// lib/stores/deckBuilderStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface DeckBuilderStore extends DeckBuilderState {
  // Персонаж
  selectCharacter: (id: string) => void;

  // Управление картами
  addCard: (card: AbilityCard) => { success: boolean; reason?: string };
  removeCard: (cardId: string) => void;
  setCardCount: (cardId: string, count: number) => void;
  clearDeck: () => void;

  // Колоды
  createNewDeck: (name: string) => void;
  loadDeck: (deckId: string) => Promise<void>;
  saveDeck: () => Promise<void>;
  deleteDeck: (deckId: string) => Promise<void>;
  duplicateDeck: (deckId: string) => Promise<void>;
  renameDeck: (deckId: string, name: string) => Promise<void>;

  // Deck code
  exportCode: () => string;
  importCode: (code: string) => { success: boolean; error?: string };

  // Фильтры и сортировка
  setFilter: <K extends keyof DeckFilters>(key: K, value: DeckFilters[K]) => void;
  resetFilters: () => void;
  setSortBy: (sort: DeckSortOption) => void;

  // Preview
  setPreviewCard: (card: AbilityCard | null) => void;

  // Валидация (computed)
  getValidation: () => DeckValidationResult;
  getCardCountInDeck: (cardId: string) => number;
  canAddCard: (card: AbilityCard) => boolean;
}

export const useDeckBuilderStore = create<DeckBuilderStore>()(
  immer((set, get) => ({
    characterId: null,
    currentDeck: { id: null, name: "Новая колода", entries: [] },
    filters: {
      search: "",
      rarity: "all",
      type: "all",
      costMin: 0,
      costMax: 6,
      showOnlyInDeck: false,
      showOnlyAvailable: false,
    },
    sortBy: "cost_asc",
    previewCard: null,
    activePanel: "collection",
    savedDecks: [],
    isLoading: false,
    isSaving: false,
    lastSaved: null,

    selectCharacter: (id) =>
      set(state => {
        state.characterId = id;
        state.currentDeck = { id: null, name: "Новая колода", entries: [] };
      }),

    addCard: (card) => {
      const state = get();
      const currentCount = state.getCardCountInDeck(card.id);
      const maxCopies = DECK_RULES.MAX_COPIES[card.rarity];
      const totalCards = state.currentDeck.entries
        .reduce((s, e) => s + e.count, 0);

      if (totalCards >= DECK_RULES.MAX_CARDS) {
        return { success: false, reason: `Максимум ${DECK_RULES.MAX_CARDS} карт в колоде` };
      }
      if (currentCount >= maxCopies) {
        return { success: false, reason: `Максимум ${maxCopies} копи${maxCopies === 1 ? "я" : "и"} "${card.name}"` };
      }

      set(state => {
        const existing = state.currentDeck.entries.find(e => e.card.id === card.id);
        if (existing) {
          existing.count++;
        } else {
          state.currentDeck.entries.push({ card, count: 1 });
        }
      });
      return { success: true };
    },

    removeCard: (cardId) =>
      set(state => {
        const idx = state.currentDeck.entries.findIndex(e => e.card.id === cardId);
        if (idx === -1) return;
        if (state.currentDeck.entries[idx].count > 1) {
          state.currentDeck.entries[idx].count--;
        } else {
          state.currentDeck.entries.splice(idx, 1);
        }
      }),

    getCardCountInDeck: (cardId) => {
      const entry = get().currentDeck.entries.find(e => e.card.id === cardId);
      return entry?.count ?? 0;
    },

    canAddCard: (card) => {
      const state = get();
      const count = state.getCardCountInDeck(card.id);
      const total = state.currentDeck.entries.reduce((s, e) => s + e.count, 0);
      return count < DECK_RULES.MAX_COPIES[card.rarity] && total < DECK_RULES.MAX_CARDS;
    },

    getValidation: () => {
      const { currentDeck, characterId } = get();
      return validateDeck(currentDeck.entries, characterId ?? "");
    },

    exportCode: () => encodeDeck({
      ...get().currentDeck,
      id: get().currentDeck.id ?? "draft",
      userId: "current",
      isValid: get().getValidation().isValid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),

    importCode: (code) => {
      const decoded = decodeDeck(code);
      if (!decoded) return { success: false, error: "Неверный код колоды" };
      set(state => {
        state.characterId = decoded.characterId;
        state.currentDeck = {
          id: null,
          name: decoded.name,
          entries: decoded.entries,
        };
      });
      return { success: true };
    },

    setFilter: (key, value) =>
      set(state => { state.filters[key] = value as never; }),

    resetFilters: () =>
      set(state => {
        state.filters = {
          search: "",
          rarity: "all",
          type: "all",
          costMin: 0,
          costMax: 6,
          showOnlyInDeck: false,
          showOnlyAvailable: false,
        };
      }),

    setSortBy: (sort) => set(state => { state.sortBy = sort; }),
    setPreviewCard: (card) => set(state => { state.previewCard = card; }),

    saveDeck: async () => {
      set(state => { state.isSaving = true; });
      const { currentDeck, characterId } = get();
      try {
        const res = await fetch(
          currentDeck.id ? `/api/decks/${currentDeck.id}` : "/api/decks",
          {
            method: currentDeck.id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: currentDeck.name,
              characterId,
              cardIds: currentDeck.entries.flatMap(e =>
                Array(e.count).fill(e.card.id)
              ),
            }),
          }
        );
        if (!res.ok) throw new Error("Save failed");
        const { deck } = await res.json();
        set(state => {
          state.currentDeck.id = deck.deckId;
          state.lastSaved = new Date();
          state.isSaving = false;
        });
      } catch {
        set(state => { state.isSaving = false; });
      }
    },

    loadDeck: async (deckId) => {
      set(state => { state.isLoading = true; });
      try {
        const res = await fetch(`/api/decks/${deckId}`);
        const { deck } = await res.json();
        const entries = reconstructEntries(deck.cardIds);
        set(state => {
          state.characterId = deck.characterId;
          state.currentDeck = { id: deck.deckId, name: deck.name, entries };
          state.isLoading = false;
        });
      } catch {
        set(state => { state.isLoading = false; });
      }
    },

    createNewDeck: (name) =>
      set(state => {
        state.currentDeck = { id: null, name, entries: [] };
      }),

    clearDeck: () =>
      set(state => { state.currentDeck.entries = []; }),

    deleteDeck: async (deckId) => {
      await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      set(state => {
        state.savedDecks = state.savedDecks.filter(d => d.id !== deckId);
        if (state.currentDeck.id === deckId) {
          state.currentDeck = { id: null, name: "Новая колода", entries: [] };
        }
      });
    },

    duplicateDeck: async (deckId) => {
      const original = get().savedDecks.find(d => d.id === deckId);
      if (!original) return;
      set(state => {
        state.currentDeck = {
          id: null,
          name: `${original.name} (копия)`,
          entries: original.entries,
        };
      });
      await get().saveDeck();
    },

    renameDeck: async (deckId, name) => {
      await fetch(`/api/decks/${deckId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      set(state => {
        const deck = state.savedDecks.find(d => d.id === deckId);
        if (deck) deck.name = name;
        if (state.currentDeck.id === deckId) state.currentDeck.name = name;
      });
    },
  }))
);
```

---

## ЧАСТЬ 4: LAYOUT — ТРЁХПАНЕЛЬНАЯ СИСТЕМА

### 4.1 Компоновка страницы (DECK-A)

```
┌─────────────────────────────────────────────────────────────────────┐
│ HEADER: [← Назад]  [👤 Персонаж: Вл. Пу]  [Колода: "Зима придёт"] │
│         [+Новая]  [🗂 Мои колоды ▼]  [📋 Код] [💾 Сохранить]      │
├───────────────────────┬───────────────────┬─────────────────────────┤
│                       │                   │                         │
│   COLLECTION PANEL    │   DECK LIST       │   STATS & CURVE         │
│   (коллекция карт)    │   (текущая дека)  │   (аналитика)           │
│                       │                   │                         │
│   [🔍 Поиск...]       │   [18/30] ███░░   │   Кривая энергии:       │
│   [Редкость ▼]        │   ────────────    │   ██                    │
│   [Тип ▼] [Цена ▼]    │   ×3 Гибр. удар  │   ████                  │
│                       │   ×2 Газ. рычаг  │   ██████                │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ │   ×1 Мед. хватка │   ████                  │
│   │  │ │  │ │  │ │  │ │   ×1 ФСБ-сигнал  │   ██                   │
│   └──┘ └──┘ └──┘ └──┘ │   ×1 Суверенная │   ██                   │
│   ┌──┐ ┌──┐ ┌──┐ ┌──┐ │   ─────────────   │   0  1  2  3  4  5  6  │
│   │  │ │  │ │  │ │  │ │   [Очистить деку] │                         │
│   └──┘ └──┘ └──┘ └──┘ │                   │   Редкость:            │
│   ┌──┐ ┌──┐ ...        │   [▶ В БОЙ!]     │   C:8  R:6  E:3  L:1   │
│                         │                   │                        │
│   3D-превью при hover → │                   │   ⚠ Мало дешёвых карт  │
└─────────────────────────┴───────────────────┴────────────────────────┘
         52%                     24%                   24%
```

### 4.2 Компонент DeckBuilderPage

```typescript
// app/decks/[id]/page.tsx  (или /decks/new)
// components/deck-builder/DeckBuilderPage.tsx

"use client";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CollectionPanel }  from "./CollectionPanel";
import { DeckListPanel }    from "./DeckListPanel";
import { StatsPanel }       from "./StatsPanel";
import { DeckBuilderHeader } from "./DeckBuilderHeader";
import { CardPreviewPortal } from "./CardPreviewPortal";
import { DeckCodeModal }    from "./DeckCodeModal";
import { MyDecksDropdown }  from "./MyDecksDropdown";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";
import { useKeyboardShortcuts } from "@/hooks/useDeckBuilderShortcuts";

export default function DeckBuilderPage({ params }: { params: { id?: string } }) {
  const store = useDeckBuilderStore();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showMyDecks, setShowMyDecks] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Загрузить существующую колоду
  useEffect(() => {
    if (params.id && params.id !== "new") {
      store.loadDeck(params.id);
    }
  }, [params.id]);

  // Автосохранение при изменении (как MTG Arena)
  useEffect(() => {
    if (!store.currentDeck.id) return;
    const t = setTimeout(() => store.saveDeck(), 1500);
    return () => clearTimeout(t);
  }, [store.currentDeck.entries]);

  // Горячие клавиши
  useKeyboardShortcuts({
    "ctrl+s": () => store.saveDeck(),
    "ctrl+z": () => { /* undo */ },
    "Escape": () => store.setPreviewCard(null),
  });

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: COLORS.bg_void,
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <DeckBuilderHeader
        onShowCode={() => setShowCodeModal(true)}
        onShowMyDecks={() => setShowMyDecks(s => !s)}
        showMyDecks={showMyDecks}
      />

      {/* MAIN 3-PANEL */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 280px 280px",
        gap: 0,
        overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <CollectionPanel />
        <DeckListPanel />
        <StatsPanel />
      </div>

      {/* ПОРТАЛ ПРЕВЬЮ карты (3D) */}
      <CardPreviewPortal />

      {/* МОДАЛКА: Код колоды */}
      <AnimatePresence>
        {showCodeModal && (
          <DeckCodeModal onClose={() => setShowCodeModal(false)} />
        )}
      </AnimatePresence>

      {/* ДРОПДАУН: Мои колоды */}
      <AnimatePresence>
        {showMyDecks && (
          <MyDecksDropdown onClose={() => setShowMyDecks(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 4.3 DeckBuilderHeader

```typescript
// components/deck-builder/DeckBuilderHeader.tsx

export function DeckBuilderHeader({ onShowCode, onShowMyDecks, showMyDecks }) {
  const store = useDeckBuilderStore();
  const validation = store.getValidation();
  const [isRenamingDeck, setIsRenamingDeck] = useState(false);
  const [draftName, setDraftName] = useState(store.currentDeck.name);

  return (
    <header style={{
      height: 56,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "0 16px",
      background: COLORS.bg_surface,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
    }}>
      {/* Назад */}
      <button
        onClick={() => router.push("/")}
        style={{ color: COLORS.text_secondary, display: "flex", alignItems: "center", gap: 6 }}
      >
        <ChevronLeft size={18} /> Назад
      </button>

      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

      {/* Персонаж */}
      <CharacterBadge characterId={store.characterId} />

      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

      {/* Название колоды (inline edit) */}
      {isRenamingDeck ? (
        <input
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={() => {
            store.renameDeck(store.currentDeck.id!, draftName);
            setIsRenamingDeck(false);
          }}
          onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
          autoFocus
          style={{
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${COLORS.gold}`,
            borderRadius: 6,
            padding: "4px 10px",
            font: `600 15px 'Rajdhani'`,
            color: COLORS.text_primary,
            width: 200,
          }}
        />
      ) : (
        <button
          onClick={() => setIsRenamingDeck(true)}
          style={{
            font: `600 15px 'Rajdhani'`,
            color: COLORS.text_primary,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {store.currentDeck.name}
          <Pencil size={13} color={COLORS.text_secondary} />
        </button>
      )}

      {/* Кнопка "Мои колоды" */}
      <button
        onClick={onShowMyDecks}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 12px",
          background: showMyDecks ? "rgba(255,255,255,0.1)" : "transparent",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 6,
          font: `500 13px 'Rajdhani'`,
          color: COLORS.text_secondary,
        }}
      >
        <Layers size={15} /> Мои колоды ({store.savedDecks.length})
      </button>

      <div style={{ flex: 1 }} />

      {/* Deck Code */}
      <button onClick={onShowCode} style={{ /* tertiary button */ }}>
        <Code2 size={15} /> Код
      </button>

      {/* Сохранить */}
      <motion.button
        onClick={() => store.saveDeck()}
        disabled={store.isSaving}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: "6px 16px",
          background: store.isSaving ? COLORS.bg_surface : COLORS.gold,
          color: store.isSaving ? COLORS.text_secondary : "#1A0000",
          borderRadius: 8,
          font: `700 14px 'Rajdhani'`,
          display: "flex", alignItems: "center", gap: 6,
          border: "none", cursor: "pointer",
        }}
      >
        {store.isSaving ? (
          <><Loader2 size={15} className="animate-spin" /> Сохраняем</>
        ) : store.lastSaved ? (
          <><Check size={15} /> Сохранено</>
        ) : (
          <><Save size={15} /> Сохранить</>
        )}
      </motion.button>
    </header>
  );
}
```

---

## ЧАСТЬ 5: КОЛЛЕКЦИЯ КАРТ (DECK-B)

### 5.1 CollectionPanel

```typescript
// components/deck-builder/CollectionPanel.tsx
// Левая панель: фильтры + сетка карт

export function CollectionPanel() {
  const store = useDeckBuilderStore();
  const [inputSearch, setInputSearch] = useState("");
  const debouncedSearch = useDebounce(inputSearch, 80); // <50ms lag

  useEffect(() => {
    store.setFilter("search", debouncedSearch);
  }, [debouncedSearch]);

  const allCards = getCharacterCards(store.characterId);
  const filteredCards = useMemo(() =>
    filterAndSortCards(allCards, store.filters, store.sortBy, store.currentDeck.entries),
    [allCards, store.filters, store.sortBy, store.currentDeck.entries]
  );

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* ФИЛЬТР-БАР */}
      <FilterBar
        filters={store.filters}
        sortBy={store.sortBy}
        onSearchChange={setInputSearch}
        onFilterChange={store.setFilter}
        onSortChange={store.setSortBy}
        onReset={store.resetFilters}
        totalShown={filteredCards.length}
        totalAvailable={allCards.length}
      />

      {/* СЕТКА КАРТ */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 16px",
        // Кастомный scrollbar
        scrollbarWidth: "thin",
        scrollbarColor: `${COLORS.gold}44 transparent`,
      }}>
        {store.characterId === null ? (
          <CharacterSelectPrompt />
        ) : filteredCards.length === 0 ? (
          <EmptyFilterResult onReset={store.resetFilters} />
        ) : (
          <CollectionGrid cards={filteredCards} />
        )}
      </div>
    </div>
  );
}
```

### 5.2 FilterBar — полоса фильтров

```typescript
// components/deck-builder/FilterBar.tsx

export function FilterBar({ filters, sortBy, onSearchChange, onFilterChange, onSortChange, onReset, totalShown, totalAvailable }) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.rarity !== "all" ||
    filters.type !== "all" ||
    filters.costMin !== 0 ||
    filters.costMax !== 6 ||
    filters.showOnlyInDeck ||
    filters.showOnlyAvailable;

  return (
    <div style={{
      padding: "10px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      background: COLORS.bg_surface,
    }}>
      {/* Строка 1: Поиск */}
      <div style={{ position: "relative" }}>
        <Search size={15} style={{
          position: "absolute", left: 10, top: "50%",
          transform: "translateY(-50%)",
          color: COLORS.text_secondary,
        }} />
        <input
          placeholder="Найти карту..."
          onChange={e => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            paddingLeft: 32, paddingRight: 10,
            height: 34,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            font: `400 14px 'Rajdhani'`,
            color: COLORS.text_primary,
          }}
        />
      </div>

      {/* Строка 2: Быстрые фильтры */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {/* Редкость */}
        {(["all", "common", "rare", "epic", "legendary"] as const).map(r => (
          <RarityPill
            key={r}
            rarity={r}
            active={filters.rarity === r}
            onClick={() => onFilterChange("rarity", r)}
          />
        ))}
      </div>

      {/* Строка 3: Тип + Кривая стоимости */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Тип карты */}
        <select
          value={filters.type}
          onChange={e => onFilterChange("type", e.target.value as any)}
          style={{ /* select styles */ }}
        >
          <option value="all">Все типы</option>
          <option value="active">Активные</option>
          <option value="passive">Пассивные</option>
          <option value="ultimate">Ультимейты</option>
        </select>

        {/* Стоимость: слайдер диапазона */}
        <CostRangeSlider
          min={filters.costMin}
          max={filters.costMax}
          onChange={(min, max) => {
            onFilterChange("costMin", min);
            onFilterChange("costMax", max);
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Счётчик + сброс */}
        <span style={{ font: `400 12px 'Rajdhani'`, color: COLORS.text_secondary }}>
          {totalShown}/{totalAvailable}
        </span>
        {hasActiveFilters && (
          <button onClick={onReset} style={{ color: COLORS.text_secondary, display: "flex", alignItems: "center", gap: 4 }}>
            <X size={13} /> Сбросить
          </button>
        )}
      </div>

      {/* Строка 4: Тогглы */}
      <div style={{ display: "flex", gap: 12 }}>
        <Toggle
          label="Только в деке"
          checked={filters.showOnlyInDeck}
          onChange={v => onFilterChange("showOnlyInDeck", v)}
        />
        <Toggle
          label="Можно добавить"
          checked={filters.showOnlyAvailable}
          onChange={v => onFilterChange("showOnlyAvailable", v)}
        />
        <div style={{ flex: 1 }} />
        <SortDropdown value={sortBy} onChange={onSortChange} />
      </div>
    </div>
  );
}
```

### 5.3 CollectionGrid — сетка карточек

```typescript
// components/deck-builder/CollectionGrid.tsx
// Карточки в коллекции — компактнее, чем игровые карты

export function CollectionGrid({ cards }: { cards: FilteredCard[] }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
      gap: 10,
    }}>
      {cards.map(({ card, countInDeck, maxCopies, canAdd }) => (
        <CollectionCardItem
          key={card.id}
          card={card}
          countInDeck={countInDeck}
          maxCopies={maxCopies}
          canAdd={canAdd}
        />
      ))}
    </div>
  );
}

export function CollectionCardItem({
  card, countInDeck, maxCopies, canAdd
}: {
  card: AbilityCard;
  countInDeck: number;
  maxCopies: number;
  canAdd: boolean;
}) {
  const store = useDeckBuilderStore();
  const [addResult, setAddResult] = useState<string | null>(null);
  const rarity = RARITY_CONFIG[card.rarity];

  const handleAdd = () => {
    const result = store.addCard(card);
    if (!result.success && result.reason) {
      setAddResult(result.reason);
      setTimeout(() => setAddResult(null), 1800);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      whileHover={{ scale: canAdd ? 1.04 : 1, zIndex: 10 }}
      onMouseEnter={() => store.setPreviewCard(card)}
      onMouseLeave={() => store.setPreviewCard(null)}
      onClick={canAdd ? handleAdd : undefined}
      style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        background: COLORS.bg_card,
        border: countInDeck > 0
          ? `1.5px solid ${rarity.color}`
          : "1px solid rgba(255,255,255,0.08)",
        cursor: canAdd ? "pointer" : "not-allowed",
        opacity: canAdd ? 1 : 0.5,
        boxShadow: countInDeck > 0 ? `0 0 10px ${rarity.color}44` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Арт карты */}
      <div style={{ height: 80, overflow: "hidden", position: "relative" }}>
        <img
          src={`/assets/cards/${card.id}.png`}
          alt={card.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {/* Тёмный overlay если нельзя добавить */}
        {!canAdd && countInDeck === maxCopies && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ font: `700 11px 'Rajdhani'`, color: "#FFD700" }}>
              МАХ
            </span>
          </div>
        )}
        {/* Стоимость (верхний левый угол) */}
        <div style={{
          position: "absolute", top: 5, left: 5,
          width: 22, height: 22, borderRadius: "50%",
          background: "radial-gradient(circle, #FFD700, #B8860B)",
          display: "flex", alignItems: "center", justifyContent: "center",
          font: `700 12px 'Rajdhani'`,
          color: "#1A0000",
          border: "1.5px solid rgba(255,255,255,0.3)",
        }}>
          {card.cost}
        </div>
      </div>

      {/* Нижняя часть */}
      <div style={{ padding: "5px 7px 6px" }}>
        <div style={{
          font: `600 11px 'Cinzel Decorative'`,
          color: COLORS.text_primary,
          lineHeight: 1.2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 10,
        }}>
          {card.name}
        </div>

        {/* Счётчик копий: кружки ●●○ */}
        <div style={{
          marginTop: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <CopyDots current={countInDeck} max={maxCopies} color={rarity.color} />
          <span style={{
            font: `500 11px 'Rajdhani'`,
            color: rarity.color,
            letterSpacing: "0.5px",
          }}>
            {card.rarity.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Полоска редкости */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 2,
        background: rarity.color,
        opacity: countInDeck > 0 ? 1 : 0.4,
      }} />

      {/* Toast при ошибке добавления */}
      <AnimatePresence>
        {addResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(200,0,0,0.85)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 8, textAlign: "center",
              font: `600 10px 'Rajdhani'`, color: "#fff",
              borderRadius: 10,
              zIndex: 20,
            }}
          >
            {addResult}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Компонент кружков ●●○
function CopyDots({ current, max, color }: { current: number; max: number; color: string }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            background: i < current ? color : "rgba(255,255,255,0.15)",
            scale: i < current && i === current - 1 ? [1, 1.4, 1] : 1,
          }}
          transition={{ duration: 0.25 }}
          style={{
            width: 7, height: 7,
            borderRadius: "50%",
            boxShadow: i < current ? `0 0 4px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}
```

---

## ЧАСТЬ 6: CARD PREVIEW — 3D-ПРЕВЬЮ (DECK-C)

### 6.1 CardPreviewPortal — большой превью при наведении

```typescript
// components/deck-builder/CardPreviewPortal.tsx
// Рендерится в portal, всегда поверх всего
// Позиция: рядом с курсором, но в пределах экрана

import { createPortal } from "react-dom";
import { Canvas } from "@react-three/fiber";
import { useSpring, animated } from "@react-spring/web";

export function CardPreviewPortal() {
  const previewCard = useDeckBuilderStore(s => s.previewCard);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Позиция превью: правее от курсора, но не за край экрана
  const previewWidth = 280;
  const previewHeight = 420;
  const margin = 16;
  const x = mousePos.x + 20 + previewWidth > window.innerWidth
    ? mousePos.x - previewWidth - 20
    : mousePos.x + 20;
  const y = Math.min(
    mousePos.y - 60,
    window.innerHeight - previewHeight - margin
  );

  const springProps = useSpring({
    opacity: previewCard ? 1 : 0,
    transform: previewCard ? "scale(1)" : "scale(0.92)",
    config: { tension: 400, friction: 22 },
  });

  if (typeof window === "undefined") return null;

  return createPortal(
    <animated.div
      style={{
        ...springProps,
        position: "fixed",
        left: x,
        top: y,
        width: previewWidth,
        zIndex: 99999,
        pointerEvents: "none",
        transformOrigin: "top left",
      }}
    >
      {previewCard && <CardPreview3D card={previewCard} />}
    </animated.div>,
    document.body
  );
}

// 3D-вращение карты при превью (React Three Fiber)
function CardPreview3D({ card }: { card: AbilityCard }) {
  const rarity = RARITY_CONFIG[card.rarity];

  return (
    <div style={{
      width: 280, height: 420,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: `0 24px 60px rgba(0,0,0,0.8), 0 0 30px ${rarity.color}44`,
      border: `2px solid ${rarity.color}`,
      background: COLORS.bg_card,
    }}>
      {/* 3D-вращение через Canvas (лёгкое покачивание) */}
      <div style={{ height: 200, position: "relative" }}>
        <Canvas camera={{ position: [0, 0, 2.5] }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[2, 2, 2]} intensity={1.5} color={rarity.color} />
          <RotatingCardArt cardId={card.id} rarityColor={rarity.color} />
        </Canvas>
        {/* Стоимость поверх canvas */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          width: 40, height: 40, borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)",
          display: "flex", alignItems: "center", justifyContent: "center",
          font: `900 22px 'Rajdhani'`, color: "#1A0000",
          boxShadow: "0 0 16px rgba(255,215,0,0.7)",
          border: "2px solid rgba(255,255,255,0.3)",
        }}>
          {card.cost}
        </div>
      </div>

      {/* Информация */}
      <div style={{ padding: "12px 16px 14px" }}>
        {/* Разделитель с цветом редкости */}
        <div style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
          marginBottom: 10,
        }} />

        <div style={{
          font: `700 16px 'Cinzel Decorative'`,
          color: COLORS.text_primary,
          textShadow: `0 0 10px ${rarity.color}66`,
          marginBottom: 8,
        }}>
          {card.name}
        </div>

        {/* Теги: тип + редкость */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <Tag color={rarity.color} label={rarityLabel[card.rarity]} />
          <Tag color={typeColor[card.type]} label={typeLabel[card.type]} />
        </div>

        {/* Описание */}
        <div style={{
          font: `400 13px 'Crimson Text'`,
          color: COLORS.text_secondary,
          lineHeight: 1.55,
        }}>
          {card.description}
        </div>

        {/* Скорость */}
        <div style={{
          marginTop: 10,
          display: "flex", alignItems: "center", gap: 6,
          font: `600 12px 'Rajdhani'`,
          color: COLORS.text_secondary,
        }}>
          <Zap size={13} color="#FFD700" />
          <span>Скорость: <span style={{ color: "#FFD700" }}>{card.speed}</span></span>
        </div>

        {/* Флейвор-текст */}
        {card.flavorText && (
          <div style={{
            marginTop: 10,
            font: `italic 400 12px 'Crimson Text'`,
            color: COLORS.text_secondary,
            opacity: 0.7,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 8,
          }}>
            "{card.flavorText}"
          </div>
        )}
      </div>
    </div>
  );
}

// Карта-арт вращается на 3D-плоскости при превью
function RotatingCardArt({ cardId, rarityColor }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(`/assets/cards/${cardId}.png`);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Лёгкое 3D-покачивание (не полный поворот — карта читается)
    meshRef.current.rotation.y = Math.sin(t * 0.7) * 0.25;
    meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.08;
  });

  return (
    <>
      <mesh ref={meshRef}>
        <planeGeometry args={[2.4, 1.6]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      {/* Glow за картой */}
      <pointLight color={rarityColor} intensity={2} distance={3} />
    </>
  );
}
```

---

## ЧАСТЬ 7: DECK LIST PANEL (DECK-D)

### 7.1 DeckListPanel — список карт в деке

```typescript
// components/deck-builder/DeckListPanel.tsx
// Средняя панель: список карт с счётчиком прогресса и быстрыми действиями

export function DeckListPanel() {
  const store = useDeckBuilderStore();
  const validation = store.getValidation();
  const total = validation.totalCards;
  const progressPct = (total / DECK_RULES.MAX_CARDS) * 100;

  // Группировка по стоимости для удобства чтения
  const groupedByCost = useMemo(() =>
    groupDeckEntriesByCost(store.currentDeck.entries),
    [store.currentDeck.entries]
  );

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      background: COLORS.bg_surface,
    }}>
      {/* HEADER: Прогресс колоды */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Счётчик [18/30] — всегда жирный и крупный */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ font: `700 22px 'Rajdhani'`, color: COLORS.text_primary }}>
            <span style={{ color: total >= DECK_RULES.MIN_CARDS ? COLORS.gold : COLORS.red_hot }}>
              {total}
            </span>
            <span style={{ color: COLORS.text_secondary, font: `400 16px 'Rajdhani'` }}>
              /{DECK_RULES.MAX_CARDS}
            </span>
          </span>
          <span style={{
            font: `500 12px 'Rajdhani'`,
            color: validation.isValid ? "#44FF88" : COLORS.text_secondary,
          }}>
            {validation.isValid ? "✓ Колода готова" : `Нужно ещё ${DECK_RULES.MIN_CARDS - total}`}
          </span>
        </div>

        {/* Полоса прогресса */}
        <div style={{
          height: 6, borderRadius: 3,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}>
          <motion.div
            animate={{ width: `${Math.min(progressPct, 100)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{
              height: "100%",
              background: total >= DECK_RULES.MAX_CARDS
                ? COLORS.red_hot
                : total >= DECK_RULES.MIN_CARDS
                ? `linear-gradient(90deg, #44BB88, ${COLORS.gold})`
                : `linear-gradient(90deg, ${COLORS.gold}88, ${COLORS.gold})`,
              borderRadius: 3,
            }}
          />
        </div>

        {/* Ошибки валидации */}
        <AnimatePresence>
          {validation.errors.map((err, i) => (
            <motion.div
              key={`${err.type}-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginTop: 6,
                padding: "4px 8px",
                background: "rgba(200,0,0,0.15)",
                border: "1px solid rgba(200,0,0,0.4)",
                borderRadius: 6,
                font: `500 12px 'Rajdhani'`,
                color: "#FF8888",
                display: "flex", alignItems: "flex-start", gap: 6,
              }}
            >
              <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              {err.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* СПИСОК КАРТ */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {store.currentDeck.entries.length === 0 ? (
          <EmptyDeckState />
        ) : (
          <AnimatePresence initial={false}>
            {groupedByCost.map(group => (
              <CostGroup key={group.cost} group={group} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* FOOTER: Действия */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {/* Предупреждения (warnings) */}
        {validation.warnings.slice(0, 2).map((warn, i) => (
          <div key={i} style={{
            font: `400 11px 'Rajdhani'`,
            color: "#FFB74D",
            display: "flex", gap: 5, alignItems: "flex-start",
          }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{warn.suggestion}</span>
          </div>
        ))}

        {/* Кнопка очистки */}
        <button
          onClick={() => store.clearDeck()}
          disabled={store.currentDeck.entries.length === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 0",
            color: COLORS.text_secondary,
            font: `500 12px 'Rajdhani'`,
          }}
        >
          <Trash2 size={13} /> Очистить деку
        </button>

        {/* В БОЙ — активна только при валидной деке */}
        <motion.button
          disabled={!validation.isValid}
          whileHover={validation.isValid ? { scale: 1.02 } : {}}
          whileTap={validation.isValid ? { scale: 0.98 } : {}}
          onClick={() => router.push(`/game/ai?deckId=${store.currentDeck.id}`)}
          style={{
            height: 42,
            background: validation.isValid
              ? `linear-gradient(135deg, ${COLORS.gold}, #CC8800)`
              : "rgba(255,255,255,0.05)",
            color: validation.isValid ? "#1A0000" : COLORS.text_secondary,
            borderRadius: 10,
            font: `700 15px 'Rajdhani'`,
            letterSpacing: "1px",
            cursor: validation.isValid ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            border: validation.isValid
              ? `1px solid ${COLORS.gold}`
              : "1px solid rgba(255,255,255,0.08)",
            boxShadow: validation.isValid ? `0 0 20px ${COLORS.gold}44` : "none",
          }}
        >
          <Swords size={16} /> {validation.isValid ? "В БОЙ!" : "Заполни колоду"}
        </motion.button>
      </div>
    </div>
  );
}

// Строка карты в списке деки
function DeckCardRow({ entry }: { entry: DeckEntry }) {
  const store = useDeckBuilderStore();
  const { card, count } = entry;
  const rarity = RARITY_CONFIG[card.rarity];
  const maxCopies = DECK_RULES.MAX_COPIES[card.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      onMouseEnter={() => store.setPreviewCard(card)}
      onMouseLeave={() => store.setPreviewCard(null)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 14px",
        gap: 8,
        borderLeft: `2px solid ${rarity.color}`,
        marginLeft: 0,
        marginBottom: 1,
        background: "transparent",
        transition: "background 0.15s",
      }}
      whileHover={{ background: "rgba(255,255,255,0.04)" }}
    >
      {/* Стоимость */}
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "radial-gradient(circle, #FFD700, #886600)",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: `700 12px 'Rajdhani'`, color: "#1A0000",
        flexShrink: 0,
      }}>
        {card.cost}
      </div>

      {/* Название */}
      <span style={{
        flex: 1,
        font: `500 13px 'Rajdhani'`,
        color: COLORS.text_primary,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {card.name}
      </span>

      {/* Кнопки ±count */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        <IconButton
          icon={<Minus size={11} />}
          onClick={() => store.removeCard(card.id)}
        />
        <span style={{
          font: `700 13px 'Rajdhani'`,
          color: count >= maxCopies ? COLORS.gold : COLORS.text_primary,
          width: 24, textAlign: "center",
        }}>
          ×{count}
        </span>
        <IconButton
          icon={<Plus size={11} />}
          onClick={() => store.addCard(card)}
          disabled={count >= maxCopies}
        />
      </div>
    </motion.div>
  );
}
```

---

## ЧАСТЬ 8: STATS & CURVE PANEL (DECK-E)

### 8.1 StatsPanel — аналитика колоды

```typescript
// components/deck-builder/StatsPanel.tsx
// Правая панель: кривая энергии + статистика + подсказки

export function StatsPanel() {
  const store = useDeckBuilderStore();
  const validation = store.getValidation();
  const entries = store.currentDeck.entries;

  const allCards = entries.flatMap(e => Array(e.count).fill(e.card));

  // Кривая энергии: count по каждому cost 0..6
  const curveCounts = useMemo(() => {
    const counts = Array(7).fill(0);
    allCards.forEach(c => counts[c.cost]++);
    return counts;
  }, [allCards]);

  const maxCurve = Math.max(...curveCounts, 1);

  // Распределение редкости
  const rarityCounts = useMemo(() => {
    const r = { common: 0, rare: 0, epic: 0, legendary: 0 };
    allCards.forEach(c => r[c.rarity]++);
    return r;
  }, [allCards]);

  // Среднее значение стоимости
  const avgCost = allCards.length > 0
    ? (allCards.reduce((s, c) => s + c.cost, 0) / allCards.length).toFixed(1)
    : "—";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
      padding: "14px 16px",
      gap: 20,
    }}>
      {/* 1. КРИВАЯ ЭНЕРГИИ */}
      <div>
        <SectionLabel>Кривая энергии</SectionLabel>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 5,
          height: 100,
          marginTop: 10,
        }}>
          {curveCounts.map((count, cost) => (
            <div
              key={cost}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              {/* Столбик */}
              <motion.div
                animate={{ height: count > 0 ? `${(count / maxCurve) * 80}px` : 4 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{
                  width: "100%",
                  borderRadius: "3px 3px 0 0",
                  background: cost <= 2
                    ? "linear-gradient(0deg, #44BB88, #66DDAA)"
                    : cost <= 4
                    ? `linear-gradient(0deg, ${COLORS.gold}AA, ${COLORS.gold})`
                    : "linear-gradient(0deg, #CC4400, #FF6622)",
                  minHeight: 4,
                  position: "relative",
                }}
              >
                {/* Число карт внутри столбика (если > 0) */}
                {count > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -18,
                    left: 0, right: 0,
                    textAlign: "center",
                    font: `700 11px 'Rajdhani'`,
                    color: COLORS.text_primary,
                  }}>
                    {count}
                  </span>
                )}
              </motion.div>

              {/* Метка стоимости */}
              <span style={{
                font: `500 11px 'Rajdhani'`,
                color: COLORS.text_secondary,
              }}>
                {cost}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          textAlign: "center",
          font: `400 11px 'Rajdhani'`,
          color: COLORS.text_secondary,
          marginTop: 4,
        }}>
          Средняя стоимость: <span style={{ color: COLORS.gold }}>{avgCost}</span>
        </div>
      </div>

      {/* 2. РАСПРЕДЕЛЕНИЕ РЕДКОСТИ */}
      <div>
        <SectionLabel>Редкость</SectionLabel>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {(["legendary", "epic", "rare", "common"] as const).map(rarity => {
            const count = rarityCounts[rarity];
            const max = count > 0 ? Math.max(...Object.values(rarityCounts)) : 1;
            return (
              <div key={rarity} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 60,
                  font: `500 11px 'Rajdhani'`,
                  color: RARITY_CONFIG[rarity].color,
                  textTransform: "capitalize",
                }}>
                  {rarityLabel[rarity]}
                </span>
                <div style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <motion.div
                    animate={{ width: `${(count / Math.max(max, 1)) * 100}%` }}
                    style={{
                      height: "100%",
                      background: RARITY_CONFIG[rarity].color,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span style={{
                  width: 20, textAlign: "right",
                  font: `600 12px 'Rajdhani'`,
                  color: count > 0 ? COLORS.text_primary : COLORS.text_secondary,
                }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. БЫСТРАЯ СТАТИСТИКА */}
      <div>
        <SectionLabel>Статистика</SectionLabel>
        <div style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}>
          <StatBlock label="Всего карт" value={validation.totalCards} max={DECK_RULES.MAX_CARDS} />
          <StatBlock label="Уникальных" value={entries.length} />
          <StatBlock label="Атакующих" value={allCards.filter(c => c.type === "active").length} />
          <StatBlock label="Защитных" value={allCards.filter(c =>
            c.effect.includes("block") || c.effect.includes("heal")
          ).length} />
        </div>
      </div>

      {/* 4. ПОДСКАЗКИ ИИ */}
      {validation.warnings.length > 0 && (
        <div>
          <SectionLabel>Рекомендации</SectionLabel>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {validation.warnings.map((warn, i) => (
              <div key={i} style={{
                padding: "8px 10px",
                background: "rgba(255,183,77,0.08)",
                border: "1px solid rgba(255,183,77,0.25)",
                borderRadius: 8,
                font: `400 12px 'Rajdhani'`,
                color: "#FFB74D",
                lineHeight: 1.45,
              }}>
                💡 {warn.suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ЧАСТЬ 9: DECK CODES (DECK-F)

### 9.1 DeckCodeModal — импорт/экспорт

```typescript
// components/deck-builder/DeckCodeModal.tsx
// MTG Arena-стиль: textarea с кодом, кнопки Copy/Import

export function DeckCodeModal({ onClose }: { onClose: () => void }) {
  const store = useDeckBuilderStore();
  const [mode, setMode] = useState<"export" | "import">("export");
  const [importInput, setImportInput] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const exportCode = useMemo(() => store.exportCode(), [store.currentDeck]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImport = () => {
    const result = store.importCode(importInput.trim());
    if (result.success) {
      onClose();
    } else {
      setImportError(result.error ?? "Неверный код");
      setTimeout(() => setImportError(null), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 520,
          background: COLORS.bg_surface,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ font: `700 20px 'Cinzel Decorative'`, color: COLORS.text_primary }}>
            Код колоды
          </h2>
          <button onClick={onClose}><X size={20} color={COLORS.text_secondary} /></button>
        </div>

        {/* Табы */}
        <div style={{ display: "flex", marginBottom: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3 }}>
          {["export", "import"].map(m => (
            <button
              key={m}
              onClick={() => setMode(m as any)}
              style={{
                flex: 1, padding: "6px 0",
                background: mode === m ? "rgba(255,255,255,0.1)" : "transparent",
                borderRadius: 6,
                font: `600 13px 'Rajdhani'`,
                color: mode === m ? COLORS.text_primary : COLORS.text_secondary,
                letterSpacing: "0.5px",
              }}
            >
              {m === "export" ? "Экспорт" : "Импорт"}
            </button>
          ))}
        </div>

        {mode === "export" ? (
          <>
            {/* Код для экспорта */}
            <textarea
              readOnly
              value={exportCode}
              style={{
                width: "100%",
                height: 80,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 10,
                font: `400 12px 'JetBrains Mono'`,
                color: COLORS.gold,
                resize: "none",
                wordBreak: "break-all",
              }}
            />
            <p style={{
              font: `400 12px 'Rajdhani'`, color: COLORS.text_secondary,
              marginTop: 8,
            }}>
              Поделись этим кодом с другом — он сможет скопировать твою колоду.
            </p>
            <motion.button
              onClick={handleCopy}
              whileTap={{ scale: 0.97 }}
              style={{
                marginTop: 14, width: "100%", height: 40,
                background: copySuccess ? "#2D7A4A" : COLORS.gold,
                color: "#1A0000", borderRadius: 8,
                font: `700 14px 'Rajdhani'`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {copySuccess ? <><Check size={16} /> Скопировано!</> : <><Copy size={16} /> Скопировать код</>}
            </motion.button>
          </>
        ) : (
          <>
            {/* Поле для импорта */}
            <textarea
              value={importInput}
              onChange={e => setImportInput(e.target.value)}
              placeholder="Вставь код колоды сюда..."
              style={{
                width: "100%", height: 80,
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${importError ? COLORS.red_hot : "rgba(255,255,255,0.1)"}`,
                borderRadius: 8, padding: 10,
                font: `400 12px 'JetBrains Mono'`,
                color: COLORS.text_primary,
                resize: "none",
              }}
            />
            {importError && (
              <p style={{ font: `500 12px 'Rajdhani'`, color: COLORS.red_hot, marginTop: 6 }}>
                {importError}
              </p>
            )}
            <button
              onClick={handleImport}
              disabled={!importInput.trim()}
              style={{
                marginTop: 14, width: "100%", height: 40,
                background: importInput.trim() ? COLORS.gold : "rgba(255,255,255,0.05)",
                color: importInput.trim() ? "#1A0000" : COLORS.text_secondary,
                borderRadius: 8, font: `700 14px 'Rajdhani'`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Download size={16} /> Загрузить колоду
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
```

---

## ЧАСТЬ 10: АНИМАЦИИ И THREEJS (DECK-F продолжение)

### 10.1 Анимация добавления карты в деку

```typescript
// hooks/useDeckAddAnimation.ts
// При добавлении карты — она "летит" из коллекции в список деки

export function useDeckAddAnimation() {
  const playAddAnimation = useCallback((
    sourceElement: HTMLElement,
    targetElement: HTMLElement,
    card: AbilityCard,
  ) => {
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    // Клон карты
    const clone = document.createElement("div");
    clone.style.cssText = `
      position: fixed;
      left: ${sourceRect.left}px;
      top: ${sourceRect.top}px;
      width: ${sourceRect.width}px;
      height: ${sourceRect.height}px;
      background: ${COLORS.bg_card};
      border: 1.5px solid ${RARITY_CONFIG[card.rarity].color};
      border-radius: 10px;
      pointer-events: none;
      z-index: 99999;
      box-shadow: 0 0 20px ${RARITY_CONFIG[card.rarity].color}88;
    `;
    document.body.appendChild(clone);

    gsap.timeline({ onComplete: () => clone.remove() })
      .to(clone, {
        left: targetRect.left + targetRect.width * 0.2,
        top:  targetRect.top  + targetRect.height * 0.2,
        width: targetRect.width * 0.6,
        height: targetRect.height * 0.6,
        opacity: 0.8,
        duration: 0.3,
        ease: "power2.in",
      })
      .to(clone, {
        scale: 0,
        opacity: 0,
        duration: 0.15,
        ease: "power2.in",
      });

    // Pulse на строке в деке
    gsap.fromTo(targetElement,
      { background: `${RARITY_CONFIG[card.rarity].color}22` },
      { background: "transparent", duration: 0.5, ease: "power2.out" }
    );
  }, []);

  return { playAddAnimation };
}
```

### 10.2 MyDecksDropdown — список колод пользователя

```typescript
// components/deck-builder/MyDecksDropdown.tsx

export function MyDecksDropdown({ onClose }: { onClose: () => void }) {
  const store = useDeckBuilderStore();
  const [search, setSearch] = useState("");

  const filtered = store.savedDecks.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      style={{
        position: "absolute",
        top: 56, left: 160,
        width: 340,
        background: COLORS.bg_surface,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
      {/* Поиск по колодам */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <input
          placeholder="Найти колоду..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.05)", /* ... */ }}
        />
      </div>

      {/* Список */}
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {/* Новая колода */}
        <button
          onClick={() => { store.createNewDeck("Новая колода"); onClose(); }}
          style={{
            width: "100%", padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            color: COLORS.gold,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <Plus size={16} /> Создать новую колоду
        </button>

        {filtered.map(deck => (
          <DeckListItem
            key={deck.id}
            deck={deck}
            isActive={store.currentDeck.id === deck.id}
            onLoad={() => { store.loadDeck(deck.id); onClose(); }}
            onDelete={() => store.deleteDeck(deck.id)}
            onDuplicate={() => { store.duplicateDeck(deck.id); onClose(); }}
          />
        ))}

        {filtered.length === 0 && search && (
          <div style={{ padding: 16, textAlign: "center", color: COLORS.text_secondary, font: `400 13px 'Rajdhani'` }}>
            Колод с таким названием нет
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

---

## ЧАСТЬ 11: CURSOR PROMPTS

### 11.1 Мастер-промпт v4

```
Ты реализуешь deck builder для игры "World Order" — AAA TCG-файтинг.

ЭТАЛОН: MTG Arena Deckbuilder.
СТЕК: Next.js 15 + Zustand (immer) + Framer Motion + GSAP + DynamoDB + Three.js

ПРАВИЛА ИГРЫ ДЛЯ КОЛОДЫ:
  Размер: 20-30 карт
  Копии: common ×3, rare ×2, epic ×1, legendary ×1
  Все карты — одного персонажа

ПРИНЦИПЫ UX (из MTG Arena):
  1. Счётчик [N/30] виден ВСЕГДА — размер шрифта 22px минимум
  2. Кривая энергии обновляется В РЕАЛЬНОМ ВРЕМЕНИ — никаких кнопок
  3. Фильтрация — debounce 80ms, никаких заметных задержек
  4. Сохранение — автоматически через 1.5s после изменения
  5. Ошибки валидации — конкретный текст "Добавь ещё 6 карт", не "Ошибка"
  6. Копии карты — кружки ●●○, не просто "2/3"
  7. Превью карты — 280px ширина, полный текст эффекта виден
  8. Deck code — одна кнопка Copy/Import, никаких сложных шагов

ПОРЯДОК РЕАЛИЗАЦИИ: DECK-A → B → C → D → E → F, затем интеграция.
После каждого — CRITIC REVIEW. Принять только 9.5+/10.
```

### 11.2 Промпты агентов

**DECK-A: Layout & Router**
```
ЗАДАЧА: DeckBuilderPage с трёхпанельным layout (52%/24%/24%),
DeckBuilderHeader с автосохранением, горячими клавишами Ctrl+S.

Файлы: app/decks/[id]/page.tsx, components/deck-builder/DeckBuilderPage.tsx,
       components/deck-builder/DeckBuilderHeader.tsx,
       hooks/useDeckBuilderShortcuts.ts

Требования:
  □ Трёхпанельный layout не ломается на 1280px, 1440px, 1920px
  □ Header: высота 56px, не больше и не меньше
  □ Автосохранение: через 1.5s после изменения entries
  □ Индикатор "Сохранено ✓" / "Сохраняем..." в header
  □ Название колоды — inline edit по клику

CRITIC: "Открой MTG Arena и сравни header и общий layout.
Принять только если планировка сопоставима."
```

**DECK-B: Collection Grid**
```
ЗАДАЧА: CollectionPanel с FilterBar + CollectionGrid + CollectionCardItem.

Файлы: components/deck-builder/CollectionPanel.tsx,
       components/deck-builder/FilterBar.tsx,
       components/deck-builder/CollectionGrid.tsx

Требования:
  □ На 1440px экране — минимум 8 карт в строке без скролла
  □ Каждая карточка: арт (80px), название, кружки ●●○, полоска редкости
  □ canAdd=false → opacity 0.5, cursor not-allowed
  □ При maxCopies достигнут → оверлей "МАХ" поверх арта
  □ Фильтрация debounce 80ms (измерить через performance.now)
  □ При ошибке добавления — red toast поверх карточки 1.8s

CRITIC: "Возьми скриншот коллекции MTG Arena. Сравни вслепую.
Принять только если Grid читается так же легко."
```

**DECK-C: 3D Card Preview**
```
ЗАДАЧА: CardPreviewPortal — превью при наведении через portal.

Файлы: components/deck-builder/CardPreviewPortal.tsx,
       components/deck-builder/CardPreview3D.tsx (ThreeJS)

Требования:
  □ Позиция: 20px правее курсора, не за пределы экрана
  □ Ширина: 280px, высота: 420px
  □ Появление: spring opacity + scale 0.92→1 (tension 400, friction 22)
  □ ThreeJS: карта-арт на plane вращается sin(t*0.7)*0.25 по Y
  □ Весь текст эффекта читается без скролла (шрифт 13px)
  □ Флейвор-текст italic внизу с разделителем

CRITIC: "Наведи на legendary карту. Увеличь 1.5x в браузере.
Текст эффекта должен читаться без напряжения для глаз.
Принять только если читается легко."
```

**DECK-D: Deck List Panel**
```
ЗАДАЧА: DeckListPanel — список карт с прогресс-баром, строками карт,
кнопками ±count и кнопкой "В БОЙ!".

Файлы: components/deck-builder/DeckListPanel.tsx,
       components/deck-builder/DeckCardRow.tsx

Требования:
  □ Счётчик [N/30] — font 22px Rajdhani 700, виден без скролла
  □ Полоса прогресса: зелёная 0→20, золотая 20→30, красная при переполнении
  □ Ошибки: анимация height expand/collapse, красный текст с конкретным объяснением
  □ Строки карт: кнопки − и + по сторонам счётчика ×N
  □ Кнопка "В БОЙ!": disabled если !isValid, gold gradient если isValid
  □ Анимация layout при добавлении/удалении карт (framer-motion layout)

CRITIC: "Добавь 10 карт в деку. Кнопка В БОЙ должна менять состояние
ровно в тот момент когда 20-я карта добавлена.
Принять только если переход мгновенный и красивый."
```

**DECK-E: Stats & Curve**
```
ЗАДАЧА: StatsPanel — кривая энергии, редкость, статистика, рекомендации.

Файлы: components/deck-builder/StatsPanel.tsx

Требования:
  □ Кривая: столбики с spring-анимацией при каждом изменении
  □ Цвета: cost 0-2 зелёный, 3-4 золотой, 5-6 оранжевый
  □ Число над каждым столбиком (если > 0)
  □ Средняя стоимость: обновляется в реальном времени
  □ Редкость: progress bars с цветами rarity
  □ Рекомендации: max 3 карточки, текст конкретный (не "добавь карты")
  □ Пустое состояние если entries=[] — placeholder "Начни добавлять карты"

CRITIC: "Добавь 5 дорогих карт (стоимость 5-6). Кривая должна
визуально показать перекос вправо и появится warning.
Принять только если предупреждение конкретное и видное."
```

**DECK-F: Rules, UX & Deck Codes**
```
ЗАДАЧА: DeckCodeModal, MyDecksDropdown, анимации добавления,
API-интеграция с DynamoDB.

Файлы: components/deck-builder/DeckCodeModal.tsx,
       components/deck-builder/MyDecksDropdown.tsx,
       hooks/useDeckAddAnimation.ts,
       app/api/decks/route.ts, app/api/decks/[id]/route.ts

Требования:
  □ Deck code: формат "WO1_" + base64url, декодируется корректно
  □ Export/Import — две вкладки в модалке
  □ Copy → кнопка зеленеет "✓ Скопировано" на 2s
  □ Import ошибка: красный текст под textarea
  □ MyDecks: dropdown с поиском, кнопками удалить/дублировать
  □ API: GET /api/decks (список) + POST + PUT + DELETE
  □ Анимация добавления: карта летит из grid в DeckList

CRITIC: "Скопируй deck code. Открой новый таб. Вставь код.
Колода должна загрузиться полностью корректно.
Принять только если round-trip работает без ошибок."
```

### 11.3 Финальный Critic Loop v4

```
ФИНАЛЬНЫЙ CRITIC REVIEW — DECK BUILDER:

Провести полный сценарий использования:
  1. Выбрать персонажа
  2. Добавить 20 карт разными способами (клик, фильтры)
  3. Проверить кривую энергии
  4. Исправить колоду по рекомендациям
  5. Сохранить → скопировать код → импортировать в новой вкладке
  6. Нажать "В БОЙ!"

По каждому критерию (1-10, принимать только 9.5+):

  1. LAYOUT CLARITY          — понятно куда кликать?
  2. CARD DENSITY            — >=8 карт видно без скролла?
  3. COPY COUNT VISIBILITY   — ●●○ читаются без hover?
  4. CURVE READABILITY       — кривая понятна за 1 взгляд?
  5. DECK PROGRESS           — [N/30] всегда заметен?
  6. VALIDATION UX           — ошибки объясняют ЧТО делать?
  7. FILTER SPEED            — <50ms задержка?
  8. CARD PREVIEW            — текст эффекта читается?
  9. SAVE FLOW               — <=1 клик для сохранения?
  10. COMPETITIVE FEEL       — похоже на серьёзную TCG?

IF ANY < 9.5 → reject + конкретный fix → повторный ревью.
APPROVED только когда ALL >= 9.5.

Финальная запись: "DECK BUILDER v4 — PRODUCTION READY"
```

---

*World Order — TZ v4.0: Deck Builder*
*Стандарт: MTG Arena × Hearthstone × Marvel Snap*
*Правила: 20-30 карт / common×3, rare×2, epic×1, legendary×1*
*6 агентов + Critic Loop / принять только 9.5+*
