"use client";

import {
  Component,
  Suspense,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import { getCharacterColor } from "@/lib/design/tokens";
import {
  isHitStopActive,
  useGameEffectStore,
} from "@/lib/three/effect-store";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { playCharacterPose } from "@/lib/animations/characterPoseAnimations";

export interface CharacterMeshProps {
  characterId: string;
  form: 1 | 2 | 3;
  position: [number, number, number];
  facing: "left" | "right";
  hp: number;
  maxHp: number;
  isPlayer: boolean;
  side: "player1" | "player2";
}

class TextureErrorBoundary extends Component<
  { fallback: ReactNode; resetKey: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function PortraitBody({
  url,
  materialRef,
  meshRef,
  facingSign,
}: {
  url: string;
  materialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  meshRef: React.RefObject<THREE.Mesh | null>;
  facingSign: number;
}) {
  const texture = useTexture(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
  });

  return (
    <mesh ref={meshRef} scale={[facingSign, 1, 1]}>
      <planeGeometry args={[2.4, 3.6]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        color="#ffffff"
        transparent
        alphaTest={0.05}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function FallbackBody({
  materialRef,
  meshRef,
  facingSign,
  accent,
}: {
  materialRef: React.RefObject<THREE.MeshBasicMaterial | null>;
  meshRef: React.RefObject<THREE.Mesh | null>;
  facingSign: number;
  accent: string;
}) {
  return (
    <mesh ref={meshRef} scale={[facingSign, 1, 1]}>
      <planeGeometry args={[2.4, 3.6]} />
      <meshBasicMaterial
        ref={materialRef}
        color={accent}
        transparent
        opacity={0.92}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function CharacterMesh({
  characterId,
  form,
  position,
  facing,
  hp,
  maxHp,
  side,
}: CharacterMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lastEffectId = useRef<string | null>(null);
  const lastPoseKey = useRef<string | null>(null);
  const poseActive = useRef(false);

  const pendingEffect = useGameEffectStore((s) => s.pendingEffects[side]);
  const characterPose = useAbilityAnimationStore((s) => s.characterPose);
  const countryColor = getCharacterColor(characterId);
  const portraitUrl = getCharacterPortraitUrl(characterId, form);
  const facingSign = facing === "left" ? -1 : 1;
  const hpRatio = maxHp > 0 ? hp / maxHp : 1;
  const overlayOpacity = hpRatio < 0.3 ? (0.3 - hpRatio) * 2 : 0;
  const matchPlayerNum: 1 | 2 = side === "player1" ? 1 : 2;

  const fallback = (
    <FallbackBody
      materialRef={materialRef}
      meshRef={meshRef}
      facingSign={facingSign}
      accent={countryColor}
    />
  );

  useEffect(() => {
    if (!characterPose) {
      lastPoseKey.current = null;
      return;
    }
    if (!meshRef.current) return;
    if (characterPose.playerNum !== matchPlayerNum) return;

    // Fire once per store trigger (cleared when pose becomes null)
    if (lastPoseKey.current === "active") return;
    lastPoseKey.current = "active";

    poseActive.current = true;
    const tl = playCharacterPose(
      meshRef.current,
      characterPose.type,
      facingSign,
    );
    tl.eventCallback("onComplete", () => {
      poseActive.current = false;
    });

    return () => {
      tl.kill();
      poseActive.current = false;
    };
  }, [characterPose, matchPlayerNum, facingSign]);

  useEffect(() => {
    if (!pendingEffect || !meshRef.current || !materialRef.current) return;
    if (lastEffectId.current === pendingEffect.id) return;
    lastEffectId.current = pendingEffect.id;

    const mesh = meshRef.current;
    const mat = materialRef.current;
    const dir = facing === "right" ? -1 : 1;

    if (pendingEffect.type === "damage") {
      gsap
        .timeline()
        .to(mat.color, { r: 1, g: 1, b: 1, duration: 0.05 })
        .to(mat.color, { r: 1, g: 0.12, b: 0.12, duration: 0.1 })
        .to(mat.color, { r: 1, g: 1, b: 1, duration: 0.2 });

      gsap
        .timeline()
        .to(mesh.position, { x: dir * 0.3, duration: 0.08 })
        .to(mesh.position, {
          x: 0,
          duration: 0.3,
          ease: "elastic.out(1, 0.5)",
        });
    } else if (pendingEffect.type === "heal") {
      gsap
        .timeline()
        .to(mat.color, { r: 0.3, g: 1, b: 0.5, duration: 0.1 })
        .to(mat.color, { r: 1, g: 1, b: 1, duration: 0.25 });
    } else if (pendingEffect.type === "block") {
      gsap
        .timeline()
        .to(mat.color, { r: 0.5, g: 0.8, b: 1, duration: 0.08 })
        .to(mat.color, { r: 1, g: 1, b: 1, duration: 0.2 });
    } else if (pendingEffect.type === "death") {
      gsap.to(mesh.position, {
        y: -3,
        duration: 0.55,
        ease: "power2.in",
      });
      gsap.to(mat, { opacity: 0, duration: 0.45, delay: 0.15 });
    } else if (pendingEffect.type === "transform") {
      gsap
        .timeline()
        .to(mesh.scale, {
          x: facingSign * 1.3,
          y: 1.3,
          z: 1.3,
          duration: 0.15,
        })
        .to(mesh.scale, {
          x: facingSign,
          y: 1,
          z: 1,
          duration: 0.4,
          ease: "elastic.out(1, 0.4)",
        });
    }
  }, [pendingEffect, facing, facingSign]);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (pendingEffect?.type === "death") return;
    if (poseActive.current) return;
    if (isHitStopActive()) return;

    const t = state.clock.elapsedTime;
    const bob = Math.sin(t * 0.8 + (side === "player1" ? 0 : 1.2)) * 0.04;
    meshRef.current.position.y = bob;

    const breath = 1 + Math.sin(t * 1.2) * 0.005;
    const sx = Math.abs(meshRef.current.scale.x) || 1;
    if (Math.abs(sx - 1) < 0.05) {
      meshRef.current.scale.set(facingSign * breath, breath, 1);
    }
  });

  return (
    <group position={position}>
      <mesh
        position={[0, -1.75, -0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, 0.45, 1]}
      >
        <circleGeometry args={[0.85, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.4} />
      </mesh>

      <mesh position={[0, -1.74, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.88, 64]} />
        <meshBasicMaterial
          color={countryColor}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Suspense fallback={fallback}>
        <TextureErrorBoundary fallback={fallback} resetKey={portraitUrl}>
          <PortraitBody
            url={portraitUrl}
            materialRef={materialRef}
            meshRef={meshRef}
            facingSign={facingSign}
          />
        </TextureErrorBoundary>
      </Suspense>

      {overlayOpacity > 0 && (
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[2.4, 3.6]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={overlayOpacity}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
