# WORLD ORDER — TZ v3.0: ABILITY ANIMATIONS
## Epic & Legendary Card Cinematic System — Ace Attorney Edition
> Стандарт: Ace Attorney «OBJECTION!» × Guilty Gear Strive super freeze × JoJo's Bizarre Adventure
> Движок: Three.js r160 + GSAP 3 + Framer Motion + custom GLSL shaders
> Режим Cursor: Multi-Agent + Critic Loop (принимать только 9.5+/10)
>
> **Связь с TZ v4:** визуальный язык cinematic (flash / lines / slam / unique effects)
> остаётся здесь. Когда cinematic запускается и когда игроку снова разрешён ввод —
> определяет [`world-order-game-flow-feeling-tz-v4.md`](./world-order-game-flow-feeling-tz-v4.md)
> (Action-Locked Presentation). Не ставить блокирующий SkillCallout 3–5s перед orchestrator.play.

---

## СОДЕРЖАНИЕ

- [ЧАСТЬ 0: Референсный анализ](#часть-0-референсный-анализ)
- [ЧАСТЬ 1: Мульти-агентная система v3](#часть-1-мульти-агентная-система)
- [ЧАСТЬ 2: Архитектура анимационной системы](#часть-2-архитектура)
- [ЧАСТЬ 3: Базовые слои анимации](#часть-3-базовые-слои)
- [ЧАСТЬ 4: Epic-карты — анимации](#часть-4-epic-анимации)
- [ЧАСТЬ 5: Legendary-карты — кинематика](#часть-5-legendary-анимации)
- [ЧАСТЬ 6: GLSL-шейдеры](#часть-6-шейдеры)
- [ЧАСТЬ 7: Уникальные анимации по персонажам](#часть-7-персонажи)
- [ЧАСТЬ 8: Cursor Prompts & Critic Loop](#часть-8-cursor-prompts)

---

## ЧАСТЬ 0: РЕФЕРЕНСНЫЙ АНАЛИЗ

### 0.1 Ace Attorney «OBJECTION!» — анатомия момента

```
Ace Attorney делает одно точное действие: берёт один момент
и растягивает его в полноэкранное кинематографическое событие.

Временная линия "OBJECTION!" (1200ms):

  0ms   → экран мгновенно чернеет (flash frame)
  30ms  → персонаж врывается в кадр сбоку — жёсткий слайд
 100ms  → УДАР по столу / жест — freeze frame + white flash
 150ms  → "OBJECTION!" врезается в экран:
            - буквы набегают справа с трением (elastic ease)
            - обводка нарастает ПОСЛЕ основного текста
            - фоновая вспышка цвета персонажа
 400ms  → impact lines расходятся от точки удара
 600ms  → тряска затухает, персонаж "дышит"
 800ms  → текст карточки появляется снизу вверх
1200ms  → сцена возвращается к нормальному виду

Ключевые элементы:
  1. FREEZE FRAME — мир останавливается на доли секунды
  2. SLAM TEXT — текст не "появляется", он врезается
  3. IMPACT LINES — манга-стиль, расходятся от центра
  4. COLOR IDENTITY — вспышка цвета конкретного персонажа
  5. SOUND STING — звук короткий и точный (реализуем через Web Audio)
  6. RETURN — выход из момента не менее важен, чем вход
```

### 0.2 Матрица интенсивности по редкости

| Редкость | Заморозка | Вспышка | Impact Lines | Текст | Партиклы | Длительность |
|----------|-----------|---------|--------------|-------|----------|--------------|
| common | — | нет | нет | нет | нет | — |
| rare | — | микро | нет | нет | малые | — |
| **epic** | 80ms | средняя | да (тонкие) | название | средние | **1400ms** |
| **legendary** | 160ms | полный экран | да (жирные) | full-screen | мощные | **2800ms** |

### 0.3 Guilty Gear Strive: что добавить сверху

```
GGS добавляет к концепции:
  - "Super freeze" — игра буквально останавливается
  - Силуэт персонажа на цветном фоне (название приёма)
  - Цветные полосы за движущимся персонажем
  - "COUNTER!" / "PUNISH COUNTER!" текст со своим характером

Для World Order применяем:
  Epic    → мини-super-freeze (80ms) + impact lines + название
  Legendary → полный super-freeze (160ms) + силуэт + кинематика
```

---

## ЧАСТЬ 1: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА v3

### 1.1 Структура агентов (специализация на анимациях)

```
┌────────────────────────────────────────────────────────────────────┐
│                     CURSOR ORCHESTRATOR v3                         │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│ ANIM-A   │ ANIM-B   │ ANIM-C   │ ANIM-D   │ ANIM-E   │  ANIM-F   │
│ Flash &  │ Impact   │ Slam     │ Particle │ Character│ Per-Card  │
│ Freeze   │ Lines    │ Text     │ Bursts   │ Poses    │ Sequences │
│ System   │ Shader   │ System   │ (Three)  │ (Three)  │           │
├──────────┴──────────┴──────────┴──────────┴──────────┴────────────┤
│           ANIM-CRITIC: жёсткий арт-директор кат-сцен              │
│   Эталон: Ace Attorney Objection + Guilty Gear Overdrive           │
│   Принимает только 9.5/10. Итерирует без ограничений.             │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Системный промпт ANIM-CRITIC

```
Ты — арт-директор, отвечавший за кат-сцены в Street Fighter 6
и звуковой дизайн Ace Attorney. Твоя задача: проверять
анимации применения карт в World Order.

ЭТАЛОН: Открой YouTube, найди "Ace Attorney Objection compilation 4K"
и "Guilty Gear Strive super moves" — это твой внутренний стандарт.

КРИТЕРИИ (каждый 1-10, принимать только 9.5+):

  1. FREEZE IMPACT — мир останавливается В НУЖНЫЙ МОМЕНТ?
     Не до, не после, а именно тогда, когда кулак бьёт по столу.

  2. TEXT SLAM — текст врезается, а не появляется?
     Должна быть упругость (elastic), трение, обводка нарастает после.

  3. IMPACT LINES — линии исходят ИЗ ТОЧКИ действия, не из центра?
     Тонкие у epic, жирные у legendary. Радиус пропорционален силе.

  4. COLOR IDENTITY — вспышка ЦВЕТА ПЕРСОНАЖА, не просто белая?
     Рампф = красно-синий, Пу = тёмно-красный, Джин Ши = золото-красный,
     Зеленко = синий-золотой.

  5. TIMING CURVE — нарастание быстрое, спад медленный?
     ease-in на 20% времени, ease-out на 80%. Никогда linear.

  6. SILHOUETTE READ — узнаётся ли персонаж по силуэту?
     На 160ms freeze frame силуэт должен читаться однозначно.

  7. RETURN TO PLAY — выход из момента не разрушает погружение?
     Не резкий обрыв, не затянутое затухание. 300-400ms идеально.

  8. CARD IDENTITY — видна ли связь между картой и анимацией?
     "Ядерная кнопка" → должен быть гриб взрыва, не просто вспышка.

  9. PERFORMANCE — стабильные 60fps во время всей анимации?
     Замерить через requestAnimationFrame timing, скрыть если <50fps.

  10. REPLAYABILITY — хочется ли смотреть это снова?
      После 10-го применения не должно раздражать, но первый раз
      должен удивлять.

ЕСЛИ ЛЮБОЙ < 9.5:
  Точный issue: файл + функция + таймстамп + что именно не так.
  REJECT → агент исправляет → повторный ревью.
  БЕЗ ОГРАНИЧЕНИЯ по количеству итераций.

ПРИНЯТЬ только "APPROVED — [card-id] — [score]/10 по всем критериям"
```

---

## ЧАСТЬ 2: АРХИТЕКТУРА АНИМАЦИОННОЙ СИСТЕМЫ

### 2.1 Центральный оркестратор анимаций

```typescript
// lib/animations/AbilityAnimationOrchestrator.ts

import gsap from "gsap";
import { AnimationLayer } from "./layers";
import { CARD_ANIMATION_CONFIGS } from "./cardConfigs";
import { useAbilityAnimationStore } from "./store";

export type AnimationPhase =
  | "idle"
  | "card_lift"        // карта поднимается из руки
  | "super_freeze"     // мир останавливается
  | "flash"            // вспышка цвета
  | "impact_lines"     // линии расходятся
  | "text_slam"        // название врезается
  | "character_pose"   // персонаж принимает позу
  | "particle_burst"   // взрыв партиклей
  | "effect_apply"     // применение эффекта
  | "return";          // возврат к нормальному виду

export interface AbilityAnimationConfig {
  cardId: string;
  rarity: "epic" | "legendary";
  characterId: string;

  // Тайминги (ms)
  timing: {
    superFreezeDuration: number;    // 80 | 160
    flashDuration: number;          // 200 | 400
    textSlamDelay: number;          // когда врезается текст
    textSlamDuration: number;       // сколько длится slam
    particleBurstDelay: number;
    totalDuration: number;          // 1400 | 2800
  };

  // Визуал
  visual: {
    flashColor: string;             // цвет персонажа
    flashSecondaryColor: string;    // второй цвет (для градиента)
    impactLineColor: string;
    impactLineCount: number;        // 12 | 24
    impactLineWeight: number;       // 1 | 3
    particleColor: string;
    particleCount: number;          // 80 | 200
    particlePattern: "radial" | "spiral" | "explosion" | "rain";
    textStyle: "objection" | "announce" | "impact" | "whisper";
    characterAnimationType: string; // "point" | "slam" | "rise" | "charge"
  };

  // Уникальный эффект карты (GLSL preset или custom)
  uniqueEffect?: string;            // "mushroom_cloud" | "dragon_rise" | "trident_strike"
}

export class AbilityAnimationOrchestrator {
  private store = useAbilityAnimationStore.getState();
  private layers: Map<string, AnimationLayer> = new Map();
  private currentTimeline: gsap.core.Timeline | null = null;

  async play(
    cardId: string,
    targetPlayer: 1 | 2,
    onComplete: () => void
  ): Promise<void> {
    const config = CARD_ANIMATION_CONFIGS[cardId];
    if (!config) {
      // Для common/rare — просто применить без кинематики
      onComplete();
      return;
    }

    // Убить предыдущую анимацию если есть
    this.currentTimeline?.kill();

    // Заморозить игровую логику
    this.store.setAnimationLock(true);

    const tl = gsap.timeline({
      onComplete: () => {
        this.store.setAnimationLock(false);
        this.store.clearAllLayers();
        onComplete();
      }
    });

    this.currentTimeline = tl;

    if (config.rarity === "legendary") {
      await this.buildLegendarySequence(tl, config, targetPlayer);
    } else {
      await this.buildEpicSequence(tl, config, targetPlayer);
    }
  }

  private async buildEpicSequence(
    tl: gsap.core.Timeline,
    config: AbilityAnimationConfig,
    targetPlayer: 1 | 2
  ) {
    const { timing, visual } = config;

    tl
      // 1. Card lift из руки
      .call(() => this.store.setPhase("card_lift"))
      .to({}, { duration: timing.textSlamDelay / 1000 * 0.3 })

      // 2. Super freeze (80ms)
      .call(() => {
        this.store.setPhase("super_freeze");
        this.store.triggerFreeze(timing.superFreezeDuration);
      })
      .to({}, { duration: timing.superFreezeDuration / 1000 })

      // 3. Flash + Impact lines (одновременно)
      .call(() => {
        this.store.setPhase("flash");
        this.store.triggerFlash(visual.flashColor, timing.flashDuration);
        this.store.triggerImpactLines({
          color: visual.impactLineColor,
          count: visual.impactLineCount,
          weight: visual.impactLineWeight,
          duration: timing.flashDuration * 1.2,
          originPlayer: targetPlayer === 1 ? 2 : 1, // атакующий
        });
      })
      .to({}, { duration: timing.flashDuration / 1000 * 0.4 })

      // 4. Text slam
      .call(() => {
        this.store.setPhase("text_slam");
        this.store.triggerTextSlam({
          text: config.cardId, // будет resolved к display name
          style: visual.textStyle,
          color: visual.flashColor,
        });
      })
      .to({}, { duration: timing.textSlamDuration / 1000 })

      // 5. Particle burst
      .call(() => {
        this.store.setPhase("particle_burst");
        this.store.triggerParticleBurst({
          color: visual.particleColor,
          count: visual.particleCount,
          pattern: visual.particlePattern,
          targetPlayer,
        });
      })
      .to({}, { duration: 0.3 })

      // 6. Return
      .call(() => this.store.setPhase("return"))
      .to({}, { duration: 0.35 });
  }

  private async buildLegendarySequence(
    tl: gsap.core.Timeline,
    config: AbilityAnimationConfig,
    targetPlayer: 1 | 2
  ) {
    const { timing, visual } = config;

    tl
      // 1. Card lift + glow
      .call(() => this.store.setPhase("card_lift"))
      .to({}, { duration: 0.2 })

      // 2. Super freeze (160ms) — мощнее чем epic
      .call(() => {
        this.store.setPhase("super_freeze");
        this.store.triggerFreeze(timing.superFreezeDuration);
        // Дополнительно: весь экран темнеет к черному
        this.store.triggerScreenDarken(0.9, timing.superFreezeDuration);
      })
      .to({}, { duration: timing.superFreezeDuration / 1000 })

      // 3. Silhouette reveal — персонаж на цветном фоне
      .call(() => {
        this.store.triggerSilhouette({
          characterId: config.characterId,
          backgroundColor: visual.flashColor,
          secondaryColor: visual.flashSecondaryColor,
          duration: 400,
        });
      })
      .to({}, { duration: 0.15 })

      // 4. МОЩНАЯ вспышка + жирные линии
      .call(() => {
        this.store.setPhase("flash");
        this.store.triggerFlash(visual.flashColor, timing.flashDuration, "legendary");
        this.store.triggerImpactLines({
          color: visual.impactLineColor,
          count: visual.impactLineCount,
          weight: visual.impactLineWeight,
          duration: timing.flashDuration * 1.5,
          originPlayer: targetPlayer === 1 ? 2 : 1,
          style: "legendary",
        });
      })
      .to({}, { duration: timing.flashDuration / 1000 * 0.35 })

      // 5. FULL SCREEN TEXT SLAM (Ace Attorney style)
      .call(() => {
        this.store.setPhase("text_slam");
        this.store.triggerFullscreenSlam({
          cardId: config.cardId,
          characterId: config.characterId,
          style: visual.textStyle,
          color: visual.flashColor,
          secondaryColor: visual.flashSecondaryColor,
        });
      })
      .to({}, { duration: timing.textSlamDuration / 1000 })

      // 6. Уникальный эффект карты
      .call(() => {
        if (config.uniqueEffect) {
          this.store.triggerUniqueEffect(config.uniqueEffect, {
            targetPlayer,
            color: visual.flashColor,
          });
        }
      })
      .to({}, { duration: 0.5 })

      // 7. Massive particle burst
      .call(() => {
        this.store.setPhase("particle_burst");
        this.store.triggerParticleBurst({
          color: visual.particleColor,
          count: visual.particleCount,
          pattern: visual.particlePattern,
          targetPlayer,
          secondary: visual.flashSecondaryColor,
        });
      })
      .to({}, { duration: 0.6 })

      // 8. Return (медленнее для legendary)
      .call(() => this.store.setPhase("return"))
      .to({}, { duration: 0.5 });
  }
}

export const orchestrator = new AbilityAnimationOrchestrator();
```

### 2.2 Zustand Store для анимаций

```typescript
// lib/animations/store.ts
import { create } from "zustand";

interface ImpactLinesConfig {
  color: string;
  count: number;
  weight: number;
  duration: number;
  originPlayer: 1 | 2;
  style?: "epic" | "legendary";
}

interface ParticleBurstConfig {
  color: string;
  count: number;
  pattern: "radial" | "spiral" | "explosion" | "rain" | "shockwave";
  targetPlayer: 1 | 2;
  secondary?: string;
}

interface TextSlamConfig {
  text: string;
  style: "objection" | "announce" | "impact" | "whisper";
  color: string;
}

interface FullscreenSlamConfig {
  cardId: string;
  characterId: string;
  style: string;
  color: string;
  secondaryColor: string;
}

interface SilhouetteConfig {
  characterId: string;
  backgroundColor: string;
  secondaryColor: string;
  duration: number;
}

interface AbilityAnimationState {
  // Состояния слоёв
  phase: AnimationPhase;
  isAnimationLocked: boolean;
  freezeActive: boolean;
  flashActive: boolean;
  flashColor: string;
  flashIntensity: number;
  impactLinesConfig: ImpactLinesConfig | null;
  particleBurstConfig: ParticleBurstConfig | null;
  textSlamConfig: TextSlamConfig | null;
  fullscreenSlamConfig: FullscreenSlamConfig | null;
  silhouetteConfig: SilhouetteConfig | null;
  uniqueEffect: { type: string; params: Record<string, unknown> } | null;
  screenDarkness: number;

  // Actions
  setPhase: (phase: AnimationPhase) => void;
  setAnimationLock: (locked: boolean) => void;
  triggerFreeze: (durationMs: number) => void;
  triggerFlash: (color: string, durationMs: number, style?: string) => void;
  triggerImpactLines: (config: ImpactLinesConfig) => void;
  triggerParticleBurst: (config: ParticleBurstConfig) => void;
  triggerTextSlam: (config: TextSlamConfig) => void;
  triggerFullscreenSlam: (config: FullscreenSlamConfig) => void;
  triggerSilhouette: (config: SilhouetteConfig) => void;
  triggerUniqueEffect: (type: string, params: Record<string, unknown>) => void;
  triggerScreenDarken: (opacity: number, durationMs: number) => void;
  clearAllLayers: () => void;
}

export const useAbilityAnimationStore = create<AbilityAnimationState>((set) => ({
  phase: "idle",
  isAnimationLocked: false,
  freezeActive: false,
  flashActive: false,
  flashColor: "#ffffff",
  flashIntensity: 0,
  impactLinesConfig: null,
  particleBurstConfig: null,
  textSlamConfig: null,
  fullscreenSlamConfig: null,
  silhouetteConfig: null,
  uniqueEffect: null,
  screenDarkness: 0,

  setPhase: (phase) => set({ phase }),
  setAnimationLock: (locked) => set({ isAnimationLocked: locked }),

  triggerFreeze: (durationMs) => {
    set({ freezeActive: true });
    setTimeout(() => set({ freezeActive: false }), durationMs);
  },

  triggerFlash: (color, durationMs, style = "epic") => {
    const intensity = style === "legendary" ? 1.0 : 0.7;
    set({ flashActive: true, flashColor: color, flashIntensity: intensity });
    setTimeout(() => set({ flashActive: false, flashIntensity: 0 }), durationMs);
  },

  triggerImpactLines: (config) => {
    set({ impactLinesConfig: config });
    setTimeout(() => set({ impactLinesConfig: null }), config.duration);
  },

  triggerParticleBurst: (config) => set({ particleBurstConfig: config }),

  triggerTextSlam: (config) => {
    set({ textSlamConfig: config });
    setTimeout(() => set({ textSlamConfig: null }), 1200);
  },

  triggerFullscreenSlam: (config) => {
    set({ fullscreenSlamConfig: config });
    setTimeout(() => set({ fullscreenSlamConfig: null }), 1800);
  },

  triggerSilhouette: (config) => {
    set({ silhouetteConfig: config });
    setTimeout(() => set({ silhouetteConfig: null }), config.duration + 300);
  },

  triggerUniqueEffect: (type, params) => {
    set({ uniqueEffect: { type, params } });
    setTimeout(() => set({ uniqueEffect: null }), 1000);
  },

  triggerScreenDarken: (opacity, durationMs) => {
    set({ screenDarkness: opacity });
    setTimeout(() => set({ screenDarkness: 0 }), durationMs);
  },

  clearAllLayers: () => set({
    phase: "idle",
    impactLinesConfig: null,
    particleBurstConfig: null,
    textSlamConfig: null,
    fullscreenSlamConfig: null,
    silhouetteConfig: null,
    uniqueEffect: null,
    screenDarkness: 0,
    flashActive: false,
  }),
}));
```

---

## ЧАСТЬ 3: БАЗОВЫЕ СЛОИ АНИМАЦИИ

### 3.1 ANIM-A: Super Freeze + Flash Layer

```typescript
// components/animations/FlashFreezeLayer.tsx
// Самый первый слой поверх всего. z-index: 9000.
// Реализует заморозку (pointer-events: none на игровое поле)
// и цветную вспышку.

"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { useEffect, useRef } from "react";

export function FlashFreezeLayer() {
  const {
    freezeActive,
    flashActive, flashColor, flashIntensity,
    screenDarkness,
  } = useAbilityAnimationStore();

  return (
    <>
      {/* Затемнение (legendary pre-flash) */}
      <motion.div
        animate={{ opacity: screenDarkness }}
        transition={{ duration: 0.08, ease: "easeIn" }}
        style={{
          position: "fixed", inset: 0,
          background: "#000",
          pointerEvents: "none",
          zIndex: 8999,
        }}
      />

      {/* Flash overlay */}
      <AnimatePresence>
        {flashActive && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: flashIntensity }}
            exit={{
              opacity: 0,
              transition: { duration: 0.3, ease: "easeOut" }
            }}
            style={{
              position: "fixed", inset: 0,
              background: `radial-gradient(ellipse at center, 
                ${flashColor}FF 0%, 
                ${flashColor}88 40%, 
                ${flashColor}00 70%)`,
              pointerEvents: "none",
              zIndex: 9100,
              mixBlendMode: "screen",
            }}
          />
        )}
      </AnimatePresence>

      {/* White border flash (Ace Attorney style) */}
      <AnimatePresence>
        {flashActive && (
          <motion.div
            key="border-flash"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
              transition: { duration: 0.12, times: [0, 0.3, 1] }
            }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0,
              border: `4px solid ${flashColor}`,
              pointerEvents: "none",
              zIndex: 9101,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
```

### 3.2 ANIM-B: Impact Lines (ThreeJS ShaderMaterial)

```typescript
// components/animations/ImpactLinesLayer.tsx
// Линии расходятся из точки персонажа-атакующего — как в манге

import { useRef, useEffect } from "react";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import gsap from "gsap";

// Нативный Canvas (быстрее чем DOM-элементы для 24 линий)
export function ImpactLinesLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useAbilityAnimationStore(s => s.impactLinesConfig);
  const animRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Точка origin — персонаж атакующего
    const originX = config.originPlayer === 1
      ? canvas.width * 0.28   // левый персонаж
      : canvas.width * 0.72;  // правый персонаж
    const originY = canvas.height * 0.4;

    const angleStep = (Math.PI * 2) / config.count;
    let progress = { value: 0 };

    animRef.current = gsap.to(progress, {
      value: 1,
      duration: config.duration / 1000,
      ease: "power2.out",
      onUpdate: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = progress.value;

        // Opacity: нарастает быстро, затухает медленно
        const opacity = p < 0.3
          ? p / 0.3
          : 1 - ((p - 0.3) / 0.7);

        ctx.globalAlpha = opacity;

        for (let i = 0; i < config.count; i++) {
          const angle = angleStep * i + (Math.PI / config.count * 0.5); // offset для красоты
          const isThick = i % 3 === 0; // каждая третья линия толще

          // Длина линии нарастает
          const minRadius = 60;
          const maxRadius = canvas.width * 0.6;
          const currentRadius = minRadius + (maxRadius - minRadius) * p;

          // Ширина линии у origin тонкая, у конца нет
          const lineWeight = config.style === "legendary"
            ? (isThick ? config.weight * 2.5 : config.weight * 1.2)
            : (isThick ? config.weight * 1.5 : config.weight);

          ctx.beginPath();
          ctx.moveTo(
            originX + Math.cos(angle) * minRadius,
            originY + Math.sin(angle) * minRadius
          );
          ctx.lineTo(
            originX + Math.cos(angle) * currentRadius,
            originY + Math.sin(angle) * currentRadius
          );

          // Gradient stroke
          const gradient = ctx.createLinearGradient(
            originX + Math.cos(angle) * minRadius,
            originY + Math.sin(angle) * minRadius,
            originX + Math.cos(angle) * currentRadius,
            originY + Math.sin(angle) * currentRadius,
          );
          gradient.addColorStop(0, config.color + "FF");
          gradient.addColorStop(0.6, config.color + "CC");
          gradient.addColorStop(1, config.color + "00");

          ctx.strokeStyle = gradient;
          ctx.lineWidth = lineWeight;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      },
      onComplete: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    });

    return () => animRef.current?.kill();
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0,
        pointerEvents: "none",
        zIndex: 9200,
        mixBlendMode: "screen",
      }}
    />
  );
}
```

### 3.3 ANIM-C: Text Slam System

```typescript
// components/animations/TextSlamLayer.tsx
// "OBJECTION!"-стиль: текст врезается упруго, обводка нарастает после

import { motion, AnimatePresence } from "framer-motion";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { CARD_DISPLAY_NAMES } from "@/lib/game/data";

// Ace Attorney: текст летит справа, тормозит с упругостью
const SLAM_VARIANTS = {
  objection: {
    initial:  { x: "120%", scaleX: 1.4, opacity: 0 },
    animate:  { x: "0%",   scaleX: 1.0, opacity: 1 },
    exit:     { x: "-30%", opacity: 0, scaleX: 0.8 },
    transition: { type: "spring", stiffness: 600, damping: 22 },
  },
  announce: {
    initial:  { y: "-80px", scale: 0.6, opacity: 0 },
    animate:  { y: "0px",   scale: 1.0, opacity: 1 },
    exit:     { y: "40px",  scale: 0.8, opacity: 0 },
    transition: { type: "spring", stiffness: 500, damping: 18 },
  },
  impact: {
    initial:  { scale: 3, opacity: 0, rotate: -5 },
    animate:  { scale: 1, opacity: 1, rotate: 0 },
    exit:     { scale: 0.5, opacity: 0 },
    transition: { type: "spring", stiffness: 800, damping: 25 },
  },
};

export function TextSlamLayer() {
  const textSlamConfig = useAbilityAnimationStore(s => s.textSlamConfig);
  const fullscreenSlamConfig = useAbilityAnimationStore(s => s.fullscreenSlamConfig);

  return (
    <>
      {/* Epic: текст в нижней трети экрана */}
      <AnimatePresence>
        {textSlamConfig && (
          <EpicTextSlam config={textSlamConfig} />
        )}
      </AnimatePresence>

      {/* Legendary: полноэкранный слам */}
      <AnimatePresence>
        {fullscreenSlamConfig && (
          <LegendaryFullscreenSlam config={fullscreenSlamConfig} />
        )}
      </AnimatePresence>
    </>
  );
}

function EpicTextSlam({ config }) {
  const variants = SLAM_VARIANTS[config.style] ?? SLAM_VARIANTS.objection;
  const displayName = CARD_DISPLAY_NAMES[config.text] ?? config.text;

  return (
    <div style={{
      position: "fixed",
      left: 0, right: 0,
      bottom: "22%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      pointerEvents: "none",
      zIndex: 9300,
    }}>
      <motion.div
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={variants.transition}
        style={{ position: "relative" }}
      >
        {/* Тень-обводка (появляется с задержкой — Ace Attorney трюк) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          style={{
            position: "absolute",
            inset: 0,
            font: `900 52px 'Cinzel Decorative'`,
            color: "transparent",
            WebkitTextStroke: `6px rgba(0,0,0,0.8)`,
            textAlign: "center",
            letterSpacing: "4px",
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          {displayName}
        </motion.div>

        {/* Основной текст */}
        <div style={{
          font: `900 52px 'Cinzel Decorative'`,
          color: config.color,
          textAlign: "center",
          letterSpacing: "4px",
          textTransform: "uppercase",
          textShadow: `
            0 0 20px ${config.color},
            0 0 40px ${config.color}88,
            0 4px 8px rgba(0,0,0,0.8)
          `,
          userSelect: "none",
          position: "relative",
        }}>
          {displayName}
        </div>
      </motion.div>
    </div>
  );
}

function LegendaryFullscreenSlam({ config }) {
  const displayName = CARD_DISPLAY_NAMES[config.cardId] ?? config.cardId;

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 9400,
    }}>
      {/* Цветные полосы за текстом (Guilty Gear стиль) */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: 0, right: 0,
          top: "50%", transform: "translateY(-50%)",
          height: 160,
          background: `linear-gradient(135deg,
            ${config.color}00 0%,
            ${config.color}CC 20%,
            ${config.secondaryColor}CC 50%,
            ${config.color}CC 80%,
            ${config.color}00 100%)`,
          transformOrigin: "left center",
        }}
      />

      {/* Горизонтальные тёмные полосы (характерный Ace Attorney приём) */}
      {[-80, 80].map((offset, i) => (
        <motion.div
          key={i}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.08, delay: 0.02 * i }}
          style={{
            position: "absolute",
            left: 0, right: 0,
            top: `calc(50% + ${offset}px)`,
            height: 24,
            background: "rgba(0,0,0,0.7)",
            transformOrigin: offset < 0 ? "right center" : "left center",
          }}
        />
      ))}

      {/* Главный текст SLAM */}
      <motion.div
        initial={{ x: "110%", skewX: -15 }}
        animate={{ x: "0%", skewX: 0 }}
        transition={{ type: "spring", stiffness: 700, damping: 20 }}
        style={{ position: "relative", textAlign: "center" }}
      >
        {/* Mega outline — появляется чуть позже */}
        <motion.div
          initial={{ opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.06 }}
          style={{
            position: "absolute", inset: 0,
            font: `900 80px 'Cinzel Decorative'`,
            color: "transparent",
            WebkitTextStroke: `10px #000`,
            letterSpacing: "6px",
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          {displayName}
        </motion.div>

        {/* Основной текст */}
        <div style={{
          font: `900 80px 'Cinzel Decorative'`,
          color: "#FFFFFF",
          letterSpacing: "6px",
          textTransform: "uppercase",
          textShadow: `
            0 0 30px ${config.color},
            0 0 80px ${config.color}88,
            0 6px 12px rgba(0,0,0,0.9)
          `,
          userSelect: "none",
          position: "relative",
        }}>
          {displayName}
        </div>

        {/* Подзаголовок (имя персонажа / страна) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            font: `600 20px 'Rajdhani'`,
            color: config.color,
            letterSpacing: "8px",
            textTransform: "uppercase",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          {CHARACTER_TITLES[config.characterId]}
        </motion.div>
      </motion.div>
    </div>
  );
}

const CHARACTER_TITLES: Record<string, string> = {
  "donald-rumpf":   "🇺🇸  DONALD RUMPF",
  "vladimir-pu":    "🇷🇺  VLADIMIR PU",
  "jin-shi":        "🇨🇳  JIN SHI",
  "vlado-zelenko":  "🇺🇦  VLADO ZELENKO",
};
```

---

## ЧАСТЬ 4: EPIC-КАРТЫ — АНИМАЦИИ

### 4.1 Конфигурации всех epic-карт

```typescript
// lib/animations/cardConfigs.ts — EPIC SECTION

import { AbilityAnimationConfig } from "./AbilityAnimationOrchestrator";

export const CARD_ANIMATION_CONFIGS: Record<string, AbilityAnimationConfig> = {

  // ═══════════════ DONALD RUMPF EPIC ═══════════════

  "dr-executive": {
    cardId: "dr-executive",
    rarity: "epic",
    characterId: "donald-rumpf",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 220,
      textSlamDelay: 150,
      textSlamDuration: 900,
      particleBurstDelay: 250,
      totalDuration: 1400,
    },
    visual: {
      flashColor: "#1A3A6B",           // американский синий
      flashSecondaryColor: "#B22234",   // американский красный
      impactLineColor: "#FFFFFF",
      impactLineCount: 16,
      impactLineWeight: 1.5,
      particleColor: "#FFD700",
      particleCount: 90,
      particlePattern: "radial",
      textStyle: "objection",
      characterAnimationType: "point",  // Рампф указывает пальцем
    },
  },

  "dr-trade-war": {
    cardId: "dr-trade-war",
    rarity: "epic",
    characterId: "donald-rumpf",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 140,
      textSlamDuration: 850,
      particleBurstDelay: 220,
      totalDuration: 1350,
    },
    visual: {
      flashColor: "#B22234",
      flashSecondaryColor: "#1A3A6B",
      impactLineColor: "#FFD700",
      impactLineCount: 12,
      impactLineWeight: 1.2,
      particleColor: "#FFD700",
      particleCount: 75,
      particlePattern: "spiral",       // монеты разлетаются по спирали
      textStyle: "announce",
      characterAnimationType: "slam",
    },
  },

  "dr-veto": {
    cardId: "dr-veto",
    rarity: "epic",
    characterId: "donald-rumpf",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 250,
      textSlamDelay: 160,
      textSlamDuration: 950,
      particleBurstDelay: 280,
      totalDuration: 1450,
    },
    visual: {
      flashColor: "#FFFFFF",
      flashSecondaryColor: "#1A3A6B",
      impactLineColor: "#1A3A6B",
      impactLineCount: 20,
      impactLineWeight: 2.0,
      particleColor: "#FFFFFF",
      particleCount: 100,
      particlePattern: "shockwave",    // круговая ударная волна
      textStyle: "impact",
      characterAnimationType: "shield",
    },
  },

  "dr-fire": {
    cardId: "dr-fire",
    rarity: "epic",
    characterId: "donald-rumpf",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 130,
      textSlamDuration: 800,
      particleBurstDelay: 200,
      totalDuration: 1300,
    },
    visual: {
      flashColor: "#FF4500",
      flashSecondaryColor: "#FFD700",
      impactLineColor: "#FF6600",
      impactLineCount: 14,
      impactLineWeight: 1.5,
      particleColor: "#FF4500",
      particleCount: 85,
      particlePattern: "explosion",
      textStyle: "objection",          // "ВЫ УВОЛЕНЫ!" — самый Ace Attorney стиль
      characterAnimationType: "point",
    },
  },

  "dr-impeach": {
    cardId: "dr-impeach",
    rarity: "epic",
    characterId: "donald-rumpf",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 220,
      textSlamDelay: 150,
      textSlamDuration: 900,
      particleBurstDelay: 230,
      totalDuration: 1400,
    },
    visual: {
      flashColor: "#8B0000",
      flashSecondaryColor: "#1A3A6B",
      impactLineColor: "#FF4444",
      impactLineCount: 18,
      impactLineWeight: 1.8,
      particleColor: "#8B0000",
      particleCount: 95,
      particlePattern: "radial",
      textStyle: "announce",
      characterAnimationType: "slam",
    },
  },

  // ═══════════════ VLADIMIR PU EPIC ═══════════════

  "vp-bear": {
    cardId: "vp-bear",
    rarity: "epic",
    characterId: "vladimir-pu",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 240,
      textSlamDelay: 160,
      textSlamDuration: 950,
      particleBurstDelay: 260,
      totalDuration: 1450,
    },
    visual: {
      flashColor: "#CC0000",
      flashSecondaryColor: "#8B0000",
      impactLineColor: "#CC0000",
      impactLineCount: 20,
      impactLineWeight: 2.5,           // самые жирные линии у медведя
      particleColor: "#CC0000",
      particleCount: 110,
      particlePattern: "shockwave",
      textStyle: "impact",
      characterAnimationType: "charge",
    },
  },

  "vp-nerve": {
    cardId: "vp-nerve",
    rarity: "epic",
    characterId: "vladimir-pu",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 300,
      textSlamDelay: 200,
      textSlamDuration: 1000,
      particleBurstDelay: 300,
      totalDuration: 1500,
    },
    visual: {
      flashColor: "#4A9B4A",           // ядовито-зелёный
      flashSecondaryColor: "#1A4A1A",
      impactLineColor: "#7FFF00",
      impactLineCount: 16,
      impactLineWeight: 1.5,
      particleColor: "#7FFF00",
      particleCount: 120,
      particlePattern: "rain",         // капли яда падают сверху
      textStyle: "announce",
      characterAnimationType: "point",
    },
  },

  "vp-fortress": {
    cardId: "vp-fortress",
    rarity: "epic",
    characterId: "vladimir-pu",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 250,
      textSlamDelay: 160,
      textSlamDuration: 900,
      particleBurstDelay: 250,
      totalDuration: 1400,
    },
    visual: {
      flashColor: "#4A4A88",
      flashSecondaryColor: "#1A1A44",
      impactLineColor: "#AAAAFF",
      impactLineCount: 24,
      impactLineWeight: 1.0,
      particleColor: "#AAAAFF",
      particleCount: 80,
      particlePattern: "shockwave",
      textStyle: "impact",
      characterAnimationType: "shield",
    },
  },

  "vp-special-op": {
    cardId: "vp-special-op",
    rarity: "epic",
    characterId: "vladimir-pu",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 220,
      textSlamDelay: 140,
      textSlamDuration: 880,
      particleBurstDelay: 220,
      totalDuration: 1380,
    },
    visual: {
      flashColor: "#CC0000",
      flashSecondaryColor: "#660000",
      impactLineColor: "#FF2200",
      impactLineCount: 22,
      impactLineWeight: 2.0,
      particleColor: "#FF4400",
      particleCount: 100,
      particlePattern: "explosion",
      textStyle: "impact",
      characterAnimationType: "slam",
    },
  },

  "vp-cyber": {
    cardId: "vp-cyber",
    rarity: "epic",
    characterId: "vladimir-pu",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 130,
      textSlamDuration: 820,
      particleBurstDelay: 200,
      totalDuration: 1320,
    },
    visual: {
      flashColor: "#00FF88",           // хакерский зелёный
      flashSecondaryColor: "#003322",
      impactLineColor: "#00FF88",
      impactLineCount: 14,
      impactLineWeight: 1.2,
      particleColor: "#00FF88",
      particleCount: 85,
      particlePattern: "rain",         // цифры падают как матрица
      textStyle: "announce",
      characterAnimationType: "point",
    },
  },

  // ═══════════════ JIN SHI EPIC ═══════════════

  "js-dragon": {
    cardId: "js-dragon",
    rarity: "epic",
    characterId: "jin-shi",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 280,
      textSlamDelay: 180,
      textSlamDuration: 1000,
      particleBurstDelay: 280,
      totalDuration: 1480,
    },
    visual: {
      flashColor: "#DE2910",
      flashSecondaryColor: "#FFDE00",
      impactLineColor: "#FFDE00",
      impactLineCount: 20,
      impactLineWeight: 2.2,
      particleColor: "#FF6600",
      particleCount: 130,
      particlePattern: "spiral",       // дракон закручивается по спирали
      textStyle: "impact",
      characterAnimationType: "rise",
    },
  },

  "js-bri": {
    cardId: "js-bri",
    rarity: "epic",
    characterId: "jin-shi",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 220,
      textSlamDelay: 150,
      textSlamDuration: 900,
      particleBurstDelay: 240,
      totalDuration: 1400,
    },
    visual: {
      flashColor: "#FFDE00",
      flashSecondaryColor: "#DE2910",
      impactLineColor: "#FFD700",
      impactLineCount: 16,
      impactLineWeight: 1.5,
      particleColor: "#FFDE00",
      particleCount: 90,
      particlePattern: "radial",
      textStyle: "announce",
      characterAnimationType: "slam",
    },
  },

  "js-propaganda": {
    cardId: "js-propaganda",
    rarity: "epic",
    characterId: "jin-shi",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 240,
      textSlamDelay: 160,
      textSlamDuration: 940,
      particleBurstDelay: 260,
      totalDuration: 1440,
    },
    visual: {
      flashColor: "#CC1100",
      flashSecondaryColor: "#880000",
      impactLineColor: "#FF0000",
      impactLineCount: 18,
      impactLineWeight: 1.8,
      particleColor: "#FF0000",
      particleCount: 100,
      particlePattern: "radial",
      textStyle: "objection",          // пропаганда тоже врезается справа
      characterAnimationType: "point",
    },
  },

  "js-censure": {
    cardId: "js-censure",
    rarity: "epic",
    characterId: "jin-shi",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 130,
      textSlamDuration: 820,
      particleBurstDelay: 210,
      totalDuration: 1320,
    },
    visual: {
      flashColor: "#8B0000",
      flashSecondaryColor: "#1A0000",
      impactLineColor: "#CC0000",
      impactLineCount: 14,
      impactLineWeight: 1.3,
      particleColor: "#8B0000",
      particleCount: 70,
      particlePattern: "explosion",
      textStyle: "impact",
      characterAnimationType: "slam",
    },
  },

  // ═══════════════ VLADO ZELENKO EPIC ═══════════════

  "vz-counteroffensive": {
    cardId: "vz-counteroffensive",
    rarity: "epic",
    characterId: "vlado-zelenko",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 120,
      textSlamDuration: 800,
      particleBurstDelay: 200,
      totalDuration: 1300,
    },
    visual: {
      flashColor: "#005BBB",           // украинский синий
      flashSecondaryColor: "#FFD500",  // украинский жёлтый
      impactLineColor: "#FFD500",
      impactLineCount: 18,
      impactLineWeight: 1.8,
      particleColor: "#FFD500",
      particleCount: 110,
      particlePattern: "explosion",
      textStyle: "objection",
      characterAnimationType: "charge",
    },
  },

  "vz-bradley": {
    cardId: "vz-bradley",
    rarity: "epic",
    characterId: "vlado-zelenko",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 210,
      textSlamDelay: 130,
      textSlamDuration: 840,
      particleBurstDelay: 210,
      totalDuration: 1340,
    },
    visual: {
      flashColor: "#556B2F",           // оливковый (военный)
      flashSecondaryColor: "#8B6914",
      impactLineColor: "#CCAA44",
      impactLineCount: 16,
      impactLineWeight: 2.0,
      particleColor: "#8B6914",
      particleCount: 90,
      particlePattern: "shockwave",
      textStyle: "impact",
      characterAnimationType: "slam",
    },
  },

  "vz-azov": {
    cardId: "vz-azov",
    rarity: "epic",
    characterId: "vlado-zelenko",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 260,
      textSlamDelay: 170,
      textSlamDuration: 960,
      particleBurstDelay: 270,
      totalDuration: 1460,
    },
    visual: {
      flashColor: "#005BBB",
      flashSecondaryColor: "#FFFFFF",
      impactLineColor: "#FFFFFF",
      impactLineCount: 22,
      impactLineWeight: 2.5,
      particleColor: "#FFFFFF",
      particleCount: 100,
      particlePattern: "shockwave",
      textStyle: "impact",
      characterAnimationType: "shield",
    },
  },

  "vz-zelensky-on-air": {
    cardId: "vz-zelensky-on-air",
    rarity: "epic",
    characterId: "vlado-zelenko",
    timing: {
      superFreezeDuration: 80,
      flashDuration: 200,
      textSlamDelay: 120,
      textSlamDuration: 800,
      particleBurstDelay: 200,
      totalDuration: 1300,
    },
    visual: {
      flashColor: "#00AAFF",
      flashSecondaryColor: "#0055AA",
      impactLineColor: "#00AAFF",
      impactLineCount: 14,
      impactLineWeight: 1.2,
      particleColor: "#00AAFF",
      particleCount: 80,
      particlePattern: "radial",
      textStyle: "announce",
      characterAnimationType: "point",
    },
  },
};
```

---

## ЧАСТЬ 5: LEGENDARY-КАРТЫ — КИНЕМАТИКА

### 5.1 Уникальные ThreeJS-эффекты для legendary

```typescript
// lib/animations/cardConfigs.ts — LEGENDARY SECTION (продолжение)

// ═══════════════ RUMPF LEGENDARY ═══════════════

"dr-nuclear": {
  cardId: "dr-nuclear",
  rarity: "legendary",
  characterId: "donald-rumpf",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 600,
    textSlamDelay: 400,
    textSlamDuration: 1400,
    particleBurstDelay: 600,
    totalDuration: 2800,
  },
  visual: {
    flashColor: "#FF6600",
    flashSecondaryColor: "#FF2200",
    impactLineColor: "#FFFF00",
    impactLineCount: 32,
    impactLineWeight: 4.0,
    particleColor: "#FF6600",
    particleCount: 250,
    particlePattern: "explosion",
    textStyle: "impact",
    characterAnimationType: "slam",
  },
  uniqueEffect: "mushroom_cloud",
},

"dr-twitter-ban": {
  cardId: "dr-twitter-ban",
  rarity: "legendary",
  characterId: "donald-rumpf",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 500,
    textSlamDelay: 350,
    textSlamDuration: 1300,
    particleBurstDelay: 550,
    totalDuration: 2700,
  },
  visual: {
    flashColor: "#1DA1F2",            // Twitter синий
    flashSecondaryColor: "#000000",
    impactLineColor: "#1DA1F2",
    impactLineCount: 28,
    impactLineWeight: 3.0,
    particleColor: "#1DA1F2",
    particleCount: 200,
    particlePattern: "spiral",
    textStyle: "objection",
    characterAnimationType: "point",
  },
  uniqueEffect: "screen_blackout",
},

"dr-maga-phoenix": {
  cardId: "dr-maga-phoenix",
  rarity: "legendary",
  characterId: "donald-rumpf",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 700,
    textSlamDelay: 450,
    textSlamDuration: 1500,
    particleBurstDelay: 650,
    totalDuration: 3000,
  },
  visual: {
    flashColor: "#FF4500",
    flashSecondaryColor: "#FFD700",
    impactLineColor: "#FF8800",
    impactLineCount: 30,
    impactLineWeight: 3.5,
    particleColor: "#FF6600",
    particleCount: 280,
    particlePattern: "spiral",       // феникс закручивается
    textStyle: "announce",
    characterAnimationType: "rise",
  },
  uniqueEffect: "phoenix_rise",
},

// ═══════════════ PU LEGENDARY ═══════════════

"vp-sovereign": {
  cardId: "vp-sovereign",
  rarity: "legendary",
  characterId: "vladimir-pu",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 650,
    textSlamDelay: 420,
    textSlamDuration: 1450,
    particleBurstDelay: 620,
    totalDuration: 2900,
  },
  visual: {
    flashColor: "#CC0000",
    flashSecondaryColor: "#880000",
    impactLineColor: "#FF2200",
    impactLineCount: 36,             // самое большое количество линий
    impactLineWeight: 5.0,           // самые жирные
    particleColor: "#CC0000",
    particleCount: 300,
    particlePattern: "explosion",
    textStyle: "impact",
    characterAnimationType: "charge",
  },
  uniqueEffect: "mushroom_cloud",   // ядерный гриб, но советская эстетика
},

"vp-eternal": {
  cardId: "vp-eternal",
  rarity: "legendary",
  characterId: "vladimir-pu",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 550,
    textSlamDelay: 380,
    textSlamDuration: 1350,
    particleBurstDelay: 560,
    totalDuration: 2700,
  },
  visual: {
    flashColor: "#D4AF37",           // золото
    flashSecondaryColor: "#1A0000",
    impactLineColor: "#D4AF37",
    impactLineCount: 24,
    impactLineWeight: 3.0,
    particleColor: "#D4AF37",
    particleCount: 220,
    particlePattern: "radial",
    textStyle: "announce",
    characterAnimationType: "rise",
  },
  uniqueEffect: "clock_freeze",     // часы останавливаются
},

"vp-bearmode": {
  cardId: "vp-bearmode",
  rarity: "legendary",
  characterId: "vladimir-pu",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 600,
    textSlamDelay: 400,
    textSlamDuration: 1400,
    particleBurstDelay: 600,
    totalDuration: 2800,
  },
  visual: {
    flashColor: "#4A1A00",          // тёмно-коричневый
    flashSecondaryColor: "#CC0000",
    impactLineColor: "#885500",
    impactLineCount: 28,
    impactLineWeight: 4.5,
    particleColor: "#885500",
    particleCount: 250,
    particlePattern: "shockwave",
    textStyle: "impact",
    characterAnimationType: "charge",
  },
  uniqueEffect: "bear_roar",
},

// ═══════════════ JIN SHI LEGENDARY ═══════════════

"js-emperor": {
  cardId: "js-emperor",
  rarity: "legendary",
  characterId: "jin-shi",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 700,
    textSlamDelay: 450,
    textSlamDuration: 1500,
    particleBurstDelay: 680,
    totalDuration: 3000,
  },
  visual: {
    flashColor: "#FFDE00",
    flashSecondaryColor: "#DE2910",
    impactLineColor: "#FFD700",
    impactLineCount: 30,
    impactLineWeight: 3.5,
    particleColor: "#FFD700",
    particleCount: 280,
    particlePattern: "spiral",       // дракон-спираль
    textStyle: "announce",
    characterAnimationType: "rise",
  },
  uniqueEffect: "dragon_rise",
},

"js-eternal-rule": {
  cardId: "js-eternal-rule",
  rarity: "legendary",
  characterId: "jin-shi",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 600,
    textSlamDelay: 400,
    textSlamDuration: 1400,
    particleBurstDelay: 600,
    totalDuration: 2800,
  },
  visual: {
    flashColor: "#DE2910",
    flashSecondaryColor: "#FFDE00",
    impactLineColor: "#FF0000",
    impactLineCount: 32,
    impactLineWeight: 4.0,
    particleColor: "#DE2910",
    particleCount: 260,
    particlePattern: "radial",
    textStyle: "impact",
    characterAnimationType: "slam",
  },
  uniqueEffect: "great_wall",       // Великая стена поднимается
},

"js-century": {
  cardId: "js-century",
  rarity: "legendary",
  characterId: "jin-shi",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 650,
    textSlamDelay: 420,
    textSlamDuration: 1450,
    particleBurstDelay: 640,
    totalDuration: 2900,
  },
  visual: {
    flashColor: "#FFD700",
    flashSecondaryColor: "#DE2910",
    impactLineColor: "#FFD700",
    impactLineCount: 28,
    impactLineWeight: 3.5,
    particleColor: "#FF8800",
    particleCount: 240,
    particlePattern: "explosion",
    textStyle: "announce",
    characterAnimationType: "rise",
  },
  uniqueEffect: "dragon_fire",
},

"js-dragon-fire": {
  cardId: "js-dragon-fire",
  rarity: "legendary",
  characterId: "jin-shi",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 580,
    textSlamDelay: 380,
    textSlamDuration: 1380,
    particleBurstDelay: 580,
    totalDuration: 2760,
  },
  visual: {
    flashColor: "#FF6600",
    flashSecondaryColor: "#FFDE00",
    impactLineColor: "#FF4400",
    impactLineCount: 26,
    impactLineWeight: 3.8,
    particleColor: "#FF4400",
    particleCount: 230,
    particlePattern: "explosion",
    textStyle: "impact",
    characterAnimationType: "charge",
  },
  uniqueEffect: "dragon_fire",
},

// ═══════════════ ZELENKO LEGENDARY ═══════════════

"vz-slava": {
  cardId: "vz-slava",
  rarity: "legendary",
  characterId: "vlado-zelenko",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 550,
    textSlamDelay: 360,
    textSlamDuration: 1350,
    particleBurstDelay: 560,
    totalDuration: 2700,
  },
  visual: {
    flashColor: "#005BBB",
    flashSecondaryColor: "#FFD500",
    impactLineColor: "#FFD500",
    impactLineCount: 26,
    impactLineWeight: 3.0,
    particleColor: "#FFD500",
    particleCount: 220,
    particlePattern: "shockwave",
    textStyle: "objection",          // "СЛАВА УКРАЇНІ!" — самый Ace Attorney
    characterAnimationType: "charge",
  },
  uniqueEffect: "ukraine_flag",
},

"vz-iron-resolve": {
  cardId: "vz-iron-resolve",
  rarity: "legendary",
  characterId: "vlado-zelenko",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 600,
    textSlamDelay: 400,
    textSlamDuration: 1400,
    particleBurstDelay: 600,
    totalDuration: 2800,
  },
  visual: {
    flashColor: "#FFFFFF",
    flashSecondaryColor: "#005BBB",
    impactLineColor: "#FFFFFF",
    impactLineCount: 30,
    impactLineWeight: 2.5,
    particleColor: "#FFFFFF",
    particleCount: 240,
    particlePattern: "radial",
    textStyle: "impact",
    characterAnimationType: "rise",
  },
  uniqueEffect: "iron_shield",
},

"vz-trident": {
  cardId: "vz-trident",
  rarity: "legendary",
  characterId: "vlado-zelenko",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 620,
    textSlamDelay: 410,
    textSlamDuration: 1420,
    particleBurstDelay: 610,
    totalDuration: 2820,
  },
  visual: {
    flashColor: "#005BBB",
    flashSecondaryColor: "#FFD500",
    impactLineColor: "#FFD500",
    impactLineCount: 34,
    impactLineWeight: 4.0,
    particleColor: "#FFD500",
    particleCount: 270,
    particlePattern: "explosion",
    textStyle: "impact",
    characterAnimationType: "slam",
  },
  uniqueEffect: "trident_strike",
},

"vz-freedom": {
  cardId: "vz-freedom",
  rarity: "legendary",
  characterId: "vlado-zelenko",
  timing: {
    superFreezeDuration: 160,
    flashDuration: 700,
    textSlamDelay: 450,
    textSlamDuration: 1500,
    particleBurstDelay: 680,
    totalDuration: 3000,
  },
  visual: {
    flashColor: "#FFD500",
    flashSecondaryColor: "#005BBB",
    impactLineColor: "#FFFFFF",
    impactLineCount: 32,
    impactLineWeight: 3.5,
    particleColor: "#FFD500",
    particleCount: 300,
    particlePattern: "radial",
    textStyle: "announce",
    characterAnimationType: "rise",
  },
  uniqueEffect: "freedom_wave",
},
```

---

## ЧАСТЬ 6: GLSL-ШЕЙДЕРЫ

### 6.1 ANIM-D: Уникальные ThreeJS-эффекты

```typescript
// lib/animations/uniqueEffects/MushroomCloudEffect.tsx
// Ядерный гриб — для dr-nuclear и vp-sovereign

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function MushroomCloudEffect({ color = "#FF6600", position = [0, 0, 0] }) {
  const stemRef = useRef<THREE.Mesh>(null);
  const capRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current;

    // Стебель: растёт снизу вверх
    if (stemRef.current && t < 1.0) {
      stemRef.current.scale.y = Math.min(t * 2, 1);
      stemRef.current.position.y = -1 + stemRef.current.scale.y * 0.5;
    }

    // Шляпа: появляется и расширяется
    if (capRef.current && t > 0.4) {
      const capT = (t - 0.4) / 0.8;
      capRef.current.scale.setScalar(Math.min(capT * 2, 1.5));
      (capRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 1 - Math.max(0, t - 1.5));
    }
  });

  return (
    <group position={position as [number, number, number]}>
      {/* Стебель гриба */}
      <mesh ref={stemRef}>
        <cylinderGeometry args={[0.3, 0.5, 2, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>

      {/* Шляпа гриба */}
      <mesh ref={capRef} position={[0, 1.5, 0]}>
        <torusGeometry args={[1.5, 0.6, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Внутреннее свечение */}
      <pointLight position={[0, 1, 0]} color={color} intensity={5} distance={6} />
    </group>
  );
}
```

```typescript
// lib/animations/uniqueEffects/DragonRiseEffect.tsx
// Дракон поднимается — для js-emperor

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import gsap from "gsap";

export function DragonRiseEffect({ color = "#FFD700" }) {
  const dragonRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);
  const texture = useTexture("/assets/effects/dragon_silhouette.png");

  useEffect(() => {
    if (!dragonRef.current) return;
    dragonRef.current.position.y = -5;
    dragonRef.current.scale.setScalar(0);

    gsap.timeline()
      .to(dragonRef.current.position, { y: 0, duration: 0.6, ease: "power2.out" })
      .to(dragonRef.current.scale, { x: 3, y: 3, z: 3, duration: 0.4 }, 0)
      .to(dragonRef.current.material as THREE.Material, { opacity: 0, duration: 0.4 }, 1.2);
  }, []);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (dragonRef.current) {
      dragonRef.current.rotation.z = Math.sin(elapsed.current * 3) * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={dragonRef}>
        <planeGeometry args={[4, 4]} />
        <meshBasicMaterial
          map={texture}
          color={color}
          transparent
          alphaTest={0.01}
        />
      </mesh>
      <pointLight color={color} intensity={8} distance={8} position={[0, 1, 1]} />
    </group>
  );
}
```

### 6.2 GLSL: Shockwave Shader (для legendary ударных волн)

```glsl
// public/shaders/shockwave.vert
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

```glsl
// public/shaders/shockwave.frag
// Ударная волна: кольцо, расходящееся от центра

uniform float u_time;       // 0.0 → 1.0
uniform vec3  u_color;
uniform float u_thickness;  // 0.02–0.08
uniform float u_intensity;  // 0.0–1.0

varying vec2 vUv;

void main() {
  vec2 center = vec2(0.5, 0.5);
  float dist = distance(vUv, center);

  // Кольцо: нарастает от center наружу
  float waveFront = u_time * 0.8;
  float wave = smoothstep(waveFront - u_thickness, waveFront, dist)
             * (1.0 - smoothstep(waveFront, waveFront + u_thickness * 0.5, dist));

  // Opacity: затухает по мере расширения
  float opacity = wave * u_intensity * (1.0 - u_time);

  gl_FragColor = vec4(u_color, opacity);
}
```

```typescript
// components/animations/ShockwaveEffect.tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ShockwaveEffect({ color, position }: { color: string; position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const elapsed = useRef(0);

  const shader = {
    uniforms: {
      u_time:      { value: 0 },
      u_color:     { value: new THREE.Color(color) },
      u_thickness: { value: 0.05 },
      u_intensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform vec3  u_color;
      uniform float u_thickness;
      uniform float u_intensity;
      varying vec2 vUv;
      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = distance(vUv, center);
        float waveFront = u_time * 0.8;
        float wave = smoothstep(waveFront - u_thickness, waveFront, dist)
                   * (1.0 - smoothstep(waveFront, waveFront + u_thickness * 0.5, dist));
        float opacity = wave * u_intensity * (1.0 - u_time);
        gl_FragColor = vec4(u_color, opacity);
      }
    `,
  };

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (matRef.current) {
      matRef.current.uniforms.u_time.value = Math.min(elapsed.current * 0.8, 1.0);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        ref={matRef}
        args={[shader]}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
```

---

## ЧАСТЬ 7: УНИКАЛЬНЫЕ АНИМАЦИИ ПО ПЕРСОНАЖАМ

### 7.1 Реестр уникальных эффектов

```typescript
// lib/animations/uniqueEffects/registry.ts

import { lazy } from "react";

export const UNIQUE_EFFECTS = {
  // Ядерный гриб (Рампф и Пу)
  "mushroom_cloud": lazy(() =>
    import("./MushroomCloudEffect").then(m => ({ default: m.MushroomCloudEffect }))
  ),

  // Феникс MAGA (Рампф)
  "phoenix_rise": lazy(() =>
    import("./PhoenixRiseEffect").then(m => ({ default: m.PhoenixRiseEffect }))
  ),

  // Экран гаснет, тишина (Twitter Ban)
  "screen_blackout": lazy(() =>
    import("./ScreenBlackoutEffect").then(m => ({ default: m.ScreenBlackoutEffect }))
  ),

  // Часы останавливаются (Вечный президент)
  "clock_freeze": lazy(() =>
    import("./ClockFreezeEffect").then(m => ({ default: m.ClockFreezeEffect }))
  ),

  // Медведь рычит, экран дрожит
  "bear_roar": lazy(() =>
    import("./BearRoarEffect").then(m => ({ default: m.BearRoarEffect }))
  ),

  // Дракон поднимается
  "dragon_rise": lazy(() =>
    import("./DragonRiseEffect").then(m => ({ default: m.DragonRiseEffect }))
  ),

  // Огонь дракона
  "dragon_fire": lazy(() =>
    import("./DragonFireEffect").then(m => ({ default: m.DragonFireEffect }))
  ),

  // Великая стена
  "great_wall": lazy(() =>
    import("./GreatWallEffect").then(m => ({ default: m.GreatWallEffect }))
  ),

  // Флаг Украины развевается
  "ukraine_flag": lazy(() =>
    import("./UkraineFlagEffect").then(m => ({ default: m.UkraineFlagEffect }))
  ),

  // Железный щит
  "iron_shield": lazy(() =>
    import("./IronShieldEffect").then(m => ({ default: m.IronShieldEffect }))
  ),

  // Удар трезубцем
  "trident_strike": lazy(() =>
    import("./TridentStrikeEffect").then(m => ({ default: m.TridentStrikeEffect }))
  ),

  // Волна свободы (все карты бесплатны)
  "freedom_wave": lazy(() =>
    import("./FreedomWaveEffect").then(m => ({ default: m.FreedomWaveEffect }))
  ),
} as const;
```

### 7.2 Компонент-диспетчер уникальных эффектов

```typescript
// components/animations/UniqueEffectLayer.tsx
import { Suspense } from "react";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { UNIQUE_EFFECTS } from "@/lib/animations/uniqueEffects/registry";

export function UniqueEffectLayer() {
  const uniqueEffect = useAbilityAnimationStore(s => s.uniqueEffect);

  if (!uniqueEffect) return null;

  const EffectComponent = UNIQUE_EFFECTS[uniqueEffect.type as keyof typeof UNIQUE_EFFECTS];
  if (!EffectComponent) return null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      pointerEvents: "none",
      zIndex: 9500,
    }}>
      <Suspense fallback={null}>
        <EffectComponent {...(uniqueEffect.params as Record<string, unknown>)} />
      </Suspense>
    </div>
  );
}
```

---

## ЧАСТЬ 8: CURSOR PROMPTS

### 8.1 Мастер-промпт v3

```
Ты реализуешь систему анимаций эпических и легендарных карт
в игре "World Order".

ЭТАЛОН: Ace Attorney "OBJECTION!" + Guilty Gear Strive Overdrives.
СТЕК: Three.js + GSAP 3 + Framer Motion + Zustand

ПРИНЦИП: Каждое применение карты — это маленькое кинематографическое событие.
Epic = 1.4 секунды удивления.
Legendary = 2.8 секунды восторга.

ПРАВИЛА:
1. Текст НЕ появляется — он ВРЕЗАЕТСЯ. Spring + elastic ease всегда.
2. Вспышка НЕ белая — она ЦВЕТА ПЕРСОНАЖА. flashColor из конфига.
3. Impact lines НЕ из центра экрана — ИЗ ТОЧКИ ПЕРСОНАЖА-атакующего.
4. Freeze НЕ просто пауза — указатель мыши видно, а игровые элементы нет.
5. Каждая legendary-карта имеет УНИКАЛЬНЫЙ THREEJS-ЭФФЕКТ.
6. Выход из анимации — 300-400ms, НЕ резкий обрыв.

ПОРЯДОК РАБОТЫ:
  ANIM-A → ANIM-B → ANIM-C → ANIM-D → ANIM-E → ANIM-F
  После каждого компонента — CRITIC REVIEW.
  Принять только при ALL 9.5+/10.
```

### 8.2 ANIM-A: Flash & Freeze

```
ЗАДАЧА ANIM-A: Реализовать FlashFreezeLayer и AbilityAnimationOrchestrator

Файлы:
  - lib/animations/store.ts
  - lib/animations/AbilityAnimationOrchestrator.ts
  - components/animations/FlashFreezeLayer.tsx

По спецификации раздела 2 и 3.1 из ТЗ v3.

Проверить:
  □ Super freeze (80ms/160ms) полностью блокирует ввод игрока
  □ Flash имеет radial-gradient, а не flat-color
  □ Flash border (4px) видна по краям экрана
  □ Screen darken плавно нарастает (0.08s ease-in) для legendary
  □ Выход из flash — ease-out 0.3s

CRITIC: Запиши видео freeze→flash последовательности.
Сравни с 00:14 в "Guilty Gear Strive TESTAMENT overdrive compilation".
Принять только если "неотличимо по ощущению".
```

### 8.3 ANIM-B: Impact Lines

```
ЗАДАЧА ANIM-B: Реализовать ImpactLinesLayer на Canvas

Файлы:
  - components/animations/ImpactLinesLayer.tsx

По спецификации раздела 3.2.

Критически важно:
  □ Линии исходят из X/Y координаты ПЕРСОНАЖА (не из центра!)
    originPlayer 1 → x = 28% ширины экрана
    originPlayer 2 → x = 72% ширины экрана
    y = 40% высоты экрана (центр масс персонажа)
  □ Каждая третья линия ТОЛЩЕ остальных в 1.5-2× — как в манге
  □ Gradient stroke: у origin непрозрачный → у конца прозрачный
  □ Opacity кривая: нарастает за 30% времени, затухает за 70%
  □ Epic: 12-22 линии, вес 1.0-2.5
  □ Legendary: 24-36 линий, вес 3.0-5.0
  □ mixBlendMode: "screen" — линии светятся, не закрашивают

CRITIC: Сравни с кадром манги One Punch Man — удар Сайтамы.
Принять только если "этот же визуальный язык".
```

### 8.4 ANIM-C: Text Slam

```
ЗАДАЧА ANIM-C: Реализовать TextSlamLayer (Epic + Legendary)

Файлы:
  - components/animations/TextSlamLayer.tsx
  - lib/game/cardDisplayNames.ts  (все display names карт)

По спецификации раздела 3.3.

КРИТИЧНО — Ace Attorney трюки:
  □ Обводка текста (WebkitTextStroke) появляется с задержкой 80ms после текста
  □ Epic текст летит СПРАВА (x: "120%" → "0%")
  □ Legendary текст летит СПРАВА + skewX(-15deg → 0deg)
  □ Цветные полосы за legendary текстом (Guilty Gear)
  □ Две горизонтальные тёмные полосы выше/ниже (Ace Attorney)
  □ Подзаголовок с именем персонажа появляется с задержкой 200ms
  □ Spring: stiffness 600-700, damping 18-22 (упруго, не "плавно")
  □ Шрифт: ТОЛЬКО 'Cinzel Decorative' 900 weight

CRITIC: Открой Ace Attorney "Objection" gif, поставь рядом.
Запусти свою анимацию. Принять только если "сходство очевидно
даже без звука". Итерируй сколько нужно.
```

### 8.5 ANIM-D: Particle Bursts

```
ЗАДАЧА ANIM-D: Реализовать все паттерны партиклей в Three.js

Файлы:
  - components/game/three/AbilityParticleSystem.tsx
  - lib/animations/particlePatterns.ts

Паттерны (по спецификации раздела 2.2):

  "radial"    — равномерно во все стороны, classic burst
  "spiral"    — по Архимедовой спирали, закручиваются
  "explosion" — резкий взрыв, гравитация тянет вниз
  "rain"      — падают сверху, случайный X
  "shockwave" — кольцо расширяется наружу, плоское

Для КАЖДОГО паттерна:
  □ Количество: epic 70-130, legendary 200-300
  □ Время жизни: 0.8-1.4 секунды
  □ Гравитация: 0.004 (мягкая, не резкая)
  □ additive blending (светятся)
  □ Размер у legendary в 1.5-2× больше
  □ Вторичный цвет для legendary (secondary param)

CRITIC: Сравни с Hearthstone legendary card reveal animation.
Принять только если "такой же масштаб и сила".
```

### 8.6 ANIM-E: Character Poses

```
ЗАДАЧА ANIM-E: Анимации поз персонажа во время карты

Файлы:
  - components/game/three/CharacterMesh.tsx (расширить)
  - lib/animations/characterPoseAnimations.ts

Типы поз (через GSAP на mesh):

  "point"  — персонаж наклоняется вперёд, "указывает" — для Ace Attorney момента
             scale.x *= 1.15, position.z += 0.5, затем возврат
  
  "slam"   — резкий бросок вперёд-вниз и возврат
             position.y -= 0.3 за 0.06s, возврат за 0.3s elastic
  
  "rise"   — медленный подъём, scale нарастает
             scale от 1 до 1.3 за 0.4s, затем медленно к 1.0
  
  "charge" — быстрое движение вперёд как удар
             position.x += 0.5 (к противнику) за 0.08s, возврат 0.35s
  
  "shield" — расширяется, принимает удар
             scale.x 1→1.4→1 за 0.2s+0.3s

Для каждого:
  □ Начинается СИНХРОННО с impact lines (не раньше, не позже)
  □ Idle animation приостанавливается на время позы
  □ Возврат к idle плавный (0.3s ease-out)

CRITIC: Запиши персонажа делающего "point". Сравни с
Phoenix Wright pointing в тот момент когда говорит "Objection!".
Принять только если "тот же язык тела".
```

### 8.7 ANIM-F: Интеграция и Per-Card последовательности

```
ЗАДАЧА ANIM-F: Собрать все слои вместе и интегрировать в GameBoard

Файлы:
  - components/animations/AbilityAnimationProvider.tsx  (все слои)
  - components/game/game-board.tsx (хук вызова)
  - hooks/useAbilityAnimation.ts

AbilityAnimationProvider монтирует над всем:
  <FlashFreezeLayer />
  <ImpactLinesLayer />
  <TextSlamLayer />
  <UniqueEffectLayer />
  — всё zIndex выше THREE.js canvas

useAbilityAnimation hook:
  const { playCardAnimation } = useAbilityAnimation();
  // Вызывается ДО обработки хода движком
  await playCardAnimation(cardId, playerNum);
  // Только после завершения — processPlayerAction()

Проверить хронологию для dr-nuclear (legendary):
  0ms    → freeze 160ms
  0ms    → screen darkens
  160ms  → silhouette flash
  310ms  → flash + 36 impact lines
  470ms  → FULLSCREEN TEXT SLAM
  870ms  → mushroom_cloud ThreeJS effect
  1370ms → 250 particles (explosion)
  1970ms → return phase begins
  2370ms → animation complete, game resumes

CRITIC: Сыграй dr-nuclear 5 раз подряд. После 5-го раза запиши
честный ответ: "Хочу ли я смотреть это ещё раз?"
Принять только если ответ "ДА".
```

### 8.8 Финальный Critic Loop v3

```
ФИНАЛЬНЫЙ CRITIC REVIEW — ANIMATION SYSTEM:

Протестировать каждую из 20 legendary-карт (по одной).
Для каждой ответить на вопросы:

  A. IDENTITY — "Эта анимация принадлежит ЭТОЙ карте и ЭТОМУ персонажу?"
     Принять только "очевидно да"

  B. ACE ATTORNEY TEST — "Если бы я не знал источник и увидел это в игре,
     мог бы я не заметить разницы с Ace Attorney?"
     Принять только "мог бы"

  C. REPLAY FACTOR — "После 10-й игровой сессии я буду злиться
     на эту анимацию или радоваться ей?"
     Принять только "радоваться"

  D. INTENSITY HIERARCHY — "Epic явно слабее legendary по ощущению?"
     Принять только "явно да, epic — разогрев, legendary — кульминация"

ЕСЛИ ЛЮБОЙ ответ неудовлетворительный → назвать точный компонент,
указать что именно не работает, направить к нужному агенту.

ПРИНЯТЬ только когда ВСЕ 20 legendary = A+B+C+D.

Финальная запись: "ANIMATIONS v3 — PRODUCTION READY"
```

---

## ДОПОЛНЕНИЕ: Звуковые стинги (Web Audio API)

```typescript
// lib/audio/AbilityAudioSystem.ts
// Звук — неотъемлемая часть Ace Attorney момента.
// Реализуем процедурно через Web Audio (без файлов — везде работает).

export class AbilityAudioSystem {
  private ctx: AudioContext;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // "Удар" для epic — короткий percussive звук
  playEpicSting(characterId: string) {
    const colors: Record<string, number> = {
      "donald-rumpf":  880,  // высокий, резкий
      "vladimir-pu":   220,  // низкий, тяжёлый
      "jin-shi":       660,  // средний, чистый
      "vlado-zelenko": 1100, // самый высокий, быстрый
    };

    const baseFreq = colors[characterId] ?? 440;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.frequency.setValueAtTime(baseFreq * 2, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // "Бум" для legendary — низкий, ударный
  playLegendarySting(characterId: string) {
    // Sub-bass удар
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.frequency.setValueAtTime(60, this.ctx.currentTime);
    sub.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
    subGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
    sub.start();
    sub.stop(this.ctx.currentTime + 0.5);

    // Высокий "whoosh" — текст влетает
    setTimeout(() => {
      const whoosh = this.ctx.createOscillator();
      const whooshGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2000;

      whoosh.connect(filter);
      filter.connect(whooshGain);
      whooshGain.connect(this.ctx.destination);

      whoosh.type = "sawtooth";
      whoosh.frequency.setValueAtTime(4000, this.ctx.currentTime);
      whoosh.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
      whooshGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      whoosh.start();
      whoosh.stop(this.ctx.currentTime + 0.25);
    }, 350); // whoosh совпадает с text slam
  }
}

export const audioSystem = typeof window !== "undefined"
  ? new AbilityAudioSystem()
  : null;
```

---

*World Order — TZ v3.0: Ability Animations*
*Эталон: Ace Attorney «OBJECTION!» × Guilty Gear Strive Overdrives*
*20 legendary-карт × 4 персонажа × 6 анимационных агентов*
*Принимать только после прохождения финального Critic Loop.*
