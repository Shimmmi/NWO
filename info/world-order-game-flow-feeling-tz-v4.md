# WORLD ORDER — TZ v4.0: GAME FLOW FEELING
## Action-Locked Presentation Clock — Slay the Spire × Guilty Gear Edition
> Стандарт: Slay the Spire card cadence × Guilty Gear Strive super lock × Hearthstone impact punctuation  
> Движок: Three.js (R3F) + GSAP 3 + Framer Motion + Zustand  
> Режим Cursor: Multi-Agent + Critic Loop (принимать только 9.5+/10)  
> **Приоритет над TZ v2 callout-таймингами и поверх TZ v3 cinematic language**

---

## СОДЕРЖАНИЕ

- [ЧАСТЬ 0: Диагноз и референсы](#часть-0-диагноз-и-референсы)
- [ЧАСТЬ 1: Мульти-агентная система FLOW v4](#часть-1-мульти-агентная-система)
- [ЧАСТЬ 2: Архитектура Presentation Clock](#часть-2-архитектура)
- [ЧАСТЬ 3: Тайминг-бюджеты](#часть-3-тайминг-бюджеты)
- [ЧАСТЬ 4: FLOW-A / FLOW-B — Gate & Clock](#часть-4-gate-и-clock)
- [ЧАСТЬ 5: FLOW-C / FLOW-D — Local Ack & Impact](#часть-5-ack-и-impact)
- [ЧАСТЬ 6: FLOW-E / FLOW-F — Supers & Hit-Stop](#часть-6-supers-и-hit-stop)
- [ЧАСТЬ 7: FLOW-G — Phase Cadence](#часть-7-phase-cadence)
- [ЧАСТЬ 8: Cursor Prompts & Critic Loop](#часть-8-cursor-prompts)
- [ЧАСТЬ 9: Test Plan](#часть-9-test-plan)

---

## ПРИОРИТЕТ ДОКУМЕНТОВ (ОБЯЗАТЕЛЬНО)

```
1. TZ v4 (этот файл) — presentation sync / action gate / feeling
2. TZ v3 (world-order-ability-animations-tz-v3.md) — визуальный язык epic/legendary
3. TZ v2 (world-order-ui-gameplay-tz-v2.md) — UI/HUD/art; callout durations УСТУПАЮТ v4

Конфликт:
  TZ v2: epic callout 3000ms / legendary 5000ms перед эффектом
  TZ v4: ОТМЕНЯЕТ блокирующие rarity-callout перед impact/cinematic.
          Название карты живёт внутри text slam (v3) или ≤400ms parallel chip.
```

Визуальный язык flash / impact lines / text slam / unique effects — **не переписывать**.  
Меняется только **когда** они запускаются и **когда** игроку снова разрешён ввод.

---

## ЧАСТЬ 0: ДИАГНОЗ И РЕФЕРЕНСЫ

### 0.1 Симптом (текущий билд)

```
Игрок разыгрывает карту(ы) → жмёт Pass / играет следующий раунд →
HP/энергия на сервере уже изменились →
а очередь анимаций (callout 3–5s + flip + cinematic + damage)
всё ещё доигрывает предыдущий resolve.

Ощущение: «я уже в следующем ходе, а кино ещё из прошлого».
Это анти-STS и анти-fighting-game.
```

### 0.2 Корневые причины (код на момент TZ)

| # | Файл | Проблема |
|---|------|----------|
| 1 | `components/game-board.tsx` | `canInteract` = phase + !submitted. **Не** смотрит на очередь / presentation idle |
| 2 | `components/game/hand-zone.tsx` | `playable = canInteract && !playing` — `playing` только network in-flight |
| 3 | `components/game/animation-provider.tsx` | Серийная очередь; epic/legendary получают длинный callout **до** objection |
| 4 | `lib/game/art.ts` `getRarityCalloutDurationMs` | epic 3000 / legendary 5000 — блокирует feeling |
| 5 | `lib/animations/store.ts` `isAnimationLocked` | Лок только на время GSAP cinematic, не на всю presentation batch |
| 6 | `lib/three/effect-store.ts` `hitStopUntil` | Пишется на crit, **ни один `useFrame` не читает** |
| 7 | Solo poll ~3s | Усиливает десинхрон «ход → потом визуал» |

### 0.3 Эталон: Slay the Spire — анатомия одного card play

```
STS делает одно правило без исключений:

  Клик по карте
    → мгновенный local ack (карта улетает / рука перестраивается)
    → resolve beat (удар / щит / статус) на цели
    → цифры / иконки
    → ТОЛЬКО ПОТОМ рука снова интерактивна

Игрок физически не может «уйти вперёд» визуала.
Очереди анимаций через несколько ходов — запрещены дизайном.
```

### 0.4 Эталон: Guilty Gear Strive — punctuation

```
GGS добавляет:
  - Input lock на время Overdrive / super
  - Super freeze (мир останавливается) в момент удара
  - Короткий return (300–400ms) — выход не рвёт ритм
  - Иерархия: normal < special < super (по ощущению длительности)

Для World Order:
  common/rare  → STS micro-beat (≤900–1200ms), gate locked
  epic         → GG mini-super (v3 ~1400ms) + impact, gate locked
  legendary    → GG full super (v3 ~2800ms) + impact, gate locked
```

### 0.5 Feeling matrix по фазам

| Фаза | Ожидание игрока | Правило v4 |
|------|-----------------|------------|
| energy_recovery | Короткий refill pulse | ≤400ms, gate optional (можно auto) |
| card_draw | Карты влетают в руку | Draw flight ≤500ms; interact после |
| ability | Ability → callout+effect | Gate до конца ability presentation |
| **battle** | Play → see result → play again | **Жёсткий Resolve Batch Lock** |
| end_turn | Cleanup, не «хвост кино» | Batch предыдущего round обязан быть idle |

### 0.6 Anti-patterns (REJECT автоматически)

```
✗ HP/armor в HUD меняются ДО impact-кадра
✗ Pass / следующая карта доступны, пока queue.length > 0
✗ SkillCallout 3–5s стоит ПЕРЕД epic/legendary cinematic
✗ hitStopUntil выставлен, а arena bob и particles продолжают tick
✗ Два resolve batch в очереди одновременно (presentation debt > 0 rounds)
✗ «UI мёртв» без индикатора лока (рука не затемнена / нет wait cursor)
✗ Linear easing на impact; отсутствие return beat
```

### 0.7 Целевой loop (после v4)

```
Player click card
  → ActionGate: localAck (80–120ms flight)
  → Server action (parallel)
  → PresentationClock.beginBatch(resolveEvents)
  → ActionGate.lock (canInteract=false)
  → Beats: flip → (cinematic if epic+) → impact Three.js → settle
  → PresentationClock.idle
  → ActionGate.unlock (≤150ms after last beat)
  → Player may act again
```

---

## ЧАСТЬ 1: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА FLOW v4

### 1.1 Структура агентов

```
┌────────────────────────────────────────────────────────────────────────┐
│                     CURSOR ORCHESTRATOR v4 — GAME FLOW                 │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬─────┤
│ FLOW-A   │ FLOW-B   │ FLOW-C   │ FLOW-D   │ FLOW-E   │ FLOW-F   │FLOW-G│
│ Action   │ Present. │ Local    │ Impact   │ Super    │ Hit-Stop │Phase │
│ Gate     │ Clock    │ Card Ack │ Timeline │ Sync v3  │ + Camera │Cadence│
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴─────┤
│              FLOW-CRITIC: жёсткий director of game feel                │
│   Эталон: Slay the Spire card cadence + Guilty Gear Strive supers      │
│   Blind A/B. Принимает только 9.5+/10. Итерации без лимита.           │
└────────────────────────────────────────────────────────────────────────┘
```

**Порядок работы (строго):**
```
FLOW-B (Clock API) → FLOW-A (Gate wiring)
  → FLOW-C (Local Ack) → FLOW-D (Impact)
  → FLOW-E (Supers sync) → FLOW-F (Hit-stop)
  → FLOW-G (Phase cadence)
После КАЖДОГО агента → FLOW-CRITIC review.
Параллелить можно только независимые визуальные полировки внутри агента,
но контракты Clock/Gate должны быть приняты первыми.
```

### 1.2 Системный промпт FLOW-CRITIC

```
Ты — director of game feel, делавший pacing для Slay the Spire-likes
и input lock для fighting games. Твоя задача: проверять World Order
battle presentation sync.

ЭТАЛОН: Открой «Slay the Spire card play compilation» и
«Guilty Gear Strive overdrive / super freeze» — это твой внутренний стандарт.

КРИТЕРИИ (каждый 1–10, принимать только 9.5+):

  1. INPUT SYNC — может ли игрок действовать, пока предыдущий resolve
     ещё анимируется? Принять только «нет, gate держит».

  2. IMPACT FIRST — урон/лечение/блок видны в момент удара, а не после
     3-секундного callout? Принять только «impact в первом визуальном ударе».

  3. NO BACKLOG — после Pass / следующего раунда нет хвоста анимаций
     прошлого resolve? Принять только «queue debt = 0».

  4. HUD TRUTH — HP/energy/armor не прыгают раньше impact-кадра
     (или есть staged presentation buffer)? Принять только «правда на экране».

  5. HIT STOP REAL — на crit arena/characters/particles реально замирают
     на ~100ms в Three.js clock? Принять только если useFrame уважает hitStop.

  6. CINEMATIC HIERARCHY — epic ощущается сильнее rare, legendary сильнее epic,
     но ordinary не раздут до super? Принять только «иерархия очевидна».

  7. RETURN TO PLAY — после batch unlock ≤150ms, без резкого обрыва
     и без «пустого зависания»? Принять только «300–400ms return feel ок».

  8. MOBILE 60FPS — presentation batch стабилен; при <50fps degrade
     (пропуск particles, не пропуск gate)? Принять только с замером.

  9. BLIND A/B — сравни клип STS и клип World Order ordinary play.
     Какой ритмичнее? Принять только если WO ≥ STS по ощущению синхрона
     (не обязательно по артам).

 10. REPLAY JOY — после 10 раундов подряд gate не бесит, а даёт уверенность?
     Принять только «хочу играть ещё».

ЕСЛИ ЛЮБОЙ < 9.5:
  Точный issue: файл + функция + timestamp beat + что не так.
  REJECT → агент чинит → повторный review.
  БЕЗ ЛИМИТА итераций.

ПРИНЯТЬ только:
  "APPROVED — FLOW-[X] — [score]/10 по всем критериям"
```

### 1.3 Правило ультракода

```
Каждый агент:
  1. Реализует ТОЛЬКО свой контур (не трогает чужие файлы без нужды)
  2. После реализации — сам прогоняет checklist
  3. Передаёт FLOW-CRITIC
  4. При REJECT — правит и повторяет до APPROVED
  5. Не объявляет «готово» без строки APPROVED от CRITIC

Оркестратор не переходит к следующему агенту,
пока текущий не APPROVED.
```

---

## ЧАСТЬ 2: АРХИТЕКТУРА PRESENTATION CLOCK

### 2.1 Главный принцип

```
Server state may advance immediately.
Player INPUT may not.

PresentationClock is the single source of truth for:
  - whether the board accepts battle/ability input
  - when beats start/end
  - when HUD staged values commit to visible numbers (optional buffer)

AnimationProvider becomes a beat producer for the Clock,
not an unbounded fire-and-forget queue that races the hand.
```

### 2.2 Новые модули

```
lib/game-flow/PresentationClock.ts   — batch + beats + idle signals
lib/game-flow/ActionGate.ts          — canPlayerAct derived from clock
lib/game-flow/presentationStore.ts   — zustand: idle/busy, batchId, reason
hooks/useGameFlowGate.ts             — React bridge for GameBoard/HandZone
```

### 2.3 PresentationClock — контракт

```typescript
// lib/game-flow/PresentationClock.ts

export type BeatKind =
  | "local_ack"
  | "card_flip"
  | "cinematic"      // epic/legendary TZ v3 orchestrator
  | "category"       // attack/defense/support overlay
  | "impact"         // damage/heal/block/energy Three.js
  | "callout_chip"   // ≤400ms, NEVER blocks before cinematic
  | "phase_banner"
  | "settle";

export interface PresentationBeat {
  id: string;
  kind: BeatKind;
  durationMs: number;          // hard budget ceiling
  run: () => Promise<void>;    // resolves when visual complete
  parallelGroup?: string;      // beats with same group may overlap
}

export interface PresentationBatch {
  id: string;
  source: "round_resolve" | "turn_resolution" | "ability" | "local";
  roundKey: string;            // `${matchId}:${turn}:${resolveSeq}`
  beats: PresentationBeat[];
}

/**
 * Rules:
 * 1. Only ONE active batch at a time (no multi-round debt).
 * 2. beginBatch while busy → wait for idle, then start (never stack rounds).
 * 3. onIdle fires when active batch fully drained.
 * 4. isIdle === true ⇔ gate may allow input (plus phase rules).
 */
export interface PresentationClock {
  readonly isIdle: boolean;
  readonly activeBatchId: string | null;

  beginBatch(batch: Omit<PresentationBatch, "id"> & { id?: string }): Promise<void>;
  enqueueBeat(beat: PresentationBeat): void; // only into active batch
  waitUntilIdle(): Promise<void>;
  onIdle(cb: () => void): () => void;

  /** Emergency: kill visuals + mark idle (disconnect / match end) */
  hardReset(): void;
}

export const presentationClock: PresentationClock;
```

### 2.4 ActionGate — контракт

```typescript
// lib/game-flow/ActionGate.ts
import { presentationClock } from "./PresentationClock";

export type GateReason =
  | "idle"
  | "presentation_busy"
  | "network_playing"
  | "phase_locked"
  | "already_submitted"
  | "match_over";

export interface ActionGateState {
  canAct: boolean;
  reason: GateReason;
  softLockVisual: boolean; // dim hand / wait cursor
}

export function getBattleGate(input: {
  phaseAllowsBattle: boolean;
  hasSubmitted: boolean;
  networkPlaying: boolean;
  matchFinished: boolean;
}): ActionGateState {
  if (input.matchFinished) {
    return { canAct: false, reason: "match_over", softLockVisual: false };
  }
  if (!input.phaseAllowsBattle) {
    return { canAct: false, reason: "phase_locked", softLockVisual: false };
  }
  if (input.hasSubmitted) {
    return { canAct: false, reason: "already_submitted", softLockVisual: false };
  }
  if (input.networkPlaying) {
    return { canAct: false, reason: "network_playing", softLockVisual: true };
  }
  if (!presentationClock.isIdle) {
    return { canAct: false, reason: "presentation_busy", softLockVisual: true };
  }
  return { canAct: true, reason: "idle", softLockVisual: false };
}
```

### 2.5 presentationStore (Zustand)

```typescript
// lib/game-flow/presentationStore.ts
import { create } from "zustand";

interface PresentationState {
  isIdle: boolean;
  activeBatchId: string | null;
  activeBeatKind: string | null;
  softLock: boolean;
  setBusy: (batchId: string, beatKind?: string) => void;
  setIdle: () => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  isIdle: true,
  activeBatchId: null,
  activeBeatKind: null,
  softLock: false,
  setBusy: (batchId, beatKind) =>
    set({
      isIdle: false,
      activeBatchId: batchId,
      activeBeatKind: beatKind ?? null,
      softLock: true,
    }),
  setIdle: () =>
    set({
      isIdle: true,
      activeBatchId: null,
      activeBeatKind: null,
      softLock: false,
    }),
}));
```

### 2.6 Интеграция в GameBoard (обязательная)

```typescript
// components/game-board.tsx — ИЗМЕНИТЬ формулу canInteract

import { usePresentationStore } from "@/lib/game-flow/presentationStore";
import { getBattleGate } from "@/lib/game-flow/ActionGate";

const isPresentationIdle = usePresentationStore((s) => s.isIdle);

const gate = getBattleGate({
  phaseAllowsBattle: match.phase === "battle" && match.status === "in_progress",
  hasSubmitted: Boolean(/* my card in battleRound */),
  networkPlaying: playing,
  matchFinished: match.status === "finished",
});

// HandZone:
canInteract={gate.canAct}
// плюс softLockVisual → className dim / pointer-events / aria-busy
```

### 2.7 AnimationProvider → производитель beats

```
БЫЛО:
  enqueueRoundEvents → безлимитный queue → player free

СТАЛО:
  round resolve events → PresentationClock.beginBatch({
    source: "round_resolve",
    beats: [
      flipBeat,
      cinematicBeat?,   // только epic/legendary, БЕЗ preceding 3–5s callout
      categoryBeat?,
      impactBeats...,
      settleBeat,
    ]
  })
  await batch complete ↔ store.isIdle

ЗАПРЕЩЕНО в buildRoundQueue для cinematic rarity:
  withCallout({ kind: "card_flip", rarity: "epic" }) // 3000ms blocker
РАЗРЕШЕНО:
  optional callout_chip ≤400ms в parallelGroup с flip
  OR name inside TextSlamLayer (TZ v3)
```

### 2.8 HUD Truth (staged values)

```
Проблема: setMatch(normalized) сразу показывает новый HP.

Решение v4 (обязательный минимум):
  A. Presentation-first gate (обязательно) — игрок не действует до визуала
  B. Staged HUD (рекомендуется в FLOW-D):
     - keep displayedHp/displayedArmor in local refs
     - commit to server values on impact beat start (not on setMatch)
     - energy can commit on cost ack (local)

Минимум для APPROVED FLOW-D: gate + impact numbers синхронны с mesh flash.
Полный staged HUD — критерий 4 (HUD TRUTH) на 9.5+.
```

---

## ЧАСТЬ 3: ТАЙМИНГ-БЮДЖЕТЫ

### 3.1 Жёсткие потолки (REJECT если превышены)

| Beat | Budget | Notes |
|------|--------|-------|
| local_ack flight | **80–120ms** | До ответа сервера |
| card_flip | **≤300ms** | Было 700ms — урезать |
| callout_chip | **≤400ms** | Parallel only; never before cinematic |
| ordinary resolve TOTAL | **≤900ms** | flip+impact+settle |
| rare resolve TOTAL | **≤1200ms** | |
| epic cinematic | **1400ms** | Как TZ v3 `totalDuration` |
| epic + impact after | **+≤400ms** | |
| legendary cinematic | **2800ms** | Как TZ v3 |
| legendary + impact | **+≤500ms** | |
| category overlay | **≤400ms** | Можно parallel с impact settle |
| damage/heal number | **≤400ms** | |
| crit hit-stop | **100ms** | Real Three.js freeze |
| return-to-input | **≤150ms** | После последнего beat |
| phase banner | **≤700ms** | Не блокирует battle gate если phase уже battle |

### 3.2 Отмена старых callout durations для gate path

```typescript
// lib/game/art.ts — для presentation path НЕ использовать как gate blocker:

getRarityCalloutDurationMs:
  common: 1000  → chip max 400 if used
  rare: 2000    → chip max 400 if used
  epic: 3000    → FORBIDDEN before cinematic (use v3 text slam)
  legendary: 5000 → FORBIDDEN before cinematic

SkillCallout component may still exist for non-gate flourishes
ONLY if parallelGroup and ≤400ms.
```

### 3.3 Иерархия интенсивности (feeling)

```
common:  tap → small flash → number          (~600–900ms)
rare:    tap → brighter flash → number       (~900–1200ms)
epic:    tap → v3 cinematic 1.4s → impact    (~1800ms gated)
legendary: tap → v3 cinematic 2.8s → impact  (~3300ms gated)

Ordinary NEVER lasts as long as epic.
Epic MUST feel shorter/weaker than legendary.
```

---

## ЧАСТЬ 4: FLOW-A / FLOW-B — GATE И CLOCK

### 4.1 FLOW-B: PresentationClock (делать первым)

**Файлы:**
- `lib/game-flow/PresentationClock.ts`
- `lib/game-flow/presentationStore.ts`

**Обязательное поведение:**
```
□ Singleton clock, SSR-safe (no window at import for Node ws)
□ beginBatch serializes: if busy, await idle then run (no parallel rounds)
□ Beats run in order; parallelGroup may Promise.all within step
□ Every beat respects durationMs ceiling (Promise.race with timeout)
□ Timeout → log + continue (never stuck gate forever); safety ≤ budget+500ms
□ usePresentationStore mirrors isIdle for React
□ hardReset on match unmount / status finished
```

**Псевдокод runner:**

```typescript
async function runBatch(batch: PresentationBatch) {
  usePresentationStore.getState().setBusy(batch.id);
  try {
    // Group consecutive beats with same parallelGroup
    for (const step of groupBeats(batch.beats)) {
      usePresentationStore.getState().setBusy(batch.id, step[0].kind);
      await Promise.all(
        step.map((b) =>
          Promise.race([
            b.run(),
            sleep(b.durationMs + 500),
          ]),
        ),
      );
    }
  } finally {
    usePresentationStore.getState().setIdle();
  }
}
```

**CRITIC checklist FLOW-B:**
```
□ Spam beginBatch × 3 → выполняются строго последовательно
□ hardReset во время batch → isIdle true < 50ms
□ Нет memory leak listeners onIdle
```

### 4.2 FLOW-A: ActionGate wiring

**Файлы:**
- `lib/game-flow/ActionGate.ts`
- `hooks/useGameFlowGate.ts`
- `components/game-board.tsx`
- `components/game/hand-zone.tsx`
- `components/game/ability-phase-panel.tsx` (ability gate аналогично)

**Обязательное поведение:**
```
□ Battle HandZone.canInteract = gate.canAct
□ Pass / Завершить ход disabled когда !gate.canAct
□ Ability activate disabled когда presentation busy (ability batches)
□ softLockVisual: рука opacity 0.55 + saturate(0.7) + cursor wait
□ aria-busy=true на hand region
□ Spam-click во время busy → 0 дополнительных submit_card
□ Network `playing` и presentation busy оба блокируют
```

**CRITIC checklist FLOW-A:**
```
□ AI match: play card → resolve anim playing → Pass button disabled
□ После idle Pass снова доступен (если phase позволяет)
□ Blind test: игрок не может «убежать» от анимации
```

---

## ЧАСТЬ 5: FLOW-C / FLOW-D — LOCAL ACK & IMPACT

### 5.1 FLOW-C: Local Card Ack

**Файлы:**
- `hooks/use-card-play-animation.ts` (уже есть GSAP flight — подключить)
- `components/game/hand-zone.tsx`
- `components/game/ability-card-view.tsx`

**Последовательность:**
```
0ms    pointerdown/click на playable card
0–30ms scale punch / lift (Framer или GSAP)
30–120ms flight clone к центру поля / к played zone
parallel: sendAction(submit_card)
on server reject: snap-back card 200ms elastic + toast
on server accept: hand already removed / ghost removed
```

**Правила:**
```
□ Ack стартует ДО await network
□ Не ждёт PresentationClock batch (это отдельный local beat
   можно зарегистрировать как local_ack в clock OR fire-and-forget ≤120ms)
□ Если игрок кликнул во время softLock — ignore (gate)
□ Использовать существующий use-card-play-animation.ts если подходит
```

**CRITIC:**
```
□ Сравни с STS: карта должна «уйти из руки» мгновенно по ощущению
□ Нет двойного клика / двойного submit
```

### 5.2 FLOW-D: Impact timeline (ordinary / rare) — Three.js

**Файлы:**
- `components/game/battle-arena.tsx`
- `components/game/three/character-mesh.tsx`
- `components/game/three/particle-system.tsx`
- `components/game/three/damage-numbers.tsx`
- `lib/three/effect-store.ts`
- `components/game/animation-provider.tsx` (impact beats)

**Ordinary/rare batch template:**
```
0–300ms   card_flip / short flash
300ms     IMPACT FRAME:
            - mesh flash / knockback pose
            - floatDamageAt / heal number
            - burstAt particles
            - triggerShake
            - staged HUD commit (HP)
300–700ms numbers fly + settle
700–900ms settle beat → idle → unlock
```

**Rare отличия:** чуть ярче flash, +micro particles, total ≤1200ms.

**ЗАПРЕЩЕНО:**
```
✗ Ставить 1–5s SkillCallout перед impact
✗ Показывать цифры урона до mesh reaction
✗ Пускать следующий round presentation пока этот batch не idle
```

**CRITIC:**
```
□ Impact frame читается даже без звука
□ Ordinary < 900ms measured
□ Blind A/B vs STS damage number timing
```

---

## ЧАСТЬ 6: FLOW-E / FLOW-F — SUPERS & HIT-STOP

### 6.1 FLOW-E: Epic/Legendary sync с TZ v3

**Файлы:**
- `lib/animations/AbilityAnimationOrchestrator.ts` (не ломать visual language)
- `components/game/animation-provider.tsx`
- `hooks/useAbilityAnimation.ts`

**Batch template epic:**
```
0–100ms     optional pre-flash / local settle
100ms       begin cinematic = orchestrator.play(cardId, playerNum)
            (TZ v3 timeline ~1400ms; text slam = name, NO SkillCallout before)
1500ms      impact beats (damage/heal) ≤400ms
1900ms      settle → idle → unlock
```

**Batch template legendary:**
```
0–100ms     screen darken already inside v3
100ms       orchestrator.play legendary ~2800ms
2900ms      impact ≤500ms
3400ms      settle → unlock
```

**Правила:**
```
□ cinematicPlayed dedupe сохраняется
□ isAnimationLocked v3 работает ВНУТРИ cinematic beat
□ PresentationClock busy на ВЕСЬ batch (не только cinematic)
□ Удалить path: withCallout(card_flip epic) → 3s wait → objection
□ Category overlay после cinematic ≤400ms или parallel settle
```

**CRITIC:**
```
□ Hierarchy: rare < epic < legendary очевидна
□ Return 300–400ms feel после legendary
□ v3 flash/lines/slam не деградировали
```

### 6.2 FLOW-F: Real Three.js hit-stop

**Файлы:**
- `lib/three/effect-store.ts` (уже есть hitStopUntil)
- `components/game/three/character-mesh.tsx`
- `components/game/three/arena-environment.tsx`
- `components/game/three/particle-system.tsx`
- `components/game/three/damage-numbers.tsx`
- `components/game/battle-scene.tsx` (optional clock helper)

**Обязательная реализация:**

```typescript
// shared helper
export function getPresentationDelta(delta: number): number {
  const until = useGameEffectStore.getState().hitStopUntil;
  if (Date.now() < until) return 0;
  return delta;
}

// EVERY ambient/idle useFrame:
useFrame((_, delta) => {
  const d = getPresentationDelta(delta);
  if (d === 0) return; // frozen
  // ... bob, parallax, particle integrate with d
});
```

**Правила:**
```
□ Crit (damage >= 40): triggerHitStop(100)
□ During hit-stop: character idle bob STOPPED
□ During hit-stop: arena ambient STOPPED
□ During hit-stop: particle integration STOPPED (or frozen)
□ Damage number spawn may start at impact frame; motion can resume after stop
□ Camera shake may start at impact; peak during/after stop
□ НЕ подменять hit-stop CSS overlay alone — нужен Three clock freeze
```

**CRITIC:**
```
□ Записать 60fps scrub: на crit кадры арены одинаковы ~6 frames
□ Сравнить с GG hit-stop feel (коротко, чётко, не «лаг»)
```

---

## ЧАСТЬ 7: FLOW-G — PHASE CADENCE

### 7.1 Фазовые баннеры и таймер

**Файлы:**
- `components/game/phase-announcer.tsx`
- `components/game/turn-timer.tsx`
- `components/game-board.tsx`

**Правила:**
```
□ Phase banner ≤700ms, не создаёт presentation debt на battle input
  (если phase===battle и banner ещё играет — battle gate всё равно
   слушает resolve batches; banner не блокирует бесконечно)
□ Turn timer <15s: pulse urgency (scale/opacity), без emoji spam
□ End turn: гарантировать waitUntilIdle перед тем как UI покажет
   «можно ходить» в новом battle round
□ TransformScene / BattleIntro — собственные gates (уже modal);
   не конфликтовать с PresentationClock (hardReset или nested busy)
```

**CRITIC:**
```
□ Смена фазы не даёт кликнуть карту «сквозь» resolve
□ Таймер читается peripheral vision
```

---

## ЧАСТЬ 8: CURSOR PROMPTS & CRITIC LOOP

### 8.1 Мастер-промпт v4

```
Ты реализуешь Game Flow Feeling v4 в World Order.

ЭТАЛОН: Slay the Spire card cadence + Guilty Gear Strive supers.
СТЕК: Three.js R3F + GSAP 3 + Framer Motion + Zustand
ДОКУМЕНТЫ:
  - info/world-order-game-flow-feeling-tz-v4.md  (ЭТОТ — приоритет sync)
  - info/world-order-ability-animations-tz-v3.md (visual language supers)
  - info/world-order-ui-gameplay-tz-v2.md        (UI; callout timings уступают v4)

ГЛАВНОЕ ПРАВИЛО:
  Игрок НЕ получает следующий ввод, пока presentation batch не idle.
  Анимации НЕ догоняют игрока — игрок ждёт ритм игры (приятно, коротко).

ПОРЯДОК:
  FLOW-B → FLOW-A → FLOW-C → FLOW-D → FLOW-E → FLOW-F → FLOW-G
  После каждого — FLOW-CRITIC. Только 9.5+/10.

НЕ ЛОМАТЬ:
  - TZ v3 orchestrator visual layers
  - Server authoritative rules (только client presentation/gate)
```

### 8.2 Промпт FLOW-B

```
ЗАДАЧА FLOW-B: PresentationClock + presentationStore

Файлы:
  - lib/game-flow/PresentationClock.ts
  - lib/game-flow/presentationStore.ts

По ЧАСТИ 2 и 4.1 TZ v4.

Проверить:
  □ Один active batch
  □ beginBatch во время busy ждёт idle
  □ safety timeout на beat
  □ hardReset
  □ React store sync isIdle

CRITIC: unit/manual spam test. APPROVED только 9.5+.
```

### 8.3 Промпт FLOW-A

```
ЗАДАЧА FLOW-A: ActionGate + HandZone/GameBoard wiring

Файлы:
  - lib/game-flow/ActionGate.ts
  - hooks/useGameFlowGate.ts
  - components/game-board.tsx
  - components/game/hand-zone.tsx
  - components/game/ability-phase-panel.tsx

Проверить:
  □ canInteract false пока !isIdle
  □ Pass disabled
  □ softLock visual
  □ spam click ignored

CRITIC: сыграй AI match, попробуй нажать Pass во время epic cinematic.
Принять только если невозможно.
```

### 8.4 Промпт FLOW-C

```
ЗАДАЧА FLOW-C: Local card ack 80–120ms

Подключить/доработать use-card-play-animation.ts в HandZone.
Ack до network. Snap-back на reject.

CRITIC: сравни с STS card yeet. Должно быть «сразу ушла».
```

### 8.5 Промпт FLOW-D

```
ЗАДАЧА FLOW-D: Ordinary/rare impact-first Three.js timeline

Убрать блокирующие rarity callouts из resolve path.
Бюджет ordinary ≤900ms, rare ≤1200ms.
Impact frame = mesh + numbers + particles вместе.

CRITIC: blind A/B vs STS. Impact first обязателен.
```

### 8.6 Промпт FLOW-E

```
ЗАДАЧА FLOW-E: Встроить TZ v3 orchestrator как cinematic beat в Clock

Запретить SkillCallout 3–5s перед objection.
Epic/legendary batch = cinematic + impact + settle под одним gate.

CRITIC: hierarchy + no backlog.
```

### 8.7 Промпт FLOW-F

```
ЗАДАЧА FLOW-F: Real hit-stop в useFrame (delta=0)

CharacterMesh, ArenaEnvironment, ParticleSystem обязаны замирать.
triggerHitStop(100) на crit.

CRITIC: frame scrub proof.
```

### 8.8 Промпт FLOW-G

```
ЗАДАЧА FLOW-G: Phase cadence + timer urgency + idle before next round UX

Не дать end_turn/new battle показать interactivity до waitUntilIdle.

CRITIC: phase transitions clean.
```

### 8.9 Финальный Critic Loop

```
ФИНАЛЬНЫЙ REVIEW — GAME FLOW FEELING v4:

Прогнать сценарии:
  1) Ordinary damage card × 5 подряд
  2) Epic card then immediate attempt Pass
  3) Legendary card then attempt next card
  4) Crit ≥40 damage
  5) Full turn with AI opponent, 3 battle rounds

Для каждого ответить:

  A. SYNC — «Анимации когда-либо догоняли уже следующий ввод?»
     Принять только «никогда»

  B. STS TEST — «Если выключить арт, ритм похож на STS?»
     Принять только «да»

  C. GG TEST — «Supers лочат ввод и отпускают чисто?»
     Принять только «да»

  D. JOY — «После 10 раундов gate бесит или даёт уверенность?»
     Принять только «уверенность»

ЕСЛИ ЛЮБОЙ FAIL → указать агента → fix → re-review.

ПРИНЯТЬ только когда ALL scenarios A+B+C+D.

Финальная запись: "GAME FLOW FEELING v4 — PRODUCTION READY"
```

---

## ЧАСТЬ 9: TEST PLAN

### 9.1 Функциональные проверки

| # | Шаг | Ожидание |
|---|-----|----------|
| 1 | AI match, ordinary attack | Impact ≤900ms; нельзя кликнуть другую карту до unlock |
| 2 | Spam-click hand mid-resolve | 0 лишних submit |
| 3 | Play epic | Нет 3s callout до cinematic; gate на весь batch |
| 4 | During epic try Pass | Кнопка disabled / ignore |
| 5 | Play legendary | ~2.8s cinematic + impact; затем unlock |
| 6 | Crit ≥40 | Видимый freeze arena/bob ~100ms |
| 7 | 3 resolves подряд | Нет хвоста анимаций в 4-й интерактивный момент |
| 8 | Server reject card | Snap-back; gate не залип |
| 9 | Match finished mid-batch | hardReset; UI результата |
| 10 | Soft lock visual | Рука затемнена, не «мёртвый экран без feedback» |

### 9.2 Перф

```
□ Chrome Performance: batch ordinary ≥50fps average
□ При деградации: сначала режем particle count, НЕ gate
□ Нет утечек GSAP timelines (kill on batch end)
```

### 9.3 Регрессии TZ v3

```
□ FlashFreeze / ImpactLines / TextSlam / UniqueEffects живы
□ orchestrator.play всё ещё вызывается для epic/legendary
□ Character poses на impact lines sync
```

### 9.4 Definition of Done

```
ALL FLOW-A…G = APPROVED CRITIC 9.5+
Финальный loop 8.9 пройден
Запись в PR/changelog: GAME FLOW FEELING v4 — PRODUCTION READY

Код-флаги готовности:
  - usePresentationStore.isIdle управляет HandZone
  - getPresentationDelta используется в ≥3 useFrame loops
  - animation-provider не делает withCallout rarity epic/legendary перед cinematic
```

---

## ПРИЛОЖЕНИЕ A: Карта файлов

| Действие | Путь |
|----------|------|
| CREATE | `lib/game-flow/PresentationClock.ts` |
| CREATE | `lib/game-flow/ActionGate.ts` |
| CREATE | `lib/game-flow/presentationStore.ts` |
| CREATE | `hooks/useGameFlowGate.ts` |
| EDIT | `components/game-board.tsx` |
| EDIT | `components/game/hand-zone.tsx` |
| EDIT | `components/game/animation-provider.tsx` |
| EDIT | `components/game/ability-phase-panel.tsx` |
| EDIT | `components/game/battle-arena.tsx` |
| EDIT | `components/game/three/character-mesh.tsx` |
| EDIT | `components/game/three/arena-environment.tsx` |
| EDIT | `components/game/three/particle-system.tsx` |
| EDIT | `lib/three/effect-store.ts` (helper export ok) |
| REUSE | `lib/animations/*` (TZ v3 — visual only) |
| REUSE | `hooks/use-card-play-animation.ts` |

---

## ПРИЛОЖЕНИЕ B: Быстрый «не делай так»

```
НЕ:
  setQueue([...prev, ...huge]) пока игрок свободно ходит
  getRarityCalloutDurationMs("legendary") как await перед эффектом
  считать isAnimationLocked достаточным gate для всей игры
  triggerHitStop без потребителей delta
  «ускорить всё в 10 раз» вместо правильного gate
  ломать server engine ради клиента

ДА:
  PresentationClock batch ↔ ActionGate
  Impact-first ordinary beats
  v3 cinematic as gated super beat
  Real Three.js hit-stop
  Soft lock UX
  Critic loop до 9.5+
```

---

*World Order — TZ v4.0: Game Flow Feeling*  
*Эталон: Slay the Spire cadence × Guilty Gear Strive input lock*  
*Приоритет: presentation sync > legacy callout durations*  
*7 FLOW agents + FLOW-CRITIC — принимать только после финального Critic Loop*
