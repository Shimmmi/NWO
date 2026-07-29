# WORLD ORDER — TZ v6.0: TCG SHOP & BOOSTER ECONOMY
## AAA Soft-Currency Shop · Owned Collection · Craft · MTG Arena Pack Opening
> Стандарт: MTG Arena Store × MTG Arena Pack Opening × Hearthstone Pack Open × Marvel Snap Collection
> Движок: Next.js 15 + Three.js (R3F) + Framer Motion + GSAP + DynamoDB + Zustand
> Режим Cursor: Multi-Agent Parallel + двойной Critic Loop (ECON + VISUAL слепое A/B, порог **9.5+/10**)
> Ультракод: цикл по каждому визуальному биту до тех пор, пока VISUAL-CRITIC не будет **поражён** и вслепую не выберет WO над эталоном
>
> **Связанные TZ:**
> - [`world-order-deck-builder-tz-v4.md`](./world-order-deck-builder-tz-v4.md) — collection grid / 3D preview / deck rules (owned-gate)
> - [`world-order-ability-animations-tz-v3.md`](./world-order-ability-animations-tz-v3.md) — flash / slam / rarity FX language (reuse for legendary interrupt)
> - [`world-order-netcode-tz-v5.md`](./world-order-netcode-tz-v5.md) — слепой A/B протокол, match settle hook
> - [`tz_political_card_game.md`](./tz_political_card_game.md) §4.3 — product intent (packs / craft); **валюта на бустеры отменяет** «только косметика»

---

## СОДЕРЖАНИЕ

- [ЧАСТЬ 0: Диагноз и референсный анализ](#часть-0-диагноз-и-референсный-анализ)
- [ЧАСТЬ 1: Мульти-агентная система v6](#часть-1-мульти-агентная-система-v6)
- [ЧАСТЬ 2: Экономика и данные (DynamoDB)](#часть-2-экономика-и-данные-dynamodb)
- [ЧАСТЬ 3: Правила бустера и pity](#часть-3-правила-бустера-и-pity)
- [ЧАСТЬ 4: Крафт](#часть-4-крафт)
- [ЧАСТЬ 5: XP → credits / free packs](#часть-5-xp--credits--free-packs)
- [ЧАСТЬ 6: Shop UI (только бустеры)](#часть-6-shop-ui-только-бустеры)
- [ЧАСТЬ 7: Three.js Booster Opening](#часть-7-threejs-booster-opening)
- [ЧАСТЬ 8: Owned Collection ↔ Deck Builder](#часть-8-owned-collection--deck-builder)
- [ЧАСТЬ 9: API / безопасность / идемпотентность](#часть-9-api--безопасность--идемпотентность)
- [ЧАСТЬ 10: Cursor Prompts, Ultra-loop, Test Plan](#часть-10-cursor-prompts-ultra-loop-test-plan)
- [Приложение A: Карта файлов](#приложение-a-карта-файлов)
- [Приложение B: Ban-list / вне скоупа](#приложение-b-ban-list--вне-скоупа)

---

## ЧАСТЬ 0: ДИАГНОЗ И РЕФЕРЕНСНЫЙ АНАЛИЗ

### 0.1 Что сломано сейчас

| Проблема | Симптом | Приоритет |
|----------|---------|-----------|
| Нет магазина | Нет `/shop`, нет SKU, нет buy flow | 🔴 КРИТИЧНО |
| Нет soft currency | `UserRecord` без `credits`; экономика только energy/Elo | 🔴 КРИТИЧНО |
| Нет owned inventory | «Коллекция» = все карты персонажа; нет `CollectionItem` | 🔴 КРИТИЧНО |
| Нет бустеров / RNG | Нет pack roll, pity, server-authoritative open | 🔴 КРИТИЧНО |
| XP мёртв | `xp`/`level` в схеме есть, на settle матча не начисляются | 🔴 КРИТИЧНО |
| Нет крафта | Дубликаты бесполезны; нет dust → higher rarity | 🟡 ВЫСОКИЙ |
| Нет pack opening | Нет Three.js / cinematic reveal; нет AAA feel | 🔴 КРИТИЧНО |
| Нет starter kit | После gate коллекции игрок не сможет собрать 20-карточную колоду | 🔴 КРИТИЧНО |

### 0.2 Отмена product TZ §4.3 (валюта)

Product TZ писал: «внутриигровая валюта без pay-to-win: только косметика».

**v6 явно отменяет это для экономики карт:**

- Soft currency (`credits`) — **единственная** валюта покупки бустеров.
- Косметики в v6 **нет**.
- Real-money IAP / premium currency — **запрещены**.
- Pay-to-win через деньги — невозможно (денег нет). Progression = matches → XP → credits → packs.

### 0.3 Референсы — что крадём

**MTG Arena — Store:**
- Чёткий hero SKU, цена всегда видна, баланс валюты в HUD
- Insufficient funds → понятный fail state, не silent disable
- Покупка мгновенно ведёт в pack opening (не «добавлено в инвентарь, открой потом» как default — у нас: buy → open сразу; unopened packs тоже храним)

**MTG Arena — Pack Opening:**
- Pack present → tear → cards rise → reveal cascade
- Rarity escalate: common quiet → rare shimmer → mythic/legendary interrupt
- Hold-to-skip для ветеранов
- Summary с NEW / duplicate

**Hearthstone — Pack Open:**
- Физика пака, foil catch light
- Card slam timing; legendary golden interrupt
- Sound sting hierarchy

**Marvel Snap — Collection:**
- Owned counts, clean grid, rarity accent
- Duplicate feel without clutter

### 0.4 Целевое состояние

```
До:  Unlock-all collection, мёртвый XP, нет shop, нет opening
После: Soft-currency shop (только бустеры) → AAA Three.js opening
       (4C+2R+1E/L+bonus) → owned inventory → deck builder owned-only
       → craft 4-of-rarity → XP settle → credits + free packs
       VISUAL-CRITIC вслепую предпочитает WO эталону MTG Arena
```

---

## ЧАСТЬ 1: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА v6

### 1.1 Оркестратор и группы

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CURSOR ORCHESTRATOR v6                              │
│         Ultra-loop: каждый визуальный бит → 2 варианта → слепой A/B        │
│         до APPROVED 9.5+ и «поражён качеством»                             │
├────────────────────────────────────────────────────────────────────────────┤
│ GROUP ECON (backend gate — остальные ждут APPROVED ECON-CRITIC)            │
│  ECON-A schema/credits/collection │ ECON-B pack RNG+pity+open              │
│  ECON-C XP settle → credits/packs │ ECON-D craft API                       │
│                    ECON-CRITIC — fairness / exploit / idempotency           │
├────────────────────────────────────────────────────────────────────────────┤
│ GROUP SHOP (UI магазина)                                                   │
│  SHOP-A /shop layout │ SHOP-B SKU cards+buy │ SHOP-C wallet HUD            │
│                    SHOP-VISUAL-CRITIC — слепой A/B vs MTG Store             │
├────────────────────────────────────────────────────────────────────────────┤
│ GROUP OPEN (Three.js — ultracode per-beat)                                 │
│  OPEN-A pack mesh │ OPEN-B tear shader │ OPEN-C flip cascade               │
│  OPEN-D rarity FX+legendary │ OPEN-E bonus+summary+skip │ OPEN-F audio     │
│                    OPEN-VISUAL-CRITIC — слепой A/B vs MTG Pack Open         │
├────────────────────────────────────────────────────────────────────────────┤
│ GROUP INV                                                                  │
│  INV-A owned collection grid │ INV-B deck gate + starter kit               │
│                    INV-CRITIC — owned correctness + UX                     │
└────────────────────────────────────────────────────────────────────────────┘
```

**Порядок гейтов:**

1. ECON-A → ECON-CRITIC (schema)  
2. ECON-B + ECON-C + ECON-D → ECON-CRITIC (полный econ)  
3. SHOP-A/B/C → SHOP-VISUAL-CRITIC (min 3 A/B cycles)  
4. OPEN-A…F по одному биту; после каждого бита — OPEN-VISUAL-CRITIC A/B  
5. INV-A/B → INV-CRITIC  
6. Финальный Ultra Loop: полный buy→open→collection→deck path

### 1.2 Системный промпт ECON-CRITIC

```
Ты — Lead LiveOps / Economy designer, строивший economy loops
в MTG Arena и Hearthstone. Ты ищешь эксплойты.

ЭТАЛОН: server-authoritative gacha; клиент НИКОГДА не решает редкость.

КРИТЕРИИ (каждый 1-10, принимать только 9.5+):

  1. AUTHORITY — все rolls (slots, E|L, bonus, craft target) только на сервере.
  2. ATOMICITY — buy: credits debit + pack grant атомарны; open: pack consume +
     collection increment атомарны; craft: 4 dust -1 each +1 target атомарны.
  3. IDEMPOTENCY — повтор POST с тем же Idempotency-Key не двойной charge.
  4. PITY — legendary pity счётчик персистентен, не сбрасывается читом клиента.
  5. STARTER — новый игрок может собрать валидную 20-карточную колоду на ≥1 лидера.
  6. OWNED GATE — deck builder не показывает/не добавляет карты с count=0.
  7. NO CLIENT TRUST — response body карт open нельзя подделать для grant.
  8. EXPLOIT — double-click buy, race open, craft concurrent — все зелёные.
  9. BALANCE MATH — ожидаемый credits/hour и pack EV задокументированы; нет soft-lock.
  10. AUDIT — каждый buy/open/craft пишет достаточный лог (userId, sku, seed/result).

ЕСЛИ ЛЮБОЙ < 9.5:
  issue = файл + функция + сценарий воспроизведения + ожидаемое поведение.
  REJECT → fix → re-review. Без лимита итераций.

ПРИНЯТЬ только: "APPROVED — Economy production-ready".
```

### 1.3 Системный промпт SHOP-VISUAL-CRITIC

```
Ты — Art Director UI магазина MTG Arena. Ты не читаешь код.
Только скриншоты/видео. «Нормально» = провал. Нужно «вау».

ЭТАЛОН: MTG Arena Store (gold wallet, pack tiles, clear CTA).

КРИТЕРИИ (1-10, порог 9.5+):

  1. FIRST IMPRESSION — 3 секунды: это AAA store или админка?
  2. BRAND — WORLD ORDER читается как бренд магазина, не generic dark UI.
  3. FOCUS — главный CTA «Купить» доминирует на SKU.
  4. WALLET — credits всегда видны; pulse при изменении.
  5. DEPTH — фон/атмосфера не flat #08080F void без жизни.
  6. TYPOGRAPHY — Cinzel Decorative / Rajdhani из tokens.ts.
  7. PALETTE — void/gold/rarity colors; никаких zinc-shadcn дефолтов.
  8. FEEDBACK — клик buy <100ms визуальный отклик.
  9. EMPTY/FAIL — insufficient funds выглядит intentional, не broken.
  10. CONSISTENCY — shop = одна игра с lobby/battle (tokens).

Слепой A/B: §1.5. Min 3 цикла.
APPROVED только: "APPROVED — Shop UI на уровне эталона".
```

### 1.4 Системный промпт OPEN-VISUAL-CRITIC (жёсткий)

```
Ты — Art Director pack opening MTG Arena + Hearthstone.
Ты СЛЕПОЙ к тому, какой вариант «наш». Тебе дают папки A/B и
(в контрольных циклах) stills эталона без меток.

Ты сравниваешь буквально и ОБЯЗАН назвать победителя.
«Почти как MTG» = REJECT. Нужно: «я поражён» / WO ≥ эталон.

КРИТЕРИИ (1-10, порог 9.5+):

  1. PACK PRESENCE — пак ощущается физическим объектом (foil, weight, light).
  2. TEAR DRAMA — tear/rip — событие, не fade opacity.
  3. REVEAL CADENCE — cascade flip читается; паузы между картами осмысленны.
  4. RARITY HIERARCHY — C < R < E < L без объяснений. Legendary interrupt обязателен.
  5. BONUS TEASE — бонусный слот (если есть) — отдельный beat, не «ещё одна карта в ряд».
  6. SKIP UX — hold-to-skip для ветеранов; полный path для первого открытия.
  7. NEW/DUPE — summary мгновенно показывает NEW vs duplicate.
  8. PERFORMANCE — 60fps на mid GPU; tier-0 fallback не выглядит сломанным.
  9. AUDIO SYNC — stings совпадают с flip/legendary (если audio включён).
  10. BLIND PREFERENCE — в слепом тесте ты выбираешь WO, а не эталон.
      Если выбираешь эталон — REJECT независимо от других баллов.

ЕСЛИ ЛЮБОЙ < 9.5 ИЛИ критерий 10 провален:
  конкретный issue (бит таймлайна + ms + что слабее эталона).
  REJECT → OPEN-агент итерирует → новый A/B. БЕЗ ЛИМИТА ЦИКЛОВ.

ПРИНЯТЬ только:
  "APPROVED — Booster opening превосходит / равен эталону; критик поражён".
```

### 1.5 Протокол слепого A/B (Ultra-loop)

Обязателен для SHOP-VISUAL и OPEN-VISUAL. Скопирован/адаптирован из netcode TZ v5.

1. Агент готовит **две** содержательно разные реализации (композиция камеры / timing / lighting), не «другой hex кнопки».
2. Артефакты: `/tmp/nwo-shop-ab/{a,b}/` — для shop: `01-idle.png`, `02-hover-sku.png`, `03-buy.png`, `04-insufficient.png`; для opening: `01-pack-present.mp4|png`, `02-tear.png`, `03-flip-common.png`, `04-flip-rare.png`, `05-epic.png`, `06-legendary-interrupt.png`, `07-bonus.png`, `08-summary.png`.
3. Critic получает **только пути**. Метки A/B рандомизируются каждый цикл. Не говорить, какой вариант новый.
4. Critic называет победителя по каждому критерию + общего победителя + что слабее у проигравшего.
5. Победитель = новая база. Удачные детали проигравшего переносятся.
6. Победитель < 9.5 по любому критерию → оба отклонены, новая пара.
7. **Контроль калибровки:** в каждый OPEN-цикл третьим без метки подкладывается still текущего слабого UI (например плоский CSS pack). Если критик не ставит его последним с отрывом — вердикт цикла аннулируется.
8. **Эталон вслепую:** минимум в одном из трёх обязательных циклов подмешать MTG Arena pack-open stills. Critic обязан сказать, какой набор лучше. APPROVED финала требует, чтобы WO победил или tie с явной похвалой WO.
9. **Минимум циклов на визуальный бит:** 3. Даже при первом 9.5+ — ещё два цикла.

**Правило ультракода:** Orchestrator НЕ объявляет «готово», пока каждый OPEN-бит и shop не имеют строки `APPROVED` от своего VISUAL-CRITIC с критерием 10 выполненным.

### 1.6 Системный промпт INV-CRITIC

```
Ты — UX + data integrity reviewer коллекции TCG.

КРИТЕРИИ (1-10, 9.5+):
  1. OWNED ONLY — count=0 не в grid (кроме empty state).
  2. COUNTS — UI count = серверный CollectionItem.count.
  3. DECK LIMITS — нельзя добавить больше min(owned, DECK_RULES.MAX_COPIES).
  4. STARTER — после регистрации валидная колода собираема.
  5. NEW BADGE — карта из только что открытого пака помечена до dismiss.
  6. CRAFT UI — нельзя скрафтить без 4 dust; preview target rarity ясен.
  7. EMPTY STATE — «открой бустер» CTA ведёт в /shop.
  8. PERF — grid ≥8 карт видно на 1440p без лагов фильтра.
  9. CONSISTENCY — визуал = deck-builder TZ v4 tokens.
  10. NO REGRESSION — deck codes / validation из v4 не сломаны.

APPROVED: "APPROVED — Owned collection ready".
```

---

## ЧАСТЬ 2: ЭКОНОМИКА И ДАННЫЕ (DynamoDB)

### 2.1 Расширение schema

```typescript
// lib/schema.ts — ДОПОЛНЕНИЯ

export interface UserRecord {
  userId: string;
  email: string;
  nickname: string;
  passwordHash: string;
  isGuest: boolean;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  /** Soft currency. Единственная валюта магазина. */
  credits: number;
  /** Pity: packs since last legendary (per account). */
  legendaryPity: number;
  /** ISO date YYYY-MM-DD последнего daily credit grant (stub). */
  lastDailyGrantAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublic {
  userId: string;
  nickname: string;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  credits: number;
  isGuest: boolean;
}

/** PK userId, SK cardId */
export interface CollectionItem {
  userId: string;
  cardId: string;
  count: number;
  /** ISO — для NEW badge / sort */
  firstObtainedAt: string;
  updatedAt: string;
}

/** Unopened packs inventory */
export interface PackInventoryItem {
  userId: string;
  packInstanceId: string; // ulid
  skuId: string;
  source: "purchase" | "level_up" | "starter" | "admin";
  createdAt: string;
}

export type EconomyLedgerKind =
  | "match_reward"
  | "level_up"
  | "daily_grant"
  | "pack_purchase"
  | "pack_open"
  | "craft"
  | "starter";

export interface EconomyLedgerEntry {
  userId: string;
  entryId: string;
  kind: EconomyLedgerKind;
  deltaCredits?: number;
  meta?: Record<string, unknown>;
  createdAt: string;
}
```

### 2.2 DynamoDB tables

```typescript
// lib/db.ts — расширить TABLE

export const TABLE = {
  USERS: "world-order-users",
  MATCHES: "world-order-matches",
  DECKS: "world-order-decks",
  FRIENDS: "world-order-friends",
  COLLECTION: "world-order-collection",   // PK userId, SK cardId
  PACKS: "world-order-packs",             // PK userId, SK packInstanceId
  LEDGER: "world-order-economy-ledger",   // PK userId, SK entryId (optional but recommended)
} as const;
```

Миграция существующих users: при чтении, если `credits === undefined` → treat as `0` и backfill на следующем write; `legendaryPity` default `0`.

### 2.3 Константы экономики

```typescript
// lib/shop/economy.ts

export const ECONOMY = {
  STARTING_CREDITS: 800,
  /** После регистрации — см. starter kit §8.3 */
  MATCH_WIN_CREDITS: 40,
  MATCH_LOSS_CREDITS: 15,
  MATCH_WIN_XP: 80,
  MATCH_LOSS_XP: 30,
  XP_PER_LEVEL: 200,
  LEVEL_UP_CREDITS: 100,
  /** Каждый level-up даёт 1 free standard booster (mix или last-played leader — зафиксировано: MIX) */
  LEVEL_UP_FREE_PACK_SKU: "booster-mix-standard",
  DAILY_GRANT_CREDITS: 50, // stub endpoint; UI optional in v6
} as const;
```

### 2.4 Каталог магазина (только бустеры)

```typescript
// lib/shop/catalog.ts

export type BoosterSkuId =
  | "booster-rumpf-standard"
  | "booster-pu-standard"
  | "booster-shi-standard"
  | "booster-zelenko-standard"
  | "booster-mix-standard"
  | "booster-mix-premium"; // soft-only «premium» = дороже + лучше bonus/pity weight

export type BoosterPool =
  | { type: "character"; characterId: string }
  | { type: "mix" }; // all leaders' cards

export interface BoosterSku {
  id: BoosterSkuId;
  name: string;
  description: string;
  priceCredits: number;
  pool: BoosterPool;
  /** Visual theme for pack mesh */
  artKey: string;
  /** Premium soft SKU flags */
  bonusChanceMultiplier: number; // 1.0 standard, 1.5 premium
  legendaryWeightBonus: number;  // 0 standard, +0.02 premium
}

export const BOOSTER_CATALOG: BoosterSku[] = [
  {
    id: "booster-rumpf-standard",
    name: "Rumpf Protocol Pack",
    description: "4C + 2R + 1E/L from Donald Rumpf",
    priceCredits: 100,
    pool: { type: "character", characterId: "donald-rumpf" },
    artKey: "pack-usa",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-pu-standard",
    name: "Bear Doctrine Pack",
    description: "4C + 2R + 1E/L from Vladimir Pu",
    priceCredits: 100,
    pool: { type: "character", characterId: "vladimir-pu" },
    artKey: "pack-russia",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-shi-standard",
    name: "Silk Road Pack",
    description: "4C + 2R + 1E/L from Jin Shi",
    priceCredits: 100,
    pool: { type: "character", characterId: "jin-shi" },
    artKey: "pack-china",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-zelenko-standard",
    name: "Trident Pack",
    description: "4C + 2R + 1E/L from Vlado Zelenko",
    priceCredits: 100,
    pool: { type: "character", characterId: "vlado-zelenko" },
    artKey: "pack-ukraine",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-mix-standard",
    name: "World Order Mix",
    description: "4C + 2R + 1E/L from any leader",
    priceCredits: 120,
    pool: { type: "mix" },
    artKey: "pack-mix",
    bonusChanceMultiplier: 1,
    legendaryWeightBonus: 0,
  },
  {
    id: "booster-mix-premium",
    name: "Summit Pack",
    description: "Same slots, higher bonus & legendary weight (soft currency only)",
    priceCredits: 200,
    pool: { type: "mix" },
    artKey: "pack-summit",
    bonusChanceMultiplier: 1.5,
    legendaryWeightBonus: 0.02,
  },
];
```

### 2.5 Модели (helpers)

Обязательные функции в `lib/models.ts` / `lib/shop/models.ts`:

- `getCredits(userId)`, `adjustCredits(userId, delta, ledgerMeta)` с conditional `credits >= cost`
- `getCollection(userId)`, `incrementCard(userId, cardId, n)`
- `grantPack(userId, skuId, source)`, `consumePack(userId, packInstanceId)`
- `grantStarterKit(userId)` — идемпотентно (флаг `starterGranted` на user или ledger kind)

---

## ЧАСТЬ 3: ПРАВИЛА БУСТЕРА И PITY

### 3.1 Состав слотов (жёстко)

```
Slots (всегда 7):
  [0..3]  Common ×4
  [4..5]  Rare ×2
  [6]     Epic OR Legendary (weighted + pity)

Bonus (optional 8th):
  независимый roll после слотов
```

### 3.2 RNG (server-only)

```typescript
// lib/shop/packRoll.ts

import type { AbilityCard } from "@/lib/game/types";

export type PackSlotRarity = "common" | "rare" | "epic" | "legendary";

export interface PackCardResult {
  cardId: string;
  rarity: PackSlotRarity;
  slot: "c1" | "c2" | "c3" | "c4" | "r1" | "r2" | "elite" | "bonus";
  isNew: boolean; // computed vs collection at grant time
}

export interface PackOpenResult {
  packInstanceId: string;
  skuId: string;
  cards: PackCardResult[]; // 7 or 8
  legendaryHit: boolean;
  pityBefore: number;
  pityAfter: number;
}

export const PACK_ODDS = {
  /** P(legendary) on elite slot before pity force */
  ELITE_LEGENDARY_BASE: 0.08, // 8% → epic 92%
  /** Soft pity: +0.5% per pack after 20 without legendary */
  PITY_START: 20,
  PITY_INCREMENT: 0.005,
  /** Hard pity: force legendary */
  PITY_HARD: 40,
  /** Bonus */
  BONUS_BASE_CHANCE: 0.15, // 15% any bonus
  BONUS_GIVEN_EPIC_PLUS: 0.20, // of bonus rolls → epic+ (else rare+)
  BONUS_LEGENDARY_GIVEN_EPIC_PLUS: 0.10,
} as const;

export function eliteLegendaryChance(
  pity: number,
  skuLegendaryWeightBonus: number
): number {
  if (pity >= PACK_ODDS.PITY_HARD) return 1;
  let p = PACK_ODDS.ELITE_LEGENDARY_BASE + skuLegendaryWeightBonus;
  if (pity >= PACK_ODDS.PITY_START) {
    p += (pity - PACK_ODDS.PITY_START + 1) * PACK_ODDS.PITY_INCREMENT;
  }
  return Math.min(1, p);
}

/**
 * rollPack(sku, pity, ownedCounts, rng) → PackOpenResult cards (без isNew);
 * grant применяет isNew.
 * ВАЖНО: использовать crypto-quality RNG на сервере (node:crypto randomInt).
 */
```

### 3.3 Выбор карты из пула

- Для rarity R и pool character: равномерно среди `abilityCards` лидера с `card.rarity === R`.
- Для mix: равномерно среди всех карт всех лидеров этой rarity.
- Если пул rarity пуст (не должно быть) — fallback на rare → common с логом error.

### 3.4 Pity updates

```
if elite slot == legendary:
  pityAfter = 0
else:
  pityAfter = pityBefore + 1
```

Bonus legendary **не** сбрасывает pity (только elite slot). Зафиксировано.

### 3.5 Expected value (для ECON-CRITIC)

Документировать в коде комментарием:

- Standard pack EV ≈ 4C + 2R + 0.92E + 0.08L + 0.15×(bonus)
- Soft premium: legendary weight +2pp, bonus chance ×1.5
- Credits/hour rough: ~3 matches → ~120–150 credits → ~1 standard pack / hour active play (+ level-up packs)

---

## ЧАСТЬ 4: КРАФТ

### 4.1 Правило

```
Dust: списать 4 карты ОДНОЙ редкости (любые cardId той rarity, owned).
Gain: +1 карта СЛЕДУЮЩЕЙ редкости (игрок выбирает targetCardId из пула rarity).

Лестница:
  common  → rare
  rare    → epic
  epic    → legendary
  legendary → НЕЛЬЗЯ крафтить выше (UI disabled)

Обратный craft (карта → credits) — ЗАПРЕЩЁН в v6.
```

### 4.2 Типы

```typescript
// lib/shop/craft.ts

export type CraftableFrom = "common" | "rare" | "epic";

export const CRAFT_NEXT: Record<CraftableFrom, "rare" | "epic" | "legendary"> = {
  common: "rare",
  rare: "epic",
  epic: "legendary",
};

export const CRAFT_COST = 4;

export interface CraftRequest {
  fromRarity: CraftableFrom;
  /** Ровно 4 owned cardIds (с повторами если count>1) как список списания */
  consume: Array<{ cardId: string; count: number }>; // sum counts === 4, all same rarity
  targetCardId: string; // must be next rarity, valid card
}

export interface CraftResult {
  consumed: Array<{ cardId: string; count: number }>;
  gained: { cardId: string; count: 1 };
}
```

### 4.3 Валидация сервера

1. `sum(consume.count) === 4`
2. Каждая consume карта существует, rarity === `fromRarity`, owned >= count
3. `targetCard` rarity === `CRAFT_NEXT[fromRarity]`
4. Target принадлежит тому же character, что и majority consumed **или** любой если mix policy — **зафиксировано:** target должен быть того же `characterId`, что и **все** consumed карты (все 4 одного лидера). Игрок крафтит внутри пула лидера.
5. TransactWrite: decrement 4 + increment target + ledger

---

## ЧАСТЬ 5: XP → CREDITS / FREE PACKS

### 5.1 Match settle hook

В [`server/ws/match-hub.ts`](../server/ws/match-hub.ts) (или единый `lib/shop/matchRewards.ts`, вызываемый оттуда) после определения winner:

```typescript
export function computeMatchRewards(didWin: boolean): {
  xp: number;
  credits: number;
} {
  return didWin
    ? { xp: ECONOMY.MATCH_WIN_XP, credits: ECONOMY.MATCH_WIN_CREDITS }
    : { xp: ECONOMY.MATCH_LOSS_XP, credits: ECONOMY.MATCH_LOSS_CREDITS };
}

export function applyXp(user: UserRecord, gainedXp: number): {
  user: UserRecord;
  levelsGained: number;
} {
  let { xp, level } = user;
  xp += gainedXp;
  let levelsGained = 0;
  while (xp >= ECONOMY.XP_PER_LEVEL) {
    xp -= ECONOMY.XP_PER_LEVEL;
    level += 1;
    levelsGained += 1;
  }
  return { user: { ...user, xp, level }, levelsGained };
}
```

На каждый `levelsGained`:

- `credits += ECONOMY.LEVEL_UP_CREDITS`
- `grantPack(userId, ECONOMY.LEVEL_UP_FREE_PACK_SKU, "level_up")`

Клиент: toast «Level Up! +pack» + опционально сразу open flow если 1 pack.

### 5.2 Daily grant (stub)

`POST /api/shop/daily-claim` — раз в UTC day `+DAILY_GRANT_CREDITS`. UI кнопка в shop header опциональна; API обязателен для econ completeness.

### 5.3 Guest accounts

Guests получают starter kit + credits, но **не** персистят между устройствами (как сейчас). При upgrade guest→user — сохранить collection/credits если тот же userId continuum.

---

## ЧАСТЬ 6: SHOP UI (ТОЛЬКО БУСТЕРЫ)

### 6.1 Route & layout

- Route: `app/shop/page.tsx` → `components/shop/ShopPage.tsx`
- Auth gate: как `/decks` / `/profile`
- Nav: home + lobby link «Магазин»

```
┌─────────────────────────────────────────────────────────────┐
│  WORLD ORDER SHOP          [🪙 1 240 credits]  [Daily]      │  header 64px
├─────────────────────────────────────────────────────────────┤
│  Hero strip: Summit Pack (premium soft) large               │
├───────────────┬───────────────┬───────────────┬─────────────┤
│ Leader packs (4) + Mix standard — grid                      │
│ Each SKU: pack art, name, slot formula badge, price CTA     │
└─────────────────────────────────────────────────────────────┘
│ Footer note: "4 Common + 2 Rare + 1 Epic/Legendary + bonus?"│
└─────────────────────────────────────────────────────────────┘
```

### 6.2 SKU card requirements

- Pack art (2D now; optional subtle CSS parallax) — artKey placeholders ok
- Badge слотов: `4C · 2R · 1E/L · ?`
- Price: `100` + credit icon; disabled + red tip если `credits < price`
- CTA: «КУПИТЬ И ОТКРЫТЬ» (primary) / secondary «В ИНВЕНТАРЬ» (grant unopened only) — **default primary = buy+open**
- Hover: gold border glow, scale 1.02 spring

### 6.3 Wallet HUD

- Always visible credits
- On debit: number tween down + brief red flash
- On credit: gold pulse
- Font: Rajdhani 700, 22px minimum

### 6.4 Buy flow

```
click CTA → optimistic UI lock → POST /api/shop/buy { skuId, open: true, idempotencyKey }
  → 200 { packInstanceId, openResult?, credits }
  → if openResult: mount BoosterOpeningOverlay (R3F)
  → else: toast «Пак в инвентаре»
```

Insufficient: 402-like JSON `{ error: "insufficient_credits" }` → shake CTA + tip.

### 6.5 Tokens

Только [`lib/design/tokens.ts`](../lib/design/tokens.ts): `COLORS.bg_void`, `gold`, rarity_*, character colors. Запрет Inter/zinc admin look.

---

## ЧАСТЬ 7: THREE.JS BOOSTER OPENING

### 7.1 Стек и точки входа

```
components/shop/opening/BoosterOpeningOverlay.tsx   // fixed inset-0 portal
components/shop/opening/BoosterOpeningCanvas.tsx     // R3F Canvas
components/shop/opening/three/PackMesh.tsx
components/shop/opening/three/TearFx.tsx
components/shop/opening/three/CardFlipStack.tsx
components/shop/opening/three/RarityBurst.tsx
components/shop/opening/three/BonusSlam.tsx
components/shop/opening/OpeningOrchestrator.ts       // GSAP timeline
components/shop/opening/OpeningFallback2D.tsx        // GPU tier 0
lib/stores/openingStore.ts
```

Reuse:

- Postprocessing bloom language from `battle-scene.tsx`
- Card plane approach from `CardPreviewPortal.tsx`
- Legendary interrupt language from ability FX TZ v3 (flash / slam / freeze) — **не** запускать полный Ace Attorney objection; укороченный gold legendary beat

### 7.2 GPU tiers

Как lobby:

| Tier | Behavior |
|------|----------|
| 0 | `OpeningFallback2D` — Framer Motion sequence, no Canvas |
| 1 | R3F, reduced particles, no tear shader (simple clip) |
| 2+ | Full tear shader + particles + bloom |

### 7.3 Покадровый таймлайн (стандартный path, ~7800ms без skip)

```
Phase                t0–t1 (ms)    Что происходит
────────────────────────────────────────────────────────────────
purchase_handoff     0–400         Pack fly from SKU to center; credits tween
pack_present         400–1600      Idle breath Y bob; foil light sweep; wait click/auto
tear_rip             1600–2400     Progressive tear shader; paper particles
stack_rise           2400–3000     7 face-down cards fan rise from pack
reveal_c1            3000–3400     Flip common — soft tick
reveal_c2            3400–3800     Flip common
reveal_c3            3800–4200     Flip common
reveal_c4            4200–4600     Flip common
reveal_r1            4600–5200     Flip rare — blue shimmer + sting
reveal_r2            5200–5800     Flip rare
reveal_elite         5800–6600     Epic: purple burst 800ms
                                   OR Legendary interrupt 1600ms (see 7.4)
bonus_tease          6600–7200     ONLY if bonus; slot slam + higher rarity FX
summary              7200–7800+    Grid 7/8; NEW badges; Hold [Space] continue
exit_to_collection   +600          Cards lerp to collection icon; unmount
```

Auto-advance pack_present after 1200ms if no click; click accelerates tear.

### 7.4 Legendary interrupt (elite slot)

```
0ms    super freeze (160ms) — scene timeScale 0
30ms   full gold flash (COLORS.legendary / gold_glow)
80ms   card slam scale 1.4→1.0 elastic
120ms  particle fountain + bloom spike
400ms  nameplate Cinzel slam (card name)
1000ms settle to stack position
1600ms continue timeline
```

Связь с TZ v3: те же easing принципы (ease-in 20% / ease-out 80%), не linear.

### 7.5 Rarity VFX hierarchy

| Rarity | Flash | Particles | Bloom | Audio |
|--------|-------|-----------|-------|-------|
| common | none | none | off | soft tick |
| rare | micro blue | few | low | shimmer |
| epic | purple mid | medium | mid | epic sting (reuse AbilityAudio) |
| legendary | full gold | heavy | high | legendary sting |

### 7.6 Skip UX

- Tap/click during reveal: skip to next card flip (min 80ms between)
- Hold Space 0.45s OR button «Пропустить»: jump to summary with all cards face-up (still play 200ms legendary sting if any legendary was in pack — не лишать juice полностью)
- `prefers-reduced-motion`: force fallback 2D, shortened timings ×0.35, no tear

### 7.7 OpeningOrchestrator API

```typescript
// components/shop/opening/OpeningOrchestrator.ts

export type OpeningPhase =
  | "idle"
  | "purchase_handoff"
  | "pack_present"
  | "tear_rip"
  | "stack_rise"
  | "reveal"
  | "legendary_interrupt"
  | "bonus_tease"
  | "summary"
  | "exit";

export interface OpeningInput {
  sku: BoosterSku;
  result: PackOpenResult;
  gpuTier: 0 | 1 | 2;
  reducedMotion: boolean;
  onComplete: () => void;
}

export class OpeningOrchestrator {
  play(input: OpeningInput): void;
  skipToSummary(): void;
  skipOne(): void;
  dispose(): void;
}
```

Клиент **не** рероллит карты: `result` уже с сервера.

### 7.8 Критерии качества OPEN (для агентов)

Каждый OPEN-агент обязан сдать свой бит через OPEN-VISUAL-CRITIC A/B (§1.5) до перехода к следующему биту. Нельзя «собрать всё и проверить в конце» как единственный review — ultracode требует per-beat loop.

---

## ЧАСТЬ 8: OWNED COLLECTION ↔ DECK BUILDER

### 8.1 Gate

`deckBuilderStore` / `CollectionPanel`:

- Источник карт: `GET /api/collection` → merge with `getCardById`
- Показывать только `count > 0`
- `canAdd`: `deckCount < min(ownedCount, DECK_RULES.MAX_COPIES[rarity])`
- Overlay MAX если deck at copy limit; overlay LOCK сняты (нет lock — нет в grid)

### 8.2 Empty state

Если collection пуста (не должно быть после starter): CTA «Открыть магазин» → `/shop`.

### 8.3 Starter kit (обязателен)

При регистрации / первом `grantStarterKit`:

```typescript
// lib/shop/starterKit.ts

/**
 * На КАЖДОГО из 4 лидеров:
 *  - все common карты ×2
 *  - все rare карты ×1
 *  - 0 epic/legendary (их цель — паки/крафт)
 * + ECONOMY.STARTING_CREDITS
 * + 1× booster-mix-standard unopened (optional juice) — ДА, дать 1 free mix pack
 */
export function buildStarterGrants(): Array<{ cardId: string; count: number }> {
  // implement via getAllCharacters() + abilityCards filter by rarity
}
```

Идемпотентность: `UserRecord.starterGranted: boolean` или ledger `kind:"starter"`.

### 8.4 NEW badge

После open: cardIds из result с `isNew` → openingStore/collectionStore `recentNew` Set → badge  в collection  до 5 минут или dismiss.

### 8.5 Craft UI

Точка входа: вкладка/модалка в collection «Крафт»:

- Select fromRarity → показать owned dust pool → pick 4 → pick target from next rarity of same character → confirm → POST `/api/craft`

---

## ЧАСТЬ 9: API / БЕЗОПАСНОСТЬ / ИДЕМПОТЕНТНОСТЬ

### 9.1 Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/shop/catalog` | — | `{ skus, credits, pity }` |
| POST | `/api/shop/buy` | `{ skuId, open?: boolean }` | `{ credits, packInstanceId, openResult? }` |
| POST | `/api/shop/open` | `{ packInstanceId }` | `{ openResult, credits }` |
| GET | `/api/shop/packs` | — | `{ packs: PackInventoryItem[] }` |
| GET | `/api/collection` | — | `{ items: CollectionItem[] }` |
| POST | `/api/craft` | `CraftRequest` | `{ collectionPatch, craftResult }` |
| POST | `/api/shop/daily-claim` | — | `{ credits, granted: boolean }` |

Auth: session как существующие `/api/decks`. Guests ok.

### 9.2 Idempotency

Header: `Idempotency-Key: <ulid>`

- Persist key → response for 24h (Redis или DynamoDB LEDGER SK)
- Replay returns same body, no double debit

### 9.3 Error codes

```typescript
type ShopErrorCode =
  | "unauthorized"
  | "insufficient_credits"
  | "unknown_sku"
  | "pack_not_found"
  | "pack_already_opened"
  | "craft_invalid"
  | "craft_insufficient"
  | "daily_already_claimed"
  | "rate_limited";
```

HTTP: 401 / 402 (insufficient) / 404 / 409 / 422 / 429 / 500.

### 9.4 Rate limits

- buy/open/craft: 10 req/min/user (Redis)
- catalog/collection: 60/min

### 9.5 Security checklist (ECON-CRITIC)

- [ ] Клиент не передаёт `cards[]` для grant
- [ ] Conditional update credits (`credits >= price`)
- [ ] Pack consume conditional (item exists)
- [ ] Craft ownership checked server-side
- [ ] No RNG seed from client

---

## ЧАСТЬ 10: CURSOR PROMPTS, ULTRA-LOOP, TEST PLAN

### 10.1 Мастер-промпт v6

```
Ты реализуешь TCG Shop & Booster Economy для "World Order".

ЭТАЛОН: MTG Arena Store + Pack Opening.
СТЕК: Next.js 15 + R3F/Three + Framer Motion + GSAP + DynamoDB + Zustand
ВАЛЮТА: только soft credits. Без IAP.
SHOP: только бустеры.
PACK: 4C + 2R + 1(E|L) + optional bonus. Server RNG + pity.
ECONOMY: XP settle → credits + free packs; craft 4 same-rarity → 1 next;
         owned collection gates deck builder; starter kit on register.

ДОКУМЕНТ ИСТИНЫ: info/world-order-tcg-shop-tz-v6.md

ПОРЯДОК:
  GROUP ECON (A→B→C→D) с ECON-CRITIC gate
  → GROUP SHOP (A→B→C) + SHOP-VISUAL-CRITIC слепой A/B min 3
  → GROUP OPEN (A→F) каждый бит + OPEN-VISUAL-CRITIC A/B min 3
  → GROUP INV (A→B) + INV-CRITIC
  → Final ultra-loop full path

ПРАВИЛО УЛЬТРАКОДА:
  Не останавливайся на «хорошо». VISUAL-CRITIC обязан вслепую
  сравнить с эталоном и быть ПОРАЖЁН. Пока критерий 10
  OPEN-VISUAL не выполнен — продолжай циклы.

Принимать только 9.5+/10 по всем критериям критиков.
```

### 10.2 Промпты GROUP ECON

**ECON-A: Schema & persistence**
```
ЗАДАЧА: credits, CollectionItem, PackInventory, TABLE.*, models helpers,
starterGranted backfill, toUserPublic + credits.

Файлы: lib/schema.ts, lib/db.ts, lib/models.ts, lib/shop/economy.ts,
       lib/shop/starterKit.ts, registration path grantStarterKit

Требования:
  □ UserRecord.credits / legendaryPity / starterGranted
  □ TABLE.COLLECTION, TABLE.PACKS, (LEDGER optional)
  □ Existing users: undefined credits → 0 safe read
  □ grantStarterKit идемпотентен
  □ Starter: per-leader all commons×2, rares×1 + 800 credits + 1 mix pack

CRITIC ECON: критерии 5,6 + schema review. APPROVED only 9.5+.
```

**ECON-B: Pack RNG + open**
```
ЗАДАЧА: catalog, packRoll, pity, POST buy/open server paths.

Файлы: lib/shop/catalog.ts, lib/shop/packRoll.ts, app/api/shop/*

Требования:
  □ Слоты строго 4C+2R+1E/L + bonus odds из PACK_ODDS
  □ crypto randomInt; no Math.random in prod path
  □ Pity soft/hard; bonus не сбрасывает pity
  □ Idempotency-Key на buy/open
  □ Client never sends card list to grant

CRITIC: критерии 1–4,7,8,10. Race double-buy test.
```

**ECON-C: XP settle**
```
ЗАДАЧА: match end → XP/credits/level-up packs.

Файлы: lib/shop/matchRewards.ts, server/ws/match-hub.ts (hook)

Требования:
  □ Win/loss rewards из ECONOMY
  □ Level-up: +credits + free mix standard pack per level
  □ Не ломает Elo settlement

CRITIC: критерий 9 + «2 wins level-up grants pack».
```

**ECON-D: Craft**
```
ЗАДАЧА: craft API + atomic consume/gain same character ladder.

Файлы: lib/shop/craft.ts, app/api/craft/route.ts

Требования:
  □ 4 dust → 1 next rarity; legendary ceiling
  □ No reverse dust→credits
  □ Concurrent craft no double-spend

CRITIC: критерии 2,8.
```

### 10.3 Промпты GROUP SHOP

**SHOP-A: Route & layout**
```
ЗАДАЧА: /shop page, header brand WORLD ORDER SHOP, atmosphere background.

Файлы: app/shop/page.tsx, components/shop/ShopPage.tsx, ShopHeader.tsx
Nav links from home + lobby

Требования:
  □ Tokens typography/palette
  □ Not admin dashboard; brand-first header
  □ Responsive 1280 / 1440 / 1920

SHOP-VISUAL-CRITIC: criteria 1,2,5,6,7,10 — A/B min 3.
```

**SHOP-B: SKU grid & buy CTA**
```
ЗАДАЧА: BoosterSkuCard grid, hero Summit pack, buy+open primary.

Файлы: components/shop/BoosterSkuCard.tsx, ShopCatalog.tsx, useBuyBooster.ts

Требования:
  □ Slot badge 4C·2R·1E/L·?
  □ Price + insufficient state
  □ <100ms click feedback
  □ Opens BoosterOpeningOverlay on success

SHOP-VISUAL-CRITIC: criteria 3,8,9 — A/B.
```

**SHOP-C: Wallet HUD**
```
ЗАДАЧА: credits display + tween on change + daily claim stub button.

Файлы: components/shop/WalletHud.tsx

Требования:
  □ 22px Rajdhani 700; pulse gold/red
  □ Always visible on /shop

SHOP-VISUAL-CRITIC: criterion 4.
```

### 10.4 Промпты GROUP OPEN (ultracode per-beat)

**OPEN-A: Pack mesh + lighting**
```
ЗАДАЧА: R3F pack present — foil, breath, light sweep. artKey materials.

Файлы: BoosterOpeningCanvas.tsx, three/PackMesh.tsx

Требования:
  □ Физическое присутствие пака; не flat PNG в центре
  □ Idle breath + specular sweep
  □ GPU tier 0 bypasses to fallback later (OPEN-E/F coord)

OPEN-VISUAL-CRITIC: criterion 1 — A/B min 3 vs alternate lighting.
Сравни вслепую с MTG pack present still.
```

**OPEN-B: Tear / rip**
```
ЗАДАЧА: progressive tear shader + particles 1600–2400ms.

Файлы: three/TearFx.tsx, GLSL chunk

Требования:
  □ Tear = событие, не opacity fade
  □ Tier 1: simple clip fallback

OPEN-VISUAL-CRITIC: criterion 2 — A/B.
```

**OPEN-C: Card flip cascade**
```
ЗАДАЧА: stack rise + sequential flips commons→rares timing §7.3.

Файлы: three/CardFlipStack.tsx, OpeningOrchestrator reveal phases

Требования:
  □ Cadence readable; 80ms min between skip-one
  □ Face-down → face-up with proper map textures (card art)

OPEN-VISUAL-CRITIC: criterion 3 — A/B.
```

**OPEN-D: Rarity FX + legendary interrupt**
```
ЗАДАЧА: hierarchy C<R<E<L + legendary freeze/flash/slam §7.4–7.5.
Reuse audio stings from AbilityAudioSystem if present.

Файлы: three/RarityBurst.tsx, legendary interrupt in orchestrator

Требования:
  □ Epic ≠ Legendary intensity
  □ 60fps mid GPU

OPEN-VISUAL-CRITIC: criteria 4,8,9 — A/B; must beat reference on legendary.
```

**OPEN-E: Bonus + summary + skip**
```
ЗАДАЧА: bonus tease beat; summary NEW/dupe; hold-to-skip; exit lerp.

Файлы: three/BonusSlam.tsx, OpeningSummary.tsx, skip handlers

Требования:
  □ Bonus ≠ «8th in same row without drama»
  □ Summary badges clear
  □ Reduced-motion path

OPEN-VISUAL-CRITIC: criteria 5,6,7 — A/B.
```

**OPEN-F: Audio + polish + fallback 2D**
```
ЗАДАЧА: stings sync; OpeningFallback2D parity of information; haptics no-op web.

Файлы: OpeningFallback2D.tsx, audio hooks

Требования:
  □ Tier 0 tells same rarity story without looking broken
  □ Audio optional if muted

OPEN-VISUAL-CRITIC: criteria 8,9,10 — final blind vs MTG stills.
Пока критик не поражён и не выбирает WO — ПОВТОРЯТЬ.
```

### 10.5 Промпты GROUP INV

**INV-A: Owned collection**
```
ЗАДАЧА: collection API client + owned grid + NEW badges + craft entry.

Файлы: lib/stores/collectionStore.ts, components updates under deck-builder
       or components/collection/*

Требования:
  □ count=0 hidden
  □ Empty → /shop CTA

INV-CRITIC: 1,2,5,6,7,8.
```

**INV-B: Deck gate + starter**
```
ЗАДАЧА: deckBuilderStore owned limits; registration starter; no regression v4.

Файлы: lib/stores/deckBuilderStore.ts, CollectionPanel, deckValidator owned check

Требования:
  □ min(owned, MAX_COPIES)
  □ Valid 20-card deck possible after register
  □ Deck codes still work for owned cards

INV-CRITIC: 3,4,9,10.
```

### 10.6 Финальный Ultra Loop

```
1. Зарегистрируй нового игрока → starter kit ок
2. Купи Summit pack (если credits не хватает — добей daily/admin) → opening full path
3. Запиши видео opening; подготовь A/B пару полировок
4. OPEN-VISUAL-CRITIC слепой A/B + эталон → пока не APPROVED с критерием 10
5. Проверь collection NEW + deck add owned
6. Craft 4 commons → 1 rare
7. Сыграй матч → XP/credits/level-up pack
8. ECON-CRITIC полный regress checklist
9. SHOP-VISUAL финальный проход

DONE только когда ВСЕ критики выдали APPROVED 9.5+.
```

### 10.7 Test Plan (ручной + авто)

**Авто (минимум):**

| Test | Assert |
|------|--------|
| `packRoll` slot counts | always 4C+2R+1 elite |
| pity hard at 40 | elite forced legendary |
| buy insufficient | no pack, credits unchanged |
| buy idempotent | second same key no double debit |
| open twice | second 409 |
| craft | counts atomic |
| starter idempotent | second call no-op |

**Ручной VISUAL:**

| # | Scenario | Pass |
|---|----------|------|
| 1 | First pack open no skip | feels AAA; critic ≥9.5 |
| 2 | Legendary interrupt | freeze+gold slam |
| 3 | Bonus present | separate beat |
| 4 | Hold skip | summary correct cards |
| 5 | Tier 0 fallback | readable, not broken |
| 6 | Shop insufficient | intentional fail |
| 7 | Blind A/B vs MTG | WO wins or tie+praise |

---

## ПРИЛОЖЕНИЕ A: КАРТА ФАЙЛОВ

### Создать

| Path | Role |
|------|------|
| `info/world-order-tcg-shop-tz-v6.md` | этот документ |
| `lib/shop/economy.ts` | ECONOMY constants |
| `lib/shop/catalog.ts` | BOOSTER_CATALOG |
| `lib/shop/packRoll.ts` | RNG + pity |
| `lib/shop/craft.ts` | craft rules |
| `lib/shop/starterKit.ts` | starter grants |
| `lib/shop/matchRewards.ts` | XP/credits settle helpers |
| `lib/stores/shopStore.ts` | client shop state |
| `lib/stores/collectionStore.ts` | owned collection |
| `lib/stores/openingStore.ts` | opening UI state |
| `app/shop/page.tsx` | route |
| `app/api/shop/catalog/route.ts` | GET catalog |
| `app/api/shop/buy/route.ts` | POST buy |
| `app/api/shop/open/route.ts` | POST open |
| `app/api/shop/packs/route.ts` | GET packs |
| `app/api/shop/daily-claim/route.ts` | POST daily |
| `app/api/collection/route.ts` | GET collection |
| `app/api/craft/route.ts` | POST craft |
| `components/shop/ShopPage.tsx` | layout |
| `components/shop/ShopHeader.tsx` | brand + wallet |
| `components/shop/WalletHud.tsx` | credits |
| `components/shop/BoosterSkuCard.tsx` | SKU |
| `components/shop/ShopCatalog.tsx` | grid |
| `components/shop/opening/BoosterOpeningOverlay.tsx` | portal |
| `components/shop/opening/BoosterOpeningCanvas.tsx` | R3F |
| `components/shop/opening/OpeningOrchestrator.ts` | timeline |
| `components/shop/opening/OpeningFallback2D.tsx` | tier 0 |
| `components/shop/opening/OpeningSummary.tsx` | summary |
| `components/shop/opening/three/PackMesh.tsx` | pack |
| `components/shop/opening/three/TearFx.tsx` | tear |
| `components/shop/opening/three/CardFlipStack.tsx` | flips |
| `components/shop/opening/three/RarityBurst.tsx` | FX |
| `components/shop/opening/three/BonusSlam.tsx` | bonus |

### Изменить

| Path | Change |
|------|--------|
| `lib/schema.ts` | credits, pity, starterGranted, CollectionItem, PackInventory… |
| `lib/db.ts` | TABLE.COLLECTION, PACKS, LEDGER |
| `lib/models.ts` | collection/credits/pack helpers |
| `server/ws/match-hub.ts` | match rewards hook |
| Auth/register path | grantStarterKit |
| `lib/stores/deckBuilderStore.ts` | owned gate |
| `components/deck-builder/CollectionPanel.tsx` | owned-only |
| Home / lobby nav | link Магазин |
| `lib/design/tokens.ts` | only if shop needs extra token (prefer reuse) |

---

## ПРИЛОЖЕНИЕ B: BAN-LIST / ВНЕ СКОУПА

**Запрещено в v6:**

- Real-money IAP, Stripe, premium hard currency
- Косметика, аватары, board skins, card backs shop
- Player-to-player trade / marketplace / auction
- Полный daily quests UI (daily-claim stub OK)
- Изменение combat balance / card effects
- Client-side rarity rolls
- Reverse craft (card → credits)
- Показ всех карт в deck builder (unlock-all regression)

**Не делать так:**

- Spinner-only shop loading without skeleton
- Flat PNG pack fade-in as «opening»
- Skip that hides legendary sting entirely on first legendary ever (optional: allow skip sting only after seen)
- Math.random for pack rolls
- Trusting client `cards` array
- Purple-on-white generic AI shop aesthetic — use WORLD ORDER tokens

---

## FOOTER

```
WORLD ORDER — TZ v6.0: TCG Shop & Booster Economy
Agents: ECON-A..D + ECON-CRITIC | SHOP-A..C + SHOP-VISUAL-CRITIC
        OPEN-A..F + OPEN-VISUAL-CRITIC | INV-A..B + INV-CRITIC
Ultra-loop: слепой A/B min 3 per visual beat; stop only when critic is stunned (9.5+)
Refs: MTG Arena Store/Opening × Hearthstone Pack × Marvel Snap Collection
Stack: Next.js 15 · Three.js/R3F · Framer · GSAP · DynamoDB · Zustand
```

*Принимать реализацию только после финального Critic Loop со всеми APPROVED.*
