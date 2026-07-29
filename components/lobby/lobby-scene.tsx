"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, invalidate, useFrame, useThree } from "@react-three/fiber";
import { useDetectGPU } from "@react-three/drei";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { ArenaEnvironment } from "@/components/game/three/arena-environment";
import { CharacterMesh } from "@/components/game/three/character-mesh";
import { ParticleSystem } from "@/components/game/three/particle-system";
import { StaticLobbyBackdrop } from "@/components/lobby/static-backdrop";
import {
  LOBBY_VARIANTS,
  type LobbyVariant,
  type LobbyVariantConfig,
} from "@/components/lobby/variants";
import { COLORS, getArenaIdForCharacter } from "@/lib/design/tokens";
import { useGameEffectStore } from "@/lib/three/effect-store";

/** Что показывает сцена. `lobby` — комната с пустым слотом соперника. */
export type LobbySceneMode = "solo" | "lobby" | "search" | "versus";

export interface LobbySceneProps {
  mode: LobbySceneMode;
  myCharacterId: string;
  /** null — слот соперника пуст, рисуем силуэт. */
  opponentCharacterId: string | null;
  myReady?: boolean;
  opponentReady?: boolean;
  /** Окно подбора из `queue_state`; -1 — без ограничений. */
  searchWindow?: number;
  /** Растёт на каждом расширении окна — по нему бьёт импульс частиц. */
  expandTick?: number;
  /** A/B-композиция камеры и портала. */
  variant?: LobbyVariant;
}

/** Столько секунд без ввода — и сцена перестаёт рисовать кадры сама по себе. */
const IDLE_PAUSE_MS = 30_000;

/** Уровень качества, выбранный по железу. Не настройка — автоматическая деградация. */
export type SceneQuality = "none" | "lite" | "full";

/**
 * tier 0 — интегрированное видео или программный рендер: Canvas не монтируем.
 * tier 1 — слабая дискретка: без постпроцессинга, теней и сглаживания.
 */
export function qualityForTier(tier: number): SceneQuality {
  if (tier <= 0) return "none";
  if (tier <= 1) return "lite";
  return "full";
}

const DEFAULT_VARIANT = LOBBY_VARIANTS.a;

function portalRadius(searchWindow: number): number {
  if (searchWindow < 0) return 2.6;
  return 1.7 + Math.min(searchWindow / 800, 1) * 0.75;
}

function portalSpeed(searchWindow: number): number {
  if (searchWindow < 0) return 1.5;
  return 0.45 + Math.min(searchWindow / 800, 1) * 0.9;
}

function CameraRig({ target, instant }: { target: [number, number, number]; instant: boolean }) {
  const camera = useThree((state) => state.camera);
  const goal = useMemo(() => new THREE.Vector3(...target), [target]);

  useEffect(() => {
    if (instant) {
      camera.position.copy(goal);
      camera.lookAt(0, 0.6, 0);
      invalidate();
    }
  }, [camera, goal, instant]);

  useFrame((_, delta) => {
    if (instant) return;
    camera.position.lerp(goal, Math.min(1, delta * 2.2));
    camera.lookAt(0, 0.6, 0);
  });

  return null;
}

/** Пустой слот соперника: тёмный силуэт с медленным дыханием, а не пустота. */
function EmptySlot({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const pulse = 0.16 + Math.sin(state.clock.elapsedTime * 1.1) * 0.06;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = pulse;
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <planeGeometry args={[2.2, 3.4]} />
        <meshBasicMaterial
          color={COLORS.text_secondary}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, -1.74, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.88, 48]} />
        <meshBasicMaterial
          color={COLORS.text_secondary}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Кольцо готовности: загорается золотом, гаснет заметно — соперник должен увидеть. */
function ReadyRing({
  position,
  active,
  color,
}: {
  position: [number, number, number];
  active: boolean;
  color: string;
}) {
  const ref = useRef<THREE.MeshBasicMaterial>(null);
  const current = useRef(0);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const goal = active ? 1 : 0;
    current.current += (goal - current.current) * Math.min(1, delta * 4);
    const flicker = active
      ? 0.75 + Math.sin(state.clock.elapsedTime * 3.4) * 0.25
      : 1;
    ref.current.opacity = current.current * flicker;
  });

  return (
    <mesh
      position={[position[0], position[1] - 1.7, position[2] + 0.08]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.92, 1.16, 64]} />
      <meshBasicMaterial
        ref={ref}
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Портал поиска: два встречно вращающихся тора. Скорость и радиус растут вместе
 * с окном подбора — расширение окна видно физически, а не только текстом.
 */
function SearchPortal({
  searchWindow,
  expandTick,
  animate,
  offsetX = 0,
}: {
  searchWindow: number;
  expandTick: number;
  animate: boolean;
  offsetX?: number;
}) {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const scale = useRef(0.6);
  const flash = useRef(0);

  const goalRadius = portalRadius(searchWindow);
  const speed = portalSpeed(searchWindow);

  useEffect(() => {
    flash.current = 1;
    invalidate();
  }, [expandTick]);

  useFrame((state, delta) => {
    scale.current += (goalRadius - scale.current) * Math.min(1, delta * 1.6);
    flash.current = Math.max(0, flash.current - delta * 1.4);

    const boost = 1 + flash.current * 0.35;
    const t = animate ? state.clock.elapsedTime : 0;

    if (outer.current) {
      outer.current.scale.setScalar(scale.current * boost);
      outer.current.rotation.z = t * speed * 0.5;
      outer.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.12;
    }
    if (inner.current) {
      inner.current.scale.setScalar(scale.current * 0.72 * boost);
      inner.current.rotation.z = -t * speed * 0.8;
      inner.current.rotation.y = t * speed * 0.3;
    }
  });

  return (
    <group position={[offsetX, 0.4, -0.6]}>
      <mesh ref={outer}>
        <torusGeometry args={[1, 0.022, 12, 96]} />
        <meshBasicMaterial
          color={COLORS.gold_glow}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={inner}>
        <torusGeometry args={[1, 0.014, 10, 72]} />
        <meshBasicMaterial
          color={COLORS.gold}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Фолбэк внутри Canvas: пока грузятся текстуры арены, игрок видит тёмную сцену
 * с живым кольцом, а не чёрный прямоугольник. DOM-фолбэк тут не годится —
 * дети Canvas обязаны быть объектами сцены.
 */
function LoadingStage() {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ring.current) return;
    const t = state.clock.elapsedTime;
    ring.current.rotation.z = t * 0.6;
    ring.current.scale.setScalar(1 + Math.sin(t * 1.8) * 0.06);
  });

  return (
    <>
      <color attach="background" args={[COLORS.bg_void]} />
      <ambientLight intensity={0.3} />
      <mesh ref={ring} position={[0, 0.6, 0]}>
        <torusGeometry args={[1.1, 0.02, 10, 72]} />
        <meshBasicMaterial
          color={COLORS.gold}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function LobbyWorld({
  mode,
  myCharacterId,
  opponentCharacterId,
  myReady,
  opponentReady,
  searchWindow,
  expandTick,
  quality,
  animate,
  layout,
}: LobbySceneProps & {
  quality: Exclude<SceneQuality, "none">;
  animate: boolean;
  layout: LobbyVariantConfig;
}) {
  const duo =
    mode === "versus" || mode === "lobby" || opponentCharacterId !== null;
  const arenaId = getArenaIdForCharacter(myCharacterId);
  const caOffset = useMemo(() => new THREE.Vector2(0.001, 0.001), []);

  const myPosition: [number, number, number] = duo ? [-2.5, 0, 0] : [0, 0, 0];
  const opponentPosition: [number, number, number] = [2.5, 0, 0];

  return (
    <>
      <color attach="background" args={[COLORS.bg_void]} />

      <CameraRig
        target={duo ? layout.duoCamera : layout.soloCamera}
        instant={!animate}
      />

      <ambientLight intensity={0.18} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.1}
        castShadow={quality === "full"}
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-3, 2, 3]} intensity={0.8} color={COLORS.gold} />
      <pointLight position={[3, 2, 3]} intensity={0.7} color={COLORS.cyan_cool} />

      <ArenaEnvironment arenaId={arenaId} />

      <CharacterMesh
        characterId={myCharacterId}
        form={1}
        position={myPosition}
        facing="right"
        hp={100}
        maxHp={100}
        isPlayer
        side="player1"
      />
      <ReadyRing
        position={myPosition}
        active={Boolean(myReady)}
        color={COLORS.gold_glow}
      />

      {duo &&
        (opponentCharacterId ? (
          <>
            <CharacterMesh
              characterId={opponentCharacterId}
              form={1}
              position={opponentPosition}
              facing="left"
              hp={100}
              maxHp={100}
              isPlayer={false}
              side="player2"
            />
            <ReadyRing
              position={opponentPosition}
              active={Boolean(opponentReady)}
              color={COLORS.gold_glow}
            />
          </>
        ) : (
          <EmptySlot position={opponentPosition} />
        ))}

      {mode === "search" && (
        <SearchPortal
          searchWindow={searchWindow ?? 0}
          expandTick={expandTick ?? 0}
          animate={animate}
          offsetX={layout.portalOffsetX}
        />
      )}

      <ParticleSystem />

      {quality === "full" && (
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.4} luminanceSmoothing={0.9} />
          <ChromaticAberration offset={caOffset} />
          <Vignette eskil={false} offset={0.4} darkness={0.7} />
        </EffectComposer>
      )}
    </>
  );
}

function CanvasLobby(props: LobbySceneProps) {
  const gpu = useDetectGPU();
  const reducedMotion = useReducedMotion();
  const [hidden, setHidden] = useState(false);
  const [idle, setIdle] = useState(false);
  const layout = LOBBY_VARIANTS[props.variant ?? "a"] ?? DEFAULT_VARIANT;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const arm = () => {
      if (timer) clearTimeout(timer);
      setIdle(false);
      timer = setTimeout(() => setIdle(true), IDLE_PAUSE_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
    ];
    for (const event of events) window.addEventListener(event, arm, { passive: true });
    arm();

    return () => {
      if (timer) clearTimeout(timer);
      for (const event of events) window.removeEventListener(event, arm);
    };
  }, []);

  const animate = !hidden && !idle && !reducedMotion;
  // Вкладка в фоне — «never»: даже invalidate не тратит кадры. Бездействие —
  // «demand»: смена персонажа всё ещё сможет запросить один кадр.
  const frameloop = hidden ? "never" : animate ? "always" : "demand";
  const quality = qualityForTier(gpu.tier);

  useEffect(() => {
    invalidate();
  }, [
    frameloop,
    props.mode,
    props.myCharacterId,
    props.opponentCharacterId,
    props.myReady,
    props.opponentReady,
  ]);

  if (quality === "none") {
    return (
      <StaticLobbyBackdrop
        myCharacterId={props.myCharacterId}
        opponentCharacterId={props.opponentCharacterId}
        hint="Упрощённый режим: 3D отключено для этого устройства"
      />
    );
  }

  return (
    <Canvas
      shadows={quality === "full"}
      dpr={[1, 2]}
      frameloop={frameloop}
      camera={{ position: layout.soloCamera, fov: layout.fov }}
      gl={{ antialias: quality === "full", alpha: false, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={<LoadingStage />}>
        <LobbyWorld {...props} quality={quality} animate={animate} layout={layout} />
      </Suspense>
    </Canvas>
  );
}

export function LobbyScene(props: LobbySceneProps) {
  useEffect(() => {
    // Эффекты меша живут в глобальном сторе: без сброса лобби может унаследовать
    // анимацию смерти из только что закончившегося матча.
    const store = useGameEffectStore.getState();
    store.setPendingEffect("player1", null);
    store.setPendingEffect("player2", null);
  }, []);

  return (
    <Suspense
      fallback={
        <StaticLobbyBackdrop
          myCharacterId={props.myCharacterId}
          opponentCharacterId={props.opponentCharacterId}
          hint="Готовим арену…"
        />
      }
    >
      <CanvasLobby {...props} />
    </Suspense>
  );
}
