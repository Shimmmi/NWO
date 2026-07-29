"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { Vector2 } from "three";
import { ArenaEnvironment } from "@/components/game/three/arena-environment";
import { CharacterMesh } from "@/components/game/three/character-mesh";
import { DamageNumbers } from "@/components/game/three/damage-numbers";
import { ParticleSystem } from "@/components/game/three/particle-system";
import { getArenaIdForCharacter } from "@/lib/design/tokens";
import { COLORS } from "@/lib/design/tokens";

export interface BattleFighterView {
  characterId: string;
  form: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  /** Match-side id for effect store targeting */
  side: "player1" | "player2";
}

export interface BattleSceneProps {
  /** Visual left fighter (usually the local player) */
  left: BattleFighterView;
  /** Visual right fighter (usually the opponent) */
  right: BattleFighterView;
  arenaId?: string;
  /** @deprecated use left/right */
  player1?: BattleFighterView;
  /** @deprecated use left/right */
  player2?: BattleFighterView;
}

function BattleWorld({ left, right, arenaId, player1, player2 }: BattleSceneProps) {
  const leftFighter = left ?? player1!;
  const rightFighter = right ?? player2!;
  const resolvedArenaId =
    arenaId ?? getArenaIdForCharacter(leftFighter.characterId);

  const caOffset = useMemo(() => new Vector2(0.001, 0.001), []);

  return (
    <>
      <color attach="background" args={[COLORS.bg_void]} />

      <ambientLight intensity={0.15} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight
        position={[-3, 2, 3]}
        intensity={0.8}
        color={COLORS.gold}
      />
      <pointLight
        position={[3, 2, 3]}
        intensity={0.8}
        color="#CC2200"
      />

      <ArenaEnvironment arenaId={resolvedArenaId} />

      <CharacterMesh
        characterId={leftFighter.characterId}
        form={leftFighter.form}
        position={[-2.5, 0, 0]}
        facing="right"
        hp={leftFighter.hp}
        maxHp={leftFighter.maxHp}
        isPlayer
        side={leftFighter.side}
      />

      <CharacterMesh
        characterId={rightFighter.characterId}
        form={rightFighter.form}
        position={[2.5, 0, 0]}
        facing="left"
        hp={rightFighter.hp}
        maxHp={rightFighter.maxHp}
        isPlayer={false}
        side={rightFighter.side}
      />

      <ParticleSystem />
      <DamageNumbers />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
        />
        <ChromaticAberration offset={caOffset} />
        <Vignette eskil={false} offset={0.4} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

export function BattleScene(props: BattleSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.5, 8], fov: 55 }}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
      gl={{ antialias: true, alpha: false }}
    >
      <Suspense fallback={null}>
        <BattleWorld {...props} />
      </Suspense>
    </Canvas>
  );
}
