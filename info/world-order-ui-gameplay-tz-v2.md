# WORLD ORDER — UI & GAMEPLAY TZ v2.0
## AAA Fighter × Card Roguelike — ThreeJS Edition
> Целевой стандарт: Slay the Spire × Guilty Gear Strive × Balatro
> Движок: Three.js r160 + React 18 + Next.js 15
> Режим Cursor: Multi-Agent Parallel с Critic Loop
>
> **Связь с TZ v4:** UI/HUD/арт из этого документа остаются в силе, но
> `getRarityCalloutDurationMs` (epic 3s / legendary 5s) **уступает**
> Action-Locked Presentation из
> [`world-order-game-flow-feeling-tz-v4.md`](./world-order-game-flow-feeling-tz-v4.md).
> Блокирующие rarity-callout перед impact/cinematic в battle resolve path запрещены.

---

## СОДЕРЖАНИЕ

- [ЧАСТЬ 0: Диагноз текущего состояния](#часть-0-диагноз)
- [ЧАСТЬ 1: Мульти-агентная система Cursor](#часть-1-мульти-агентная-система)
- [ЧАСТЬ 2: Дизайн-система и визуальный язык](#часть-2-дизайн-система)
- [ЧАСТЬ 3: ThreeJS сцена боя](#часть-3-threejs-сцена)
- [ЧАСТЬ 4: Система карт AAA-уровня](#часть-4-система-карт)
- [ЧАСТЬ 5: HUD и боевой интерфейс](#часть-5-hud)
- [ЧАСТЬ 6: Геймплейный баланс и Roguelike-механики](#часть-6-геймплей-и-баланс)
- [ЧАСТЬ 7: Анимации и Game Feel](#часть-7-анимации)
- [ЧАСТЬ 8: Flow игровой сессии](#часть-8-game-flow)
- [ЧАСТЬ 9: Prompt-библиотека для Cursor](#часть-9-cursor-prompts)

---

## ЧАСТЬ 0: ДИАГНОЗ

### 0.1 Что сейчас не так (разбор скриншота)

| Проблема | Симптом | Приоритет |
|----------|---------|-----------|
| Персонажи — силуэты | Две одинаковые красные карточки без арта | 🔴 КРИТИЧНО |
| Пустое поле боя | 80% экрана — тёмный прямоугольник | 🔴 КРИТИЧНО |
| Нет боевой обратной связи | HP не двигается визуально | 🔴 КРИТИЧНО |
| Плоские карты внизу | Три прямоугольника с текстом | 🟡 ВЫСОКИЙ |
| Нет атмосферы | Нет фона, нет окружения | 🟡 ВЫСОКИЙ |
| Нет анимаций | Статичная сцена | 🟡 ВЫСОКИЙ |
| Карты утилитарны | Урон мало, HP не тратится | 🔴 КРИТИЧНО |
| Нет эффектов | Нет партиклов, вспышек, тряски | 🟡 ВЫСОКИЙ |

### 0.2 Целевое состояние

```
До:  Два красных прямоугольника с силуэтами на чёрном фоне
После: ThreeJS-сцена с живыми персонажами, динамическим освещением,
       партиклами при ударе, полётом цифр урона, экранной тряской,
       картами с уникальным артом, атмосферным задником
```

---

## ЧАСТЬ 1: МУЛЬТИ-АГЕНТНАЯ СИСТЕМА CURSOR

### 1.1 Структура агентов

Cursor запускает 6 параллельных агентов. Каждый агент отвечает за один слой.  
**Critic Agent** — отдельный агент, единственная задача которого — быть жёстким рецензентом.

```
┌──────────────────────────────────────────────────────────────────┐
│                     CURSOR ORCHESTRATOR                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ AGENT-A  │ AGENT-B  │ AGENT-C  │ AGENT-D  │ AGENT-E  │ AGENT-F  │
│ ThreeJS  │  Cards   │   HUD    │  Effects │  Balance │  Flow    │
│ Scene    │  System  │  & UI    │ & Audio  │  & AI    │  & UX    │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                    CRITIC AGENT (LOOP)                           │
│  Сравнивает с Slay the Spire. Не принимает ничего ниже 9/10.    │
│  Итерирует до полного совершенства.                             │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Системный промпт CRITIC AGENT

```
Ты — жёсткий арт-директор AAA игровой студии. Твоя единственная задача —
оценивать визуальный результат работы других агентов.

Эталон сравнения: Slay the Spire (MegaCrit, 2017).
Критерии оценки (каждый от 1 до 10):
  1. Visual Hierarchy — понятно ли что важно?
  2. Game Feel — есть ли отклик на каждое действие?
  3. Atmosphere — ощущается ли мир?
  4. Card Readability — читаются ли карты с первого взгляда?
  5. Animation Polish — нет ли рывков, дёрганий, телепортаций?
  6. Damage Feedback — видно ли что происходит в бою?
  7. Character Presence — ощущаются ли персонажи живыми?
  8. UI Consistency — одинаковые компоненты везде?
  9. Performance — не лагает ли при 60fps?
  10. "AAA Factor" — можно ли спутать с реальной игрой?

Если ЛЮБОЙ критерий ниже 8/10 — REJECT и указать конкретные изменения.
Если ALL критерии 8+ но хотя бы один ниже 9 — REQUEST_REVISION с деталями.
Принимать только когда ALL критерии 9+.
После принятия запиши: "APPROVED — [компонент] готов к интеграции".

Будь максимально конкретен: не "плохо выглядит", а "карта шириной 180px
выглядит слишком узкой на 1920px экране — нужно 220px, отступы увеличить до 16px".
```

### 1.3 Workflow итерации (Critic Loop)

```
AGENT создаёт компонент
        ↓
CRITIC оценивает (1-10 по каждому критерию)
        ↓
    Все ≥ 9?
   /         \
 YES          NO
  ↓            ↓
APPROVE    REJECT + feedback
  ↓            ↓
NEXT       AGENT исправляет
COMPONENT       ↓
           Возврат к CRITIC
           (max 5 итераций)
```

### 1.4 Задачи по агентам

**AGENT-A (ThreeJS Scene):**
```
Файлы: components/game/three-scene.tsx, lib/three/scene-manager.ts,
       lib/three/character-mesh.ts, lib/three/particle-system.ts
Задача: Создать полноценную 3D-сцену боя
Критерии Critic: Visual Hierarchy, Atmosphere, Character Presence
```

**AGENT-B (Cards System):**
```
Файлы: components/game/card.tsx, components/game/hand.tsx,
       lib/game/card-renderer.ts
Задача: Карты уровня Slay the Spire
Критерии Critic: Card Readability, UI Consistency, Game Feel
```

**AGENT-C (HUD & UI):**
```
Файлы: components/game/hud.tsx, components/game/status-effects.tsx,
       components/game/turn-indicator.tsx, components/game/energy-display.tsx
Задача: Информативный, красивый боевой HUD
Критерии Critic: Visual Hierarchy, UI Consistency, Card Readability
```

**AGENT-D (Effects & Feedback):**
```
Файлы: lib/three/effects.ts, lib/three/damage-numbers.ts,
       lib/three/screen-effects.ts, hooks/useGameFeel.ts
Задача: Партиклы, тряска экрана, числа урона
Критерии Critic: Game Feel, Animation Polish, Damage Feedback
```

**AGENT-E (Balance & AI):**
```
Файлы: lib/game/engine.ts, lib/game/balance.ts, lib/game/ai.ts
Задача: Сбалансировать урон, HP, AI; добавить Roguelike-механики
Критерии Critic: Damage Feedback, Game Feel (feel of power)
```

**AGENT-F (Game Flow & UX):**
```
Файлы: app/game/[id]/page.tsx, components/game/phase-announcer.tsx,
       components/game/card-select-flow.tsx, components/game/end-screen.tsx
Задача: Плавный поток игровой сессии, экран победы/поражения
Критерии Critic: Game Feel, UI Consistency, "AAA Factor"
```

---

## ЧАСТЬ 2: ДИЗАЙН-СИСТЕМА

### 2.1 Токены цвета

```typescript
// lib/design/tokens.ts
export const COLORS = {
  // Базовые
  bg_void:    "#08080F",   // основной фон — почти чёрный с синевой
  bg_surface: "#0F1018",   // поверхности
  bg_card:    "#161824",   // фон карты
  bg_glass:   "rgba(255,255,255,0.04)", // стекло

  // Акценты
  gold:       "#D4AF37",   // энергия, особые эффекты
  gold_glow:  "#FFD700",
  red_hot:    "#E8372C",   // урон, опасность
  red_glow:   "#FF5045",
  cyan_cool:  "#00D4FF",   // ледяные эффекты, защита
  purple_epic:"#9B59B6",   // epic-карты
  legendary:  "#FF8C00",   // legendary-карты

  // Страны
  usa_blue:   "#1A3A6B",
  usa_red:    "#B22234",
  russia_red: "#CC0000",
  russia_dark:"#1A0000",
  china_red:  "#DE2910",
  china_gold: "#FFDE00",
  ukraine_blue:"#005BBB",
  ukraine_gold:"#FFD500",

  // Редкость карт
  rarity_common:    "#8A9BA8",
  rarity_rare:      "#4A90D9",
  rarity_epic:      "#9B59B6",
  rarity_legendary: "#E67E22",

  // Текст
  text_primary:   "#F0E8D0",   // кремовый, тёплый
  text_secondary: "#8A9BA8",
  text_damage:    "#FF4444",
  text_heal:      "#44FF88",
  text_energy:    "#FFD700",
} as const;
```

### 2.2 Типографика

```typescript
export const TYPOGRAPHY = {
  // Шрифты
  display: "'Cinzel Decorative', serif",   // заголовки карт, имена
  ui:      "'Rajdhani', sans-serif",       // HUD, числа, статы
  body:    "'Crimson Text', serif",        // описания карт
  mono:    "'JetBrains Mono', monospace",  // debug, коды

  // Шкала
  xs:   "11px",
  sm:   "13px",
  base: "15px",
  lg:   "18px",
  xl:   "24px",
  xxl:  "32px",
  hero: "48px",

  // Стили для HUD
  damage_number: "font: 700 32px 'Rajdhani'; letter-spacing: 2px",
  card_cost:     "font: 900 22px 'Rajdhani'",
  card_name:     "font: 700 15px 'Cinzel Decorative'",
  stat_value:    "font: 600 16px 'Rajdhani'; tabular-nums",
} as const;
```

### 2.3 Google Fonts импорт (layout.tsx)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?
  family=Cinzel+Decorative:wght@700;900&
  family=Rajdhani:wght@400;500;600;700&
  family=Crimson+Text:ital,wght@0,400;0,600;1,400&
  display=swap" rel="stylesheet" />
```

### 2.4 Визуальный язык арены

```
Концепция: Тайный зал заседаний мировых лидеров.
Тёмные деревянные панели, флаги стран, золотые детали.
Задний план — живой: динамические огни, дым, анимированные
флаги. Каждая арена уникальна для пары персонажей.

Арены:
  Рампф vs кто угодно   → Вашингтон DC, ночь, фейерверки
  Пу vs кто угодно      → Кремль, пурга, красные прожекторы
  Джин Ши vs кто угодно → Запретный город, туман, красные фонари
  Зеленко vs кто угодно → Бункер Киева, стробоскопы, флаг Украины
  Зеркальный матч       → Ядерный бункер, мигающее освещение
```

---

## ЧАСТЬ 3: THREEJS СЦЕНА

### 3.1 Установка зависимостей

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install @types/three
npm install gsap           # анимации timeline
npm install @pmndrs/vanilla-three  # утилиты
```

### 3.2 Архитектура сцены

```typescript
// components/game/BattleScene.tsx
"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from "@react-three/postprocessing";
import { CharacterMesh } from "./three/CharacterMesh";
import { ArenaEnvironment } from "./three/ArenaEnvironment";
import { ParticleSystem } from "./three/ParticleSystem";
import { DamageNumbers } from "./three/DamageNumbers";
import { useGameStore } from "@/lib/game/store";

export function BattleScene() {
  const { match, pendingEffect } = useGameStore();

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.5, 8], fov: 55 }}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <Suspense fallback={null}>
        {/* Освещение */}
        <ambientLight intensity={0.15} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-3, 2, 3]} intensity={0.8} color="#D4AF37" />
        <pointLight position={[3, 2, 3]} intensity={0.8} color="#CC2200" />

        {/* Арена */}
        <ArenaEnvironment arenaId={match.arenaId} />

        {/* Персонаж игрока (слева) */}
        <CharacterMesh
          characterId={match.player1.characterId}
          form={match.player1.currentForm}
          position={[-2.5, 0, 0]}
          facing="right"
          hp={match.player1.hp}
          maxHp={match.player1.maxHp}
          isPlayer={true}
          pendingEffect={pendingEffect?.target === "player1" ? pendingEffect : null}
        />

        {/* Персонаж противника (справа, зеркально) */}
        <CharacterMesh
          characterId={match.player2.characterId}
          form={match.player2.currentForm}
          position={[2.5, 0, 0]}
          facing="left"
          hp={match.player2.hp}
          maxHp={match.player2.maxHp}
          isPlayer={false}
          pendingEffect={pendingEffect?.target === "player2" ? pendingEffect : null}
        />

        {/* Партикли */}
        <ParticleSystem />

        {/* Числа урона (3D billboard) */}
        <DamageNumbers />

        {/* Post-processing */}
        <EffectComposer>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.9}
          />
          <ChromaticAberration offset={[0.001, 0.001]} />
          <Vignette eskil={false} offset={0.4} darkness={0.7} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
```

### 3.3 CharacterMesh — персонаж в ThreeJS

```typescript
// components/game/three/CharacterMesh.tsx
// Персонажи реализованы как 2D иллюстрации (plane + texture)
// в 3D-пространстве — так же как в Slay the Spire.
// Это позволяет использовать красивый 2D-арт внутри 3D-сцены.

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

const CHARACTER_TEXTURES: Record<string, string[]> = {
  "donald-rumpf": [
    "/assets/characters/rumpf/form1.png",  // 512x768 PNG с прозрачностью
    "/assets/characters/rumpf/form2.png",
    "/assets/characters/rumpf/form3.png",
  ],
  "vladimir-pu": [
    "/assets/characters/pu/form1.png",
    "/assets/characters/pu/form2.png",
    "/assets/characters/pu/form3.png",
  ],
  "jin-shi": [
    "/assets/characters/jinshi/form1.png",
    "/assets/characters/jinshi/form2.png",
    "/assets/characters/jinshi/form3.png",
  ],
  "vlado-zelenko": [
    "/assets/characters/zelenko/form1.png",
    "/assets/characters/zelenko/form2.png",
    "/assets/characters/zelenko/form3.png",
  ],
};

export function CharacterMesh({
  characterId, form, position, facing,
  hp, maxHp, isPlayer, pendingEffect
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const texturePath = CHARACTER_TEXTURES[characterId][form - 1];
  const texture = useTexture(texturePath);

  // Идл-анимация: лёгкое покачивание
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.04;
    // Лёгкое дыхание (scale)
    meshRef.current.scale.y = 1 + Math.sin(t * 1.2) * 0.005;
  });

  // Реакция на получение урона
  useEffect(() => {
    if (!pendingEffect || !meshRef.current || !materialRef.current) return;

    if (pendingEffect.type === "damage") {
      // Вспышка белым → красным
      gsap.timeline()
        .to(materialRef.current.color, { r: 1, g: 1, b: 1, duration: 0.05 })
        .to(materialRef.current.color, { r: 1, g: 0.1, b: 0.1, duration: 0.1 })
        .to(materialRef.current.color, { r: 1, g: 1, b: 1, duration: 0.2 });

      // Отброс назад
      const dir = facing === "right" ? -1 : 1;
      gsap.timeline()
        .to(meshRef.current.position, { x: position[0] + dir * 0.3, duration: 0.08 })
        .to(meshRef.current.position, { x: position[0], duration: 0.3, ease: "elastic.out" });

    } else if (pendingEffect.type === "death") {
      gsap.to(meshRef.current.position, { y: position[1] - 3, duration: 0.5, ease: "power2.in" });
      gsap.to(materialRef.current, { opacity: 0, duration: 0.4, delay: 0.2 });

    } else if (pendingEffect.type === "transform") {
      // Вспышка золотым при трансформации
      gsap.timeline()
        .to(meshRef.current.scale, { x: 1.3, y: 1.3, duration: 0.15 })
        .to(meshRef.current.scale, { x: 1, y: 1, duration: 0.4, ease: "elastic.out" });
    }
  }, [pendingEffect]);

  const hpRatio = hp / maxHp;
  // Тёмный overlay при низком HP
  const overlayOpacity = hpRatio < 0.3 ? (0.3 - hpRatio) * 2 : 0;

  return (
    <group position={position}>
      {/* Тень */}
      <mesh position={[0, -1.8, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ellipseGeometry args={[0.8, 0.4, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} />
      </mesh>

      {/* Персонаж */}
      <mesh ref={meshRef} scale={facing === "left" ? [-1, 1, 1] : [1, 1, 1]}>
        <planeGeometry args={[2.4, 3.6]} />
        <meshBasicMaterial
          ref={materialRef}
          map={texture}
          transparent
          alphaTest={0.01}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Красный overlay при низком HP */}
      {overlayOpacity > 0 && (
        <mesh>
          <planeGeometry args={[2.4, 3.6]} />
          <meshBasicMaterial
            color="#FF0000"
            transparent
            opacity={overlayOpacity}
          />
        </mesh>
      )}

      {/* Glow-кольцо под ногами (цвет страны) */}
      <mesh position={[0, -1.8, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.9, 64]} />
        <meshBasicMaterial
          color={getCharacterColor(characterId)}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}
```

### 3.4 ArenaEnvironment — фоны арен

```typescript
// components/game/three/ArenaEnvironment.tsx
// Арена = слоистый параллакс-фон (как Slay the Spire)
// Слои: дальний план → средний → передний

export function ArenaEnvironment({ arenaId }: { arenaId: string }) {
  const config = ARENA_CONFIGS[arenaId];

  return (
    <group>
      {/* Skybox (HDR или текстура) */}
      <mesh position={[0, 0, -20]}>
        <planeGeometry args={[60, 30]} />
        <meshBasicMaterial map={useTexture(config.skyTexture)} />
      </mesh>

      {/* Слой 1: далёкий фон (медленный параллакс) */}
      <ParallaxLayer
        texture={config.layer1}
        position={[0, -1, -12]}
        size={[24, 14]}
        speed={0.02}
      />

      {/* Слой 2: средний план */}
      <ParallaxLayer
        texture={config.layer2}
        position={[0, -1.5, -6]}
        size={[18, 10]}
        speed={0.05}
      />

      {/* Пол арены */}
      <mesh position={[0, -2.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial
          map={useTexture(config.floorTexture)}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      {/* Динамические огни (свечи, прожекторы) */}
      {config.dynamicLights.map((light, i) => (
        <AnimatedPointLight key={i} {...light} />
      ))}

      {/* Ambient particles (пыль, искры) */}
      <AmbientParticles preset={config.particles} />
    </group>
  );
}

const ARENA_CONFIGS = {
  "usa-arena": {
    skyTexture: "/assets/arenas/usa/sky.jpg",
    layer1: "/assets/arenas/usa/bg1_capitol.png",
    layer2: "/assets/arenas/usa/bg2_flags.png",
    floorTexture: "/assets/arenas/usa/floor_marble.jpg",
    dynamicLights: [
      { position: [-4, 3, 1], color: "#1A3A6B", intensity: 1.5, frequency: 0.5 },
      { position: [4, 3, 1],  color: "#B22234", intensity: 1.5, frequency: 0.7 },
    ],
    particles: "confetti",
  },
  "russia-arena": {
    skyTexture: "/assets/arenas/russia/sky_night.jpg",
    layer1: "/assets/arenas/russia/bg1_kremlin.png",
    layer2: "/assets/arenas/russia/bg2_snow.png",
    floorTexture: "/assets/arenas/russia/floor_stone.jpg",
    dynamicLights: [
      { position: [0, 5, 2], color: "#CC0000", intensity: 2.0, frequency: 0.3 },
    ],
    particles: "snowflakes",
  },
  "china-arena": {
    skyTexture: "/assets/arenas/china/sky_dusk.jpg",
    layer1: "/assets/arenas/china/bg1_forbidden_city.png",
    layer2: "/assets/arenas/china/bg2_lanterns.png",
    floorTexture: "/assets/arenas/china/floor_red.jpg",
    particles: "embers",
  },
  "ukraine-arena": {
    skyTexture: "/assets/arenas/ukraine/sky_dawn.jpg",
    layer1: "/assets/arenas/ukraine/bg1_bunker.png",
    layer2: "/assets/arenas/ukraine/bg2_flames.png",
    floorTexture: "/assets/arenas/ukraine/floor_concrete.jpg",
    particles: "sparks",
  },
};
```

### 3.5 ParticleSystem — система партиклей

```typescript
// components/game/three/ParticleSystem.tsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ParticleBurst {
  id: string;
  position: THREE.Vector3;
  type: "hit" | "block" | "heal" | "energy" | "death" | "transform";
  color: string;
  count: number;
  timestamp: number;
}

export function ParticleSystem() {
  const bursts = useGameEffectStore(s => s.particleBursts);

  return (
    <group>
      {bursts.map(burst => (
        <ParticleBurst key={burst.id} {...burst} />
      ))}
    </group>
  );
}

function ParticleBurst({ position, type, color, count }) {
  const ref = useRef<THREE.Points>(null);
  const elapsed = useRef(0);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;
      // Случайный вектор скорости зависит от типа
      const speed = type === "hit" ? 0.15 : type === "death" ? 0.08 : 0.06;
      vel[i * 3]     = (Math.random() - 0.5) * speed;
      vel[i * 3 + 1] = Math.random() * speed + 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.5;
    }
    return { positions: pos, velocities: vel };
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    elapsed.current += delta;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      pos[i * 3]     += velocities[i * 3];
      pos[i * 3 + 1] += velocities[i * 3 + 1];
      pos[i * 3 + 2] += velocities[i * 3 + 2];
      velocities[i * 3 + 1] -= 0.004; // гравитация
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    (ref.current.material as THREE.PointsMaterial).opacity =
      Math.max(0, 1 - elapsed.current * 2);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={type === "hit" ? 0.06 : 0.04}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
```

### 3.6 DamageNumbers — 3D числа урона

```typescript
// components/game/three/DamageNumbers.tsx
// Числа урона как 3D-билборды — летят вверх и исчезают

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";

interface DamageNumber {
  id: string;
  value: number;
  type: "damage" | "heal" | "energy" | "block" | "crit";
  position: [number, number, number];
  timestamp: number;
}

function DamageNumberMesh({ value, type, position }: DamageNumber) {
  const ref = useRef();
  const opacity = useRef({ value: 1 });

  const config = {
    damage:  { color: "#FF4444", prefix: "-", size: 0.45 },
    heal:    { color: "#44FF88", prefix: "+", size: 0.38 },
    energy:  { color: "#FFD700", prefix: "+", size: 0.32 },
    block:   { color: "#88CCFF", prefix: "🛡", size: 0.36 },
    crit:    { color: "#FF8800", prefix: "!!", size: 0.55 },
  }[type];

  useEffect(() => {
    if (!ref.current) return;
    gsap.timeline()
      .to(ref.current.position, {
        y: position[1] + 1.5,
        x: position[0] + (Math.random() - 0.5) * 0.5,
        duration: 1.0,
        ease: "power2.out",
      })
      .to(opacity, { value: 0, duration: 0.4 }, 0.6);
  }, []);

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={config.size}
      color={config.color}
      font="/fonts/Rajdhani-Bold.ttf"
      anchorX="center"
      anchorY="middle"
      fillOpacity={opacity.current.value}
      outlineWidth={0.02}
      outlineColor="#000000"
    >
      {config.prefix}{value}
    </Text>
  );
}
```

---

## ЧАСТЬ 4: СИСТЕМА КАРТ AAA-УРОВНЯ

### 4.1 Анатомия карты (Slay the Spire-стиль)

```
┌─────────────────────────┐
│  ╔═══╗  Стоимость (сверху │
│  ║ 3 ║  слева, крупно)    │
│  ╚═══╝                   │
│  ┌─────────────────────┐ │
│  │                     │ │
│  │     [АРТ КАРТЫ]     │ │  ← 60% высоты карты
│  │   256x180px PNG     │ │
│  │                     │ │
│  └─────────────────────┘ │
│  ──────────────────────  │
│  ГАЗОВЫЙ РЫЧАГ           │  ← Cinzel Decorative
│  ──────────────────────  │
│  Блокирует +1 энергии    │  ← Crimson Text 13px
│  врагу на 2 хода         │
│  ──────────────────────  │
│  ⚡ RARE                  │  ← цвет редкости
└─────────────────────────┘
   ← 180px →    ← 280px высота →
```

### 4.2 Компонент Card

```typescript
// components/game/Card.tsx
import { motion, AnimatePresence } from "framer-motion";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";

interface CardProps {
  card: AbilityCard;
  isSelected: boolean;
  isPlayable: boolean;   // энергии хватает
  isHovered: boolean;
  onClick: () => void;
  style?: "hand" | "played" | "tooltip";
  playerEnergy: number;
}

const RARITY_CONFIG = {
  common:    { color: COLORS.rarity_common,    glow: "none",             border: "1px solid #8A9BA8" },
  rare:      { color: COLORS.rarity_rare,      glow: "0 0 12px #4A90D9", border: "1px solid #4A90D9" },
  epic:      { color: COLORS.rarity_epic,      glow: "0 0 18px #9B59B6", border: "1px solid #9B59B6" },
  legendary: { color: COLORS.rarity_legendary, glow: "0 0 24px #E67E22", border: "2px solid #E67E22" },
};

const TYPE_ICON = {
  active:  "⚔️",
  passive: "🛡️",
  ultimate:"✨",
};

export function Card({ card, isSelected, isPlayable, isHovered, onClick, playerEnergy }: CardProps) {
  const rarity = RARITY_CONFIG[card.rarity];
  const canPlay = playerEnergy >= card.cost;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -24, scale: 1.08, zIndex: 50 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        y: isSelected ? -32 : 0,
        scale: isSelected ? 1.1 : 1,
        filter: isSelected
          ? `drop-shadow(0 0 16px ${rarity.color})`
          : !canPlay
          ? "grayscale(0.6) brightness(0.7)"
          : "none",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={{
        width: 180,
        height: 280,
        borderRadius: 12,
        background: `linear-gradient(160deg, ${COLORS.bg_card} 0%, #1A1C2A 100%)`,
        border: isSelected ? `2px solid ${rarity.color}` : rarity.border,
        boxShadow: isSelected ? rarity.glow : "0 4px 20px rgba(0,0,0,0.6)",
        cursor: canPlay ? "pointer" : "not-allowed",
        position: "relative",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Фоновый glow для legendary */}
      {card.rarity === "legendary" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 30%, rgba(230,126,34,0.15), transparent 70%)",
          animation: "legendaryPulse 2s ease-in-out infinite",
        }} />
      )}

      {/* Стоимость (верхний левый угол) */}
      <div style={{
        position: "absolute", top: 8, left: 8,
        width: 38, height: 38,
        borderRadius: "50%",
        background: canPlay
          ? "radial-gradient(circle, #FFD700, #B8860B)"
          : "radial-gradient(circle, #555, #333)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: canPlay ? "0 0 12px rgba(255,215,0,0.6)" : "none",
        border: "2px solid rgba(255,255,255,0.2)",
        zIndex: 10,
      }}>
        <span style={{
          font: TYPOGRAPHY.card_cost,
          color: canPlay ? "#1A0000" : "#888",
          lineHeight: 1,
        }}>
          {card.cost}
        </span>
      </div>

      {/* Иконка типа (верхний правый) */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        fontSize: 18, zIndex: 10,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
      }}>
        {TYPE_ICON[card.type]}
      </div>

      {/* Арт карты */}
      <div style={{
        margin: "8px 8px 0",
        height: 150,
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <img
          src={`/assets/cards/${card.id}.png`}
          alt={card.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            // Фолбэк: генеративный placeholder
            e.currentTarget.src = `/api/card-placeholder?id=${card.id}&rarity=${card.rarity}`;
          }}
        />
        {/* Gradient overlay снизу */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
          background: "linear-gradient(transparent, #161824)",
        }} />
      </div>

      {/* Разделитель */}
      <div style={{
        margin: "6px 8px",
        height: 1,
        background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
      }} />

      {/* Название */}
      <div style={{
        padding: "0 10px 4px",
        font: TYPOGRAPHY.card_name,
        color: COLORS.text_primary,
        textAlign: "center",
        fontSize: 13,
        textShadow: `0 0 8px ${rarity.color}`,
        letterSpacing: "0.5px",
      }}>
        {card.name}
      </div>

      {/* Описание эффекта */}
      <div style={{
        padding: "0 10px 6px",
        font: `400 12px 'Crimson Text'`,
        color: COLORS.text_secondary,
        textAlign: "center",
        lineHeight: 1.4,
      }}>
        {card.description}
      </div>

      {/* Полоска редкости снизу */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 3,
        background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
      }} />

      {/* Анимация выбора */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 50%, ${rarity.color}22, transparent)`,
            borderRadius: 12,
          }}
        />
      )}
    </motion.div>
  );
}
```

### 4.3 Hand — рука карт с веером

```typescript
// components/game/Hand.tsx
// Карты веером как в Slay the Spire: небольшой дуговой разворот
import { motion } from "framer-motion";

interface HandProps {
  cards: AbilityCard[];
  selectedIds: string[];
  playerEnergy: number;
  onCardClick: (id: string) => void;
  disabled: boolean;
}

export function Hand({ cards, selectedIds, playerEnergy, onCardClick, disabled }: HandProps) {
  const count = cards.length;

  return (
    <div style={{
      position: "relative",
      height: 340,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    }}>
      {cards.map((card, i) => {
        // Веер: центральная карта прямо, крайние повёрнуты на ±MAX_ANGLE
        const MAX_ANGLE = Math.min(8, count * 1.5);
        const centerIndex = (count - 1) / 2;
        const offset = i - centerIndex;
        const angle = (offset / Math.max(centerIndex, 1)) * MAX_ANGLE;
        const yOffset = Math.abs(offset) * 8;  // крайние карты ниже
        const xSpacing = Math.min(200, 1100 / count);

        return (
          <motion.div
            key={card.id}
            style={{
              position: "absolute",
              transformOrigin: "center bottom",
              transform: `translateX(${(i - centerIndex) * xSpacing}px)
                          translateY(${yOffset}px)
                          rotate(${angle}deg)`,
              zIndex: i,
            }}
            whileHover={{
              zIndex: 100,
              transform: `translateX(${(i - centerIndex) * xSpacing}px)
                          translateY(-20px)
                          rotate(0deg)
                          scale(1.05)`,
              transition: { duration: 0.15 }
            }}
          >
            <Card
              card={card}
              isSelected={selectedIds.includes(card.id)}
              isPlayable={!disabled && playerEnergy >= card.cost}
              isHovered={false}
              onClick={() => !disabled && onCardClick(card.id)}
              playerEnergy={playerEnergy}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
```

### 4.4 Card Art Assets — спецификация для художника / AI-генерации

```
Спецификация арт-ассетов карт:

Формат: PNG, прозрачный фон, 256x180px (@2x: 512x360px)
Стиль: политическая карикатура, экспрессивная, жирные контуры,
       ограниченная палитра (3-4 цвета + тени)
       Референсы: Hearthstone + Slay the Spire + советский плакат

Для каждой карты: одна сцена, один момент действия.

Примеры для Рампфа:
  dr-nuclear: Большая красная кнопка, рука нажимает, взрыв сзади
  dr-wall: Силуэт стены из кирпичей, рука в строительных рукавицах
  dr-tweet: Телефон со взрывающимися молниями из экрана

Для Пу:
  vp-bear: Медведь в деловом костюме с галстуком
  vp-nerve: Пузырёк с черепом, химические пары
  vp-pipeline: Труба с вентилем, потоки газа

Файловая структура:
  /public/assets/cards/{card-id}.png
  /public/assets/cards/{card-id}@2x.png
  /public/assets/cards/placeholder_common.png    ← фолбэк
  /public/assets/cards/placeholder_rare.png
  /public/assets/cards/placeholder_epic.png
  /public/assets/cards/placeholder_legendary.png
```

---

## ЧАСТЬ 5: HUD И БОЕВОЙ ИНТЕРФЕЙС

### 5.1 Компоновка GameBoard

```
┌────────────────────────────────────────────────────────────────────┐
│ [Phase Banner]  Ход 3 · Фаза способностей           ⏱ 00:47       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─ OPPONENT HUD ───────────────────────────────────────────────┐  │
│  │ [Avatar] ИИ-противник    [HP Bar▓▓▓▓▓▓▓░░░]  95/130         │  │
│  │  Вл. Пу · Лидер Ф2      [ARM ██████░] 40    [↯] ????        │  │
│  │  [Эффекты: 🔥×2 🛡×1]                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│                  ┌──────────────────────────────┐                 │
│                  │   THREE.JS BATTLE CANVAS      │                 │
│  [PLAYER LEFT]   │                              │  [OPPONENT RIGHT]│
│                  │  🃏×? (скрытые карты врага)   │                 │
│                  │                              │                 │
│                  └──────────────────────────────┘                 │
│                                                                    │
│  ┌─ PLAYER HUD ────────────────────────────────────────────────┐   │
│  │ [Avatar] Вы: Guest_9890  [HP Bar ▓▓▓▓▓▓▓▓░░]  110/130      │   │
│  │  Вл. Пу · Лидер Ф2      [ARM ██████░] 40                   │   │
│  │  [⚡ ЭНЕРГИЯ: ●●●○]  3/4 энергии                           │   │
│  │  [Эффекты: ⏳×1]                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ───────────────── РУКА (5 КАРТ) ─────────────────               │
│                                                                    │
│    [Гибридный] [Газ. рычаг] [Мед. хватка] [ФСБ-сигнал] [Бункер] │
│         1💰          2💰          4💰           3💰         2💰  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [🃏 КОЛОДА: 12] [🗑 СБРОС: 8]    [▶ РАЗЫГРАТЬ (2 выбрано)] │  │
│  │                                  [⏭ ПРОПУСТИТЬ ХОД]         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 HP Bar — анимированная полоска здоровья

```typescript
// components/game/HPBar.tsx
// Как в Slay the Spire: зелёная → жёлтая → красная
// Потерянный HP отображается как серая зона, которая плавно догоняет

import { motion, useSpring, useTransform } from "framer-motion";

interface HPBarProps {
  hp: number;
  maxHp: number;
  armor: number;
  showArmor?: boolean;
}

export function HPBar({ hp, maxHp, armor, showArmor = true }: HPBarProps) {
  const ratio = hp / maxHp;

  // Цвет плавно меняется: зелёный → жёлтый → красный
  const barColor = ratio > 0.5
    ? `hsl(${120 * ratio * 2}, 70%, 45%)`    // зелёный
    : ratio > 0.25
    ? `hsl(${60}, 80%, 50%)`                  // жёлтый
    : `hsl(0, 85%, 50%)`;                     // красный

  // Spring для плавного движения полоски
  const springHp = useSpring(ratio, { stiffness: 100, damping: 20 });

  // "Отстающая" полоска (серая, показывает только что потерянный HP)
  const prevRatio = useRef(ratio);
  const trailingRatio = useSpring(ratio, { stiffness: 40, damping: 15 });

  return (
    <div style={{ position: "relative" }}>
      {/* Фон */}
      <div style={{
        height: 14, borderRadius: 7,
        background: "#1A1A2E",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Trailing bar (серый) */}
        <motion.div style={{
          position: "absolute", inset: 0,
          background: "#555",
          transformOrigin: "left",
          scaleX: trailingRatio,
        }} />

        {/* Основная полоска */}
        <motion.div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, ${barColor}CC, ${barColor})`,
          transformOrigin: "left",
          scaleX: springHp,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2)`,
        }} />

        {/* Сегментные деления */}
        {Array.from({ length: Math.floor(maxHp / 25) }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i + 1) * (100 / Math.floor(maxHp / 25))}%`,
            top: 0, bottom: 0, width: 1,
            background: "rgba(0,0,0,0.3)",
          }} />
        ))}
      </div>

      {/* Числа HP */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 2,
        font: `600 13px 'Rajdhani'`,
        color: barColor,
        tabularNums: true,
      }}>
        <span>{hp}</span>
        <span style={{ color: COLORS.text_secondary }}>/{maxHp}</span>
      </div>

      {/* Броня (если есть) */}
      {showArmor && armor > 0 && (
        <div style={{
          position: "absolute", top: -8, right: 0,
          background: "#1A3A5C",
          border: "1px solid #4A90D9",
          borderRadius: 4, padding: "1px 6px",
          font: `700 12px 'Rajdhani'`,
          color: "#88CCFF",
          display: "flex", alignItems: "center", gap: 3,
        }}>
          🛡 {armor}
        </div>
      )}
    </div>
  );
}
```

### 5.3 EnergyDisplay — орбы энергии

```typescript
// components/game/EnergyDisplay.tsx
// Энергия = орбы (как Slay the Spire), а не просто число

export function EnergyDisplay({ current, max }: { current: number; max: number }) {
  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "center",
    }}>
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: i < current ? [1, 1.15, 1] : 1,
            opacity: i < current ? 1 : 0.25,
          }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          style={{
            width: 24, height: 24,
            borderRadius: "50%",
            background: i < current
              ? "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)"
              : "radial-gradient(circle, #333, #1A1A1A)",
            border: i < current
              ? "1.5px solid rgba(255,215,0,0.6)"
              : "1.5px solid #444",
            boxShadow: i < current
              ? "0 0 8px rgba(255,215,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)"
              : "none",
          }}
        />
      ))}
      <span style={{
        font: `700 16px 'Rajdhani'`,
        color: COLORS.gold,
        marginLeft: 4,
      }}>
        {current}/{max}
      </span>
    </div>
  );
}
```

### 5.4 StatusEffects — визуальные иконки эффектов

```typescript
// components/game/StatusEffects.tsx
const EFFECT_ICONS: Record<EffectType, { icon: string; color: string; label: string }> = {
  block:         { icon: "🛡️", color: "#4A90D9", label: "Блок" },
  distraction:   { icon: "😵", color: "#E74C3C", label: "Помехи" },
  invulnerability:{ icon: "✨", color: "#F1C40F", label: "Неуязв." },
  strength_up:   { icon: "⬆️", color: "#E74C3C", label: "Сила" },
  energy_steal:  { icon: "⚡", color: "#9B59B6", label: "Кража ⚡" },
  armor_ignore:  { icon: "🔥", color: "#E67E22", label: "Пробой" },
  heal:          { icon: "💚", color: "#2ECC71", label: "Лечение" },
  propaganda:    { icon: "📺", color: "#E74C3C", label: "Пропаганда" },
  sanction:      { icon: "🚫", color: "#E74C3C", label: "Санкции" },
};

export function StatusEffects({ effects }: { effects: ActiveEffect[] }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {effects.map((effect, i) => {
        const config = EFFECT_ICONS[effect.type];
        return (
          <motion.div
            key={`${effect.type}-${i}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            title={`${config.label}: ${effect.value} (ещё ${effect.duration} ход.)`}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              background: `${config.color}22`,
              border: `1px solid ${config.color}88`,
              borderRadius: 4, padding: "2px 6px",
              font: `600 11px 'Rajdhani'`,
              color: config.color,
              cursor: "help",
            }}
          >
            <span style={{ fontSize: 12 }}>{config.icon}</span>
            <span>{effect.duration}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
```

### 5.5 PhaseAnnouncer — анонсы фаз

```typescript
// components/game/PhaseAnnouncer.tsx
// Как в файтингах: крупный текст анонса фазы появляется и исчезает

const PHASE_TEXT: Record<GamePhase, { ru: string; color: string; size: string }> = {
  energy_recovery: { ru: "ВОССТАНОВЛЕНИЕ",  color: "#FFD700", size: "hero" },
  card_draw:       { ru: "ДОБОР КАРТ",       color: "#4A90D9", size: "hero" },
  ability:         { ru: "ФАЗА СПОСОБНОСТЕЙ",color: "#9B59B6", size: "hero" },
  battle:          { ru: "БИТВА!",           color: "#E8372C", size: "hero" },
  end_turn:        { ru: "КОНЕЦ ХОДА",       color: "#8A9BA8", size: "xl"   },
};

export function PhaseAnnouncer({ phase, visible }: { phase: GamePhase; visible: boolean }) {
  const config = PHASE_TEXT[phase];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1,   y: 0 }}
          exit={{   opacity: 0, scale: 1.3,  y: -30 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          {/* Тёмный backdrop */}
          <div style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            borderRadius: 12,
            padding: "16px 40px",
            border: `2px solid ${config.color}44`,
          }}>
            <div style={{
              font: `900 ${config.size === "hero" ? "42px" : "28px"} 'Cinzel Decorative'`,
              color: config.color,
              textShadow: `0 0 30px ${config.color}`,
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}>
              {config.ru}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

### 5.6 Экран результата боя

```typescript
// components/game/BattleResult.tsx
// Кинематографичный экран победы/поражения

export function BattleResult({ winner, playerNum, stats, onContinue }) {
  const isWin = winner === playerNum;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: "absolute", inset: 0, zIndex: 200,
        background: isWin
          ? "radial-gradient(ellipse at center, rgba(212,175,55,0.3), rgba(0,0,0,0.95))"
          : "radial-gradient(ellipse at center, rgba(200,0,0,0.2), rgba(0,0,0,0.95))",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}
    >
      {/* Главная надпись */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.3 }}
        style={{
          font: `900 72px 'Cinzel Decorative'`,
          color: isWin ? COLORS.gold : "#CC2200",
          textShadow: `0 0 60px ${isWin ? COLORS.gold_glow : COLORS.red_glow}`,
          letterSpacing: "8px",
        }}
      >
        {isWin ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
      </motion.div>

      {/* Статистика */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        style={{
          background: COLORS.bg_glass,
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16, padding: "24px 40px",
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 32px",
          textAlign: "center",
        }}
      >
        <StatItem label="Ходов" value={stats.totalTurns} />
        <StatItem label="Нанесено урона" value={stats.totalDamageDealt} color={COLORS.red_hot} />
        <StatItem label="Получено урона" value={stats.totalDamageTaken} color={COLORS.text_secondary} />
        <StatItem label="Карт сыграно" value={stats.cardsPlayed} />
        <StatItem label="Исцелено" value={stats.totalHealed} color="#44FF88" />
        <StatItem label="Макс. урон за ход" value={stats.maxDamageInOneTurn} color={COLORS.gold} />
      </motion.div>

      {/* Кнопки */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        style={{ display: "flex", gap: 16 }}
      >
        <Button variant="outline" onClick={() => router.push("/game/ai")}>
          Реванш
        </Button>
        <Button onClick={() => router.push("/")}>
          В главное меню
        </Button>
      </motion.div>
    </motion.div>
  );
}
```

---

## ЧАСТЬ 6: ГЕЙМПЛЕЙНЫЙ БАЛАНС И ROGUELIKE-МЕХАНИКИ

### 6.1 Диагноз: почему HP не двигается

**Текущие проблемы:**
- Базовая броня 25-35 поглощает почти весь урон карт (15-30)
- Нет критических ударов
- Нет механики накопления силы
- ИИ играет защитно

**Реформа цифр:**

```typescript
// lib/game/balance.ts — НОВЫЕ КОНСТАНТЫ

export const BALANCE = {
  // Базовая броня СНИЖЕНА
  BASE_ARMOR_MULTIPLIER: 0.6,  // броня теперь в 1.6× меньше

  // Карты наносят РЕАЛЬНЫЙ урон
  BASE_DAMAGE_MULTIPLIER: 1.4,

  // Пример: vp-bear "45 урона" с броней 40:
  // БЫЛО: 45 - 40 = 5 урона (смешно)
  // СТАЛО (броня 24): 45 - 24 = 21 урона (ощущается)

  // Лимит поглощения броней — не более 60% урона
  ARMOR_CAP_RATIO: 0.6,

  // Критический удар: 15% шанс, 1.8× урон
  CRIT_CHANCE: 0.15,
  CRIT_MULTIPLIER: 1.8,

  // Трансформация при 33% HP (не 0%)
  TRANSFORM_THRESHOLD: 0.33,

  // Таймер хода — 90 секунд (было 60)
  TURN_TIMER: 90,

  // Восстановление энергии: +3 каждый ход (было +2)
  ENERGY_REGEN: 3,
} as const;
```

### 6.2 Обновлённый расчёт урона

```typescript
// lib/game/effects.ts
export function calculateDamage(
  baseDamage: number,
  attacker: MatchPlayer,
  defender: MatchPlayer,
  card: AbilityCard,
): DamageResult {
  let damage = baseDamage;

  // 1. Модификаторы атакующего
  const strengthBonus = attacker.strength / 10;
  damage = Math.floor(damage * (1 + strengthBonus));

  // 2. Усиления от активных эффектов атакующего
  const strengthEffect = attacker.activeEffects.find(e => e.type === "strength_up");
  if (strengthEffect) damage = Math.floor(damage * (1 + strengthEffect.value / 100));

  // 3. Критический удар
  let isCrit = false;
  if (Math.random() < BALANCE.CRIT_CHANCE) {
    damage = Math.floor(damage * BALANCE.CRIT_MULTIPLIER);
    isCrit = true;
  }

  // 4. Броня defender (с ограничением)
  let armorAbsorbed = 0;
  if (!card.effect.includes("armor_ignore")) {
    const effectiveArmor = Math.floor(defender.armor * BALANCE.BASE_ARMOR_MULTIPLIER);
    const maxAbsorb = Math.floor(damage * BALANCE.ARMOR_CAP_RATIO);
    armorAbsorbed = Math.min(effectiveArmor, maxAbsorb);
    damage = Math.max(1, damage - armorAbsorbed);  // минимум 1 урона всегда
  }

  // 5. Пассивка Владимира Пу: -20% урона
  if (defender.characterId === "vladimir-pu") {
    const passiveEffect = defender.activeEffects.find(e =>
      e.source === "passive-pu" && e.type === "block"
    );
    if (passiveEffect) {
      damage = Math.floor(damage * (1 - passiveEffect.value));
    }
  }

  // 6. Блок-эффект
  const blockEffect = defender.activeEffects.find(e => e.type === "block" && e.source !== "passive-pu");
  if (blockEffect) {
    const blocked = Math.min(blockEffect.value, damage);
    damage = Math.max(0, damage - blocked);
  }

  // 7. Инвулерабельность
  if (defender.activeEffects.some(e => e.type === "invulnerability")) {
    damage = 0;
  }

  return {
    finalDamage: damage,
    armorAbsorbed,
    isCrit,
    isBlocked: damage === 0 && baseDamage > 0,
    rawDamage: baseDamage,
  };
}
```

### 6.3 Roguelike-механики

#### 6.3.1 Система реликвий (Relic System)

```typescript
// lib/game/relics.ts
// Реликвии — пассивные усиления, выбираемые перед матчем
// (как в Slay the Spire, но для PvP: оба выбирают по 1 реликвии)

interface Relic {
  id: string;
  name: string;
  description: string;
  effect: (player: MatchPlayer, event: GameEvent) => MatchPlayer;
  flavorText: string;
}

export const ALL_RELICS: Relic[] = [
  {
    id: "iron-will",
    name: "Железная воля",
    description: "Когда HP падает ниже 30%, получить +2 энергии",
    flavorText: "Ломаться нельзя.",
    effect: (player, event) => {
      if (event.type === "hp_changed" && player.hp / player.maxHp < 0.3) {
        return { ...player, energy: Math.min(player.energy + 2, player.maxEnergy) };
      }
      return player;
    },
  },
  {
    id: "blood-price",
    name: "Цена крови",
    description: "Карты стоимостью 0 наносят +5 урона",
    flavorText: "Бесплатно только сыр в мышеловке.",
    effect: (player, event) => {
      if (event.type === "card_played" && event.card.cost === 0) {
        return { ...player, tempDamageBonus: (player.tempDamageBonus ?? 0) + 5 };
      }
      return player;
    },
  },
  {
    id: "dark-pact",
    name: "Тёмный пакт",
    description: "В начале хода: -5 HP, +1 карта в руку",
    flavorText: "Выгодная сделка для того, кто выживет.",
    effect: (player, event) => {
      if (event.type === "turn_start") {
        return {
          ...player,
          hp: Math.max(1, player.hp - 5),
          hand: [...player.hand, drawCard(player.deck)],
        };
      }
      return player;
    },
  },
  {
    id: "echo-chamber",
    name: "Эхо-камера",
    description: "Каждая сыгранная карта с ценой ≥ 4 повторяет эффект с 50% силой",
    flavorText: "Медиа-пространство работает на тебя.",
    effect: (player, event) => {
      if (event.type === "card_played" && event.card.cost >= 4) {
        return { ...player, pendingEcho: { card: event.card, strength: 0.5 } };
      }
      return player;
    },
  },
  {
    id: "war-chest",
    name: "Военная казна",
    description: "Максимум энергии +1",
    flavorText: "Деньги решают.",
    effect: (player, _event) => ({ ...player, maxEnergy: player.maxEnergy + 1 }),
  },
];
```

#### 6.3.2 Экран выбора реликвии (перед матчем)

```typescript
// components/game/RelicSelect.tsx
// Показывается после выбора персонажа, перед загрузкой матча
// Даётся 3 случайные реликвии, выбрать 1

export function RelicSelect({ onSelect }: { onSelect: (relicId: string) => void }) {
  const [offered] = useState(() => shuffleArray(ALL_RELICS).slice(0, 3));
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.9)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 32,
    }}>
      <h2 style={{
        font: `700 32px 'Cinzel Decorative'`,
        color: COLORS.gold,
        textShadow: `0 0 20px ${COLORS.gold_glow}`,
      }}>
        Выберите реликвию
      </h2>

      <div style={{ display: "flex", gap: 24 }}>
        {offered.map(relic => (
          <RelicCard
            key={relic.id}
            relic={relic}
            isSelected={selected === relic.id}
            onClick={() => setSelected(relic.id)}
          />
        ))}
      </div>

      <Button
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
        style={{ marginTop: 16, minWidth: 200 }}
      >
        В бой!
      </Button>
    </div>
  );
}
```

#### 6.3.3 Трансформация формы — кинематографическая сцена

```typescript
// components/game/TransformScene.tsx
// При трансформации — полноэкранная анимация (2-3 секунды)

export function TransformScene({
  characterId, fromForm, toForm, onComplete
}: TransformSceneProps) {
  useEffect(() => {
    // Автозакрытие через 2.5 секунды
    const t = setTimeout(onComplete, 2500);
    return () => clearTimeout(t);
  }, []);

  const newForm = FORM_STATS[characterId][toForm - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "radial-gradient(ellipse, rgba(255,215,0,0.3), black)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
    >
      {/* Вспышка */}
      <motion.div
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 20, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          position: "absolute",
          width: 100, height: 100,
          borderRadius: "50%",
          background: "radial-gradient(circle, white, rgba(255,215,0,0.5))",
        }}
      />

      {/* Новая форма */}
      <motion.img
        src={`/assets/characters/${characterId}/form${toForm}_large.png`}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
        style={{ height: 400, objectFit: "contain" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        style={{
          textAlign: "center",
          marginTop: 24,
        }}
      >
        <div style={{
          font: `900 48px 'Cinzel Decorative'`,
          color: COLORS.gold,
          textShadow: `0 0 40px ${COLORS.gold_glow}`,
          letterSpacing: "4px",
        }}>
          ТРАНСФОРМАЦИЯ
        </div>
        <div style={{
          font: `700 24px 'Rajdhani'`,
          color: COLORS.text_primary,
          marginTop: 8,
        }}>
          {newForm.name}
        </div>
        <div style={{
          font: `400 16px 'Crimson Text'`,
          color: COLORS.text_secondary,
          marginTop: 8,
        }}>
          {`HP: ${newForm.maxHp} · Броня: ${newForm.armor} · Энергия: ${newForm.maxEnergy}`}
        </div>
      </motion.div>
    </motion.div>
  );
}
```

### 6.4 Улучшенный ИИ

```typescript
// lib/game/ai.ts — НОВЫЙ ИИ С 3 УРОВНЯМИ

type AIDifficulty = "easy" | "normal" | "hard";

export function makeAiDecision(
  match: Match,
  playerNum: 1 | 2,
  difficulty: AIDifficulty = "normal"
): string[] {
  const player   = playerNum === 1 ? match.player1 : match.player2;
  const opponent = playerNum === 1 ? match.player2 : match.player1;

  // Easy: случайные доступные карты
  if (difficulty === "easy") {
    const affordable = player.hand.filter(c => c.cost <= player.energy);
    return affordable.length > 0
      ? [affordable[Math.floor(Math.random() * affordable.length)].id]
      : [];
  }

  // Normal: эвристика с учётом состояния
  const affordable = player.hand.filter(c => c.cost <= player.energy);
  if (affordable.length === 0) return [];

  const playerHpRatio = player.hp / player.maxHp;
  const opponentHpRatio = opponent.hp / opponent.maxHp;

  // Приоритизация по ситуации
  const scored = affordable.map(card => {
    let score = 0;
    const eff = card.effect;

    // Урон всегда хорош
    const dmgMatch = eff.match(/damage:(\d+)/);
    if (dmgMatch) score += parseInt(dmgMatch[1]) * 0.8;

    // Защита важнее при низком HP
    const blockMatch = eff.match(/block:(\d+)/);
    if (blockMatch) score += parseInt(blockMatch[1]) * (playerHpRatio < 0.4 ? 1.5 : 0.5);

    // Лечение при низком HP
    if (eff.includes("heal")) score += playerHpRatio < 0.3 ? 40 : 10;

    // Дорогие карты ценнее
    score += card.cost * 3;

    // Ultimate только если может убить
    if (card.type === "ultimate" && opponentHpRatio < 0.4) score += 30;

    // Hard: учитывает контр-игру
    if (difficulty === "hard") {
      // Если у врага блок — играй armor_ignore
      if (opponent.activeEffects.some(e => e.type === "block") && eff.includes("armor_ignore")) {
        score += 25;
      }
      // Если у нас низкая энергия — предпочесть дешёвые карты и подкопить
      if (player.energy <= 2) score -= card.cost * 5;
    }

    return { id: card.id, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Разыгрываем топ-1 (или топ-2 если энергии хватает)
  const best = scored[0];
  const bestCard = affordable.find(c => c.id === best.id)!;
  const selectedIds = [best.id];

  if (difficulty === "hard" && scored.length > 1) {
    const second = affordable.find(c => c.id === scored[1].id);
    if (second && bestCard.cost + second.cost <= player.energy) {
      selectedIds.push(scored[1].id);
    }
  }

  return selectedIds;
}
```

---

## ЧАСТЬ 7: АНИМАЦИИ И GAME FEEL

### 7.1 Список всех анимаций (требования)

| Событие | Анимация | Длительность | Приоритет |
|---------|----------|-------------|-----------|
| Получить урон | Отброс + вспышка + экранная тряска | 400ms | 🔴 |
| Критический удар | Всё выше × 2 + кадровая заморозка 100ms | 600ms | 🔴 |
| Умереть (не трансформация) | Падение + исчезновение | 500ms | 🔴 |
| Трансформация | Полноэкранная сцена | 2500ms | 🔴 |
| Сыграть карту | Карта летит из руки в центр | 350ms | 🔴 |
| Блок урона | Золотой щит-вспышка | 300ms | 🟡 |
| Лечение | Зелёные частицы вверх | 500ms | 🟡 |
| Победа | Конфетти + золотое свечение | — | 🟡 |
| Добор карты | Карта слетает с колоды в руку | 200ms | 🟡 |
| Начало хода | PhaseAnnouncer | 800ms | 🟡 |
| Наведение на карту | Вылет вверх + тень | 150ms | 🟢 |
| Выбор карты | Подъём + выделение | 100ms | 🟢 |
| Анонс матча | Персонажи выезжают навстречу | 1500ms | 🟢 |

### 7.2 ScreenShake — тряска экрана

```typescript
// hooks/useScreenShake.ts
import { useGameEffectStore } from "@/lib/game/effectStore";
import { useRef, useEffect } from "react";
import gsap from "gsap";

export function useScreenShake(containerRef: React.RefObject<HTMLDivElement>) {
  const shakeEvent = useGameEffectStore(s => s.currentShake);

  useEffect(() => {
    if (!shakeEvent || !containerRef.current) return;

    const intensity = shakeEvent.type === "crit" ? 12 :
                      shakeEvent.type === "damage" ? 6 : 3;
    const duration = shakeEvent.type === "crit" ? 0.6 : 0.3;

    gsap.timeline()
      .to(containerRef.current, {
        x: `+=${intensity}`, y: `-=${intensity / 2}`,
        duration: duration * 0.15, ease: "none"
      })
      .to(containerRef.current, {
        x: `-=${intensity * 1.5}`, y: `+=${intensity}`,
        duration: duration * 0.15, ease: "none"
      })
      .to(containerRef.current, {
        x: `+=${intensity}`, y: `-=${intensity * 0.7}`,
        duration: duration * 0.15, ease: "none"
      })
      .to(containerRef.current, { x: 0, y: 0, duration: duration * 0.55, ease: "elastic.out(1, 0.5)" });

  }, [shakeEvent]);
}
```

### 7.3 CardPlayAnimation — карта летит к цели

```typescript
// hooks/useCardPlayAnimation.ts
// Когда игрок нажимает "Разыграть" — карты летят в центр сцены

export function useCardPlayAnimation() {
  const playAnimation = (cardElement: HTMLElement, targetPosition: { x: number; y: number }) => {
    const rect = cardElement.getBoundingClientRect();
    const clone = cardElement.cloneNode(true) as HTMLElement;

    clone.style.position = "fixed";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.zIndex = "1000";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);

    gsap.timeline({
      onComplete: () => clone.remove()
    })
      .to(clone, {
        left: targetPosition.x,
        top: targetPosition.y,
        scale: 1.3,
        duration: 0.25,
        ease: "power2.in"
      })
      .to(clone, {
        scale: 0,
        opacity: 0,
        duration: 0.15,
      });
  };

  return { playAnimation };
}
```

---

## ЧАСТЬ 8: GAME FLOW

### 8.1 Полный поток игровой сессии

```
СТАРТ
  ↓
[Выбор персонажа]
  Карусель 4 персонажей с 3D-превью
  Статы на карточке
  ↓
[Выбор реликвии]
  3 случайные реликвии, выбрать 1
  Превью эффекта
  ↓
[Loading Screen]
  Арена появляется за туманом
  Персонажи влетают с разных сторон
  "VS" — анимация
  ↓
[Начало матча]
  Phase: ENERGY RECOVERY (автоматически, 1 сек)
    → +3 энергии
    → PhaseAnnouncer
  Phase: CARD DRAW (автоматически, 0.5 сек)
    → анимация добора карт
    → PhaseAnnouncer
  Phase: ABILITY (игрок действует)
    → Карты в руке доступны
    → Таймер 90 сек
    → Игрок выбирает карты → нажимает "Разыграть"
    → Карты летят в центр
    → Индикатор ожидания противника
  Phase: BATTLE (автоматически, 2-3 сек)
    → PhaseAnnouncer "БИТВА!"
    → Карты разыгрываются по скорости
    → Числа урона летят
    → Экранная тряска
    → Трансформации (если нужно)
  Phase: END_TURN
    → Тик эффектов
    → Проверка победителя
    → Следующий ход или...
  ↓ (если один умер)
[BattleResult Screen]
  Победа/Поражение
  Статистика
  Кнопки
```

### 8.2 Экран выбора персонажа

```typescript
// components/game/CharacterSelect.tsx
// 3D карусель с @react-three/fiber

export function CharacterSelect({ onSelect }: { onSelect: (id: string) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const characters = Object.values(CHARACTER_DATA);
  const active = characters[activeIndex];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at 50% 80%, #1A0A00, #08080F)",
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 32,
      paddingTop: 60,
    }}>
      <h1 style={{
        font: `900 36px 'Cinzel Decorative'`,
        color: COLORS.gold,
        letterSpacing: "4px",
      }}>
        ВЫБЕРИТЕ ПЕРСОНАЖА
      </h1>

      {/* 3D превью персонажа */}
      <div style={{ width: 400, height: 500, position: "relative" }}>
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[2, 2, 2]} intensity={2} color={getCharacterColor(active.id)} />
          <CharacterMesh
            characterId={active.id}
            form={1}
            position={[0, -0.5, 0]}
            facing="right"
            hp={active.stats.hp}
            maxHp={active.stats.hp}
            isPlayer={true}
            pendingEffect={null}
          />
          <EffectComposer>
            <Bloom intensity={0.8} luminanceThreshold={0.5} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Карусель */}
      <div style={{ display: "flex", gap: 16 }}>
        {characters.map((char, i) => (
          <motion.div
            key={char.id}
            onClick={() => setActiveIndex(i)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: 120, height: 160,
              borderRadius: 12,
              background: i === activeIndex
                ? `linear-gradient(145deg, ${getCharacterColor(char.id)}33, #161824)`
                : COLORS.bg_surface,
              border: i === activeIndex
                ? `2px solid ${getCharacterColor(char.id)}`
                : "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 8, padding: 12,
              boxShadow: i === activeIndex
                ? `0 0 20px ${getCharacterColor(char.id)}44`
                : "none",
            }}
          >
            <img
              src={`/assets/characters/${char.id}/portrait.png`}
              style={{ width: 64, height: 64, objectFit: "contain" }}
            />
            <div style={{ font: `700 12px 'Cinzel Decorative'`, color: COLORS.text_primary, textAlign: "center" }}>
              {char.name}
            </div>
            <div style={{ font: `500 11px 'Rajdhani'`, color: COLORS.text_secondary }}>
              {char.country}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Стат-карточка */}
      <CharacterStatCard character={active} />

      <Button
        onClick={() => onSelect(active.id)}
        style={{ minWidth: 240, height: 48 }}
      >
        Выбрать {active.name}
      </Button>
    </div>
  );
}
```

---

## ЧАСТЬ 9: CURSOR PROMPTS

### 9.1 Мастер-промпт (запустить первым)

```
Ты реализуешь игру "World Order" — браузерная карточная TCG-файтинг
в стиле политической карикатуры.

Стек: Next.js 15 + TypeScript 5 + Three.js (через @react-three/fiber) +
      Framer Motion + GSAP + shadcn/ui

Целевой стандарт качества: Slay the Spire (MegaCrit, 2017).
Каждый компонент должен быть на уровне AAA — с анимациями, обратной
связью на действия, красивым визуальным стилем.

ПРАВИЛА:
1. Никогда не создавай плоский серый placeholder — если нет арта, используй CSS градиент
2. Каждое игровое событие должно иметь визуальный отклик
3. Никаких статичных экранов — анимация при каждом переходе
4. Тёмная тема с золотыми/красными акцентами (токены из lib/design/tokens.ts)
5. Шрифты: Cinzel Decorative (заголовки), Rajdhani (UI/цифры), Crimson Text (описания)

После создания каждого компонента — самостоятельно проверь:
  □ Есть ли анимации?
  □ Есть ли обратная связь на действия?
  □ Читается ли визуально?
  □ Соответствует ли дизайн-токенам?
Если нет — исправь до отправки.
```

### 9.2 AGENT-A: ThreeJS Scene

```
ЗАДАЧА AGENT-A: Создать компонент BattleScene на Three.js

Файлы для создания:
  - components/game/BattleScene.tsx
  - components/game/three/CharacterMesh.tsx
  - components/game/three/ArenaEnvironment.tsx
  - components/game/three/ParticleSystem.tsx
  - components/game/three/DamageNumbers.tsx
  - lib/three/effectStore.ts (Zustand-стор для эффектов)

Реализовать по спецификации из ТЗ v2.0, раздел 3.

Критерии качества (Critic Agent проверит):
  1. Персонажи — 2D-иллюстрации на plane-геометрии с прозрачностью
  2. Idle-анимация: лёгкое покачивание (sin-функция)
  3. При ударе: отброс назад + вспышка цвета
  4. Фон: как минимум 2 слоя параллакса
  5. Bloom post-processing включён
  6. 60fps без просадок

ЗАПУСТИТЬ CRITIC LOOP: После создания — передать файлы на ревью к
Critic Agent. Исправлять до получения "APPROVED".
```

### 9.3 AGENT-B: Cards System

```
ЗАДАЧА AGENT-B: Создать систему карт AAA-уровня

Файлы:
  - components/game/Card.tsx
  - components/game/Hand.tsx
  - components/game/CardTooltip.tsx

По спецификации раздела 4 из ТЗ v2.0.

Обязательно:
  □ Карты расположены веером (rotation, translateY по индексу)
  □ Hover: карта вылетает вверх, выравнивается, увеличивается
  □ Selected: карта выдвинута выше остальных, светится
  □ Недоступные карты (нет энергии): grayscale(0.6) brightness(0.7)
  □ Orb энергии в левом углу карты (не просто цифра)
  □ Полоска редкости внизу карты с цветом rarity
  □ Cinzel Decorative для названия карты
  □ Framer Motion для всех анимаций

CRITIC LOOP: Сравни с картами в Slay the Spire. Принять только если
"не отличить от реальной игры при беглом взгляде".
```

### 9.4 AGENT-C: HUD

```
ЗАДАЧА AGENT-C: Боевой HUD

Файлы:
  - components/game/HPBar.tsx
  - components/game/EnergyDisplay.tsx
  - components/game/StatusEffects.tsx
  - components/game/PlayerHUD.tsx
  - components/game/PhaseAnnouncer.tsx
  - components/game/TurnTimer.tsx

По спецификации раздела 5.

Обязательно:
  □ HPBar: цвет меняется зелёный→жёлтый→красный плавно
  □ HPBar: "trailing bar" — серая зона, которая догоняет
  □ HPBar: сегментные деления каждые 25 HP
  □ EnergyDisplay: орбы, не цифры. Орбы загораются при получении энергии
  □ StatusEffects: иконки с тултипом, анимация появления
  □ PhaseAnnouncer: полноэкранный текст между фазами
  □ TurnTimer: убывающая дуга-окружность, краснеет при <15 сек

CRITIC LOOP: Принять только если HUD не перекрывает игровую сцену
и читается за 0.5 секунды без изучения.
```

### 9.5 AGENT-D: Effects & Feedback

```
ЗАДАЧА AGENT-D: Игровая отдача (Game Feel)

Файлы:
  - hooks/useScreenShake.ts
  - hooks/useCardPlayAnimation.ts
  - lib/three/effectStore.ts (добавить методы)
  - components/game/three/ParticleSystem.tsx (расширить)

По спецификации раздела 7.

Обязательно реализовать:
  □ Screen shake при получении урона (интенсивность зависит от урона)
  □ Экранная заморозка 80ms при критическом ударе
  □ Числа урона летят вверх и исчезают (3D DamageNumbers)
  □ Красные числа = урон, зелёные = лечение, золотые = энергия
  □ "КРИТ!" надпись при критическом ударе (красная, крупная)
  □ Партикли при попадании (цвет зависит от типа урона)
  □ Анимация полёта карты из руки к персонажу

CRITIC LOOP: Принять только если "каждое действие ощущается мощно
и удовлетворительно". Сыграть 5 ходов и убедиться что есть кайф.
```

### 9.6 AGENT-E: Balance

```
ЗАДАЧА AGENT-E: Геймплейный баланс

Файлы:
  - lib/game/balance.ts (создать)
  - lib/game/effects.ts (переписать calculateDamage)
  - lib/game/ai.ts (улучшить)
  - lib/game/relics.ts (создать)
  - components/game/RelicSelect.tsx

По спецификации раздела 6.

Обязательно:
  □ HP должно заметно двигаться каждый ход — минимум 15-25 урона за ход
  □ Броня не поглощает более 60% урона
  □ Критические удары: 15% шанс, ×1.8 урон, специальная анимация
  □ Трансформация при 33% HP (не 0%)
  □ Реализовать систему реликвий (5 штук минимум)
  □ Экран выбора реликвии перед матчем
  □ ИИ имеет 3 уровня сложности (easy/normal/hard)

Проверка баланса: провести 10 тестовых матчей ИИ vs ИИ.
Средняя длительность матча: 8-14 ходов (не 3, не 30).
CRITIC LOOP: Принять только если матч ощущается как настоящий бой.
```

### 9.7 AGENT-F: Game Flow

```
ЗАДАЧА AGENT-F: Поток игровой сессии

Файлы:
  - components/game/CharacterSelect.tsx
  - components/game/RelicSelect.tsx (интеграция с E)
  - components/game/BattleIntro.tsx (анонс матча)
  - components/game/TransformScene.tsx
  - components/game/BattleResult.tsx
  - app/game/[id]/page.tsx (переработать)

По спецификации раздела 8.

Поток:
  CharacterSelect → RelicSelect → BattleIntro → GameBoard → (loop) → BattleResult

Обязательно:
  □ BattleIntro: персонажи влетают с разных сторон, "VS" — анимация, 2 сек
  □ TransformScene: полноэкранная вспышка при трансформации, 2.5 сек
  □ BattleResult: кинематографичный экран с конфетти при победе
  □ Все переходы — через Framer Motion AnimatePresence
  □ Нет мгновенных "телепортаций" между экранами

CRITIC LOOP: Принять только если "это похоже на настоящую игру,
а не на набор экранов".
```

### 9.8 Финальный Critic Loop Промпт

```
ЗАДАЧА CRITIC AGENT (финальная проверка):

Проведи полный сеанс игры: выбор персонажа → реликвия → бой до конца.

По каждому критерию поставь оценку 1-10:

1. Visual Hierarchy   — сразу понятно что важно?
2. Game Feel         — есть отклик на каждое действие?
3. Atmosphere        — ощущается ли мир, арена?
4. Card Readability  — карта читается за 1 взгляд?
5. Animation Polish  — нет рывков и телепортаций?
6. Damage Feedback   — ВИДНО ли что происходит в бою?
7. Character Presence — персонажи живые?
8. UI Consistency    — одинаковый стиль везде?
9. Performance       — стабильные 60fps?
10. AAA Factor       — можно спутать с Slay the Spire?

ЕСЛИ ЛЮБОЙ < 9:
  Напиши конкретный issue: файл + строка + что именно исправить
  Передай обратно соответствующему агенту
  Агент исправляет → снова на ревью
  Максимум 5 итераций

ПРИНЯТЬ только когда ALL >= 9.

После принятия написать: "WORLD ORDER — READY FOR MULTIPLAYER TESTING"
```

---

## ДОПОЛНЕНИЕ: Технические требования к арт-ассетам

### Asset Checklist

```
/public/assets/
├── characters/
│   ├── donald-rumpf/
│   │   ├── portrait.png        (128x128 для выбора персонажа)
│   │   ├── form1.png           (512x768, прозрачный фон, для ThreeJS)
│   │   ├── form2.png
│   │   ├── form3.png
│   │   └── form3_large.png     (768x1152, для экрана трансформации)
│   ├── vladimir-pu/   (аналогично)
│   ├── jin-shi/       (аналогично)
│   └── vlado-zelenko/ (аналогично)
│
├── cards/
│   ├── {card-id}.png           (256x180 для каждой карты)
│   ├── placeholder_common.png
│   ├── placeholder_rare.png
│   ├── placeholder_epic.png
│   └── placeholder_legendary.png
│
├── arenas/
│   ├── usa/    (sky.jpg, bg1_capitol.png, bg2_flags.png, floor_marble.jpg)
│   ├── russia/ (sky_night.jpg, bg1_kremlin.png, bg2_snow.png, floor_stone.jpg)
│   ├── china/  (sky_dusk.jpg, bg1_forbidden_city.png, ...)
│   └── ukraine/(sky_dawn.jpg, bg1_bunker.png, ...)
│
└── ui/
    ├── relic_{id}.png          (64x64 иконки реликвий)
    ├── effect_block.png        (32x32 иконки эффектов)
    └── turn_indicator.png
```

### CSS-анимации (globals.css)

```css
@keyframes legendaryPulse {
  0%, 100% { opacity: 0.15; transform: scale(1); }
  50%       { opacity: 0.3;  transform: scale(1.05); }
}

@keyframes energyOrb {
  0%   { transform: scale(0.8); filter: brightness(0.7); }
  50%  { transform: scale(1.15); filter: brightness(1.3); }
  100% { transform: scale(1); filter: brightness(1); }
}

@keyframes damageShake {
  0%, 100% { transform: translate(0, 0); }
  20%       { transform: translate(-6px, 3px); }
  40%       { transform: translate(6px, -3px); }
  60%       { transform: translate(-4px, 2px); }
  80%       { transform: translate(4px, -2px); }
}

@keyframes critFlash {
  0%   { filter: brightness(1); }
  10%  { filter: brightness(4) invert(1); }
  20%  { filter: brightness(1); }
}

@keyframes floatUp {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-80px); opacity: 0; }
}
```

---

*Документ: World Order UI & Gameplay TZ v2.0*
*Версия: 2.0.0*
*Стандарт: AAA → Slay the Spire × Guilty Gear Strive*
*Multi-Agent: 6 параллельных агентов + 1 Critic Loop*
