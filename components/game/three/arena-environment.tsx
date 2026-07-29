"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getArenaThemeColors } from "@/lib/game/art";
import { isHitStopActive } from "@/lib/three/effect-store";

export interface ArenaEnvironmentProps {
  arenaId: string;
}

type ParticlePreset = "confetti" | "snow" | "embers" | "sparks" | "radiation";

function particlePresetForArena(arenaId: string): ParticlePreset {
  if (arenaId.includes("russia")) return "snow";
  if (arenaId.includes("china")) return "embers";
  if (arenaId.includes("ukraine")) return "sparks";
  if (arenaId.includes("mirror")) return "radiation";
  return "confetti";
}

function AnimatedPointLight({
  position,
  color,
  baseIntensity,
  frequency,
}: {
  position: [number, number, number];
  color: string;
  baseIntensity: number;
  frequency: number;
}) {
  const ref = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (!ref.current) return;
    if (isHitStopActive()) return;
    const t = state.clock.elapsedTime;
    const flicker =
      0.85 +
      Math.sin(t * frequency * 6) * 0.1 +
      Math.sin(t * frequency * 13.7) * 0.05;
    ref.current.intensity = baseIntensity * flicker;
  });

  return (
    <pointLight
      ref={ref}
      position={position}
      color={color}
      intensity={baseIntensity}
      distance={18}
      decay={2}
    />
  );
}

function AmbientParticles({
  color,
  preset,
  count = 80,
}: {
  color: string;
  preset: ParticlePreset;
  count?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array | null>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = Math.random() * 8 - 1;
      pos[i * 3 + 2] = -2 - Math.random() * 10;

      if (preset === "snow") {
        vel[i * 3] = (Math.random() - 0.5) * 0.01;
        vel[i * 3 + 1] = -0.008 - Math.random() * 0.012;
        vel[i * 3 + 2] = 0;
      } else if (preset === "embers" || preset === "sparks") {
        vel[i * 3] = (Math.random() - 0.5) * 0.02;
        vel[i * 3 + 1] = 0.01 + Math.random() * 0.02;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      } else if (preset === "radiation") {
        vel[i * 3] = (Math.random() - 0.5) * 0.03;
        vel[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      } else {
        // confetti
        vel[i * 3] = (Math.random() - 0.5) * 0.025;
        vel[i * 3 + 1] = -0.005 - Math.random() * 0.015;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
      }
    }
    velocities.current = vel;
    return pos;
  }, [count, preset]);

  useFrame(() => {
    if (!pointsRef.current || !velocities.current) return;
    if (isHitStopActive()) return;
    const attr = pointsRef.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const vel = velocities.current;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3] += vel[i3];
      arr[i3 + 1] += vel[i3 + 1];
      arr[i3 + 2] += vel[i3 + 2];

      if (arr[i3 + 1] < -2 || arr[i3 + 1] > 8) {
        arr[i3] = (Math.random() - 0.5) * 14;
        arr[i3 + 1] = preset === "snow" || preset === "confetti" ? 7 : -1.5;
        arr[i3 + 2] = -2 - Math.random() * 10;
      }
      if (Math.abs(arr[i3]) > 8) arr[i3] *= -0.95;
    }
    attr.needsUpdate = true;
  });

  const size =
    preset === "snow" ? 0.045 : preset === "sparks" ? 0.035 : 0.04;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function ParallaxPlane({
  position,
  size,
  color,
  opacity,
  speed,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  opacity: number;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    if (isHitStopActive()) return;
    ref.current.position.x =
      position[0] + Math.sin(state.clock.elapsedTime * speed) * 0.35;
  });

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

function lightConfig(arenaId: string, theme: ReturnType<typeof getArenaThemeColors>) {
  if (arenaId.includes("russia")) {
    return [
      {
        position: [0, 5, 2] as [number, number, number],
        color: theme.accent,
        baseIntensity: 2,
        frequency: 0.3,
      },
      {
        position: [-3, 2.5, 1] as [number, number, number],
        color: theme.fog,
        baseIntensity: 0.8,
        frequency: 0.5,
      },
    ];
  }
  if (arenaId.includes("china")) {
    return [
      {
        position: [-3.5, 3, 1] as [number, number, number],
        color: theme.accent,
        baseIntensity: 1.4,
        frequency: 0.4,
      },
      {
        position: [3.5, 3, 1] as [number, number, number],
        color: "#de2910",
        baseIntensity: 1.2,
        frequency: 0.55,
      },
    ];
  }
  if (arenaId.includes("ukraine")) {
    return [
      {
        position: [-3, 3, 2] as [number, number, number],
        color: theme.fog,
        baseIntensity: 1.6,
        frequency: 1.2,
      },
      {
        position: [3, 3, 2] as [number, number, number],
        color: theme.accent,
        baseIntensity: 1.6,
        frequency: 1.4,
      },
    ];
  }
  if (arenaId.includes("mirror")) {
    return [
      {
        position: [0, 4, 1] as [number, number, number],
        color: theme.accent,
        baseIntensity: 1.8,
        frequency: 2.2,
      },
      {
        position: [-4, 2, 2] as [number, number, number],
        color: "#225522",
        baseIntensity: 0.9,
        frequency: 1.8,
      },
    ];
  }
  // usa default
  return [
    {
      position: [-4, 3, 1] as [number, number, number],
      color: theme.fog,
      baseIntensity: 1.5,
      frequency: 0.5,
    },
    {
      position: [4, 3, 1] as [number, number, number],
      color: theme.accent,
      baseIntensity: 1.5,
      frequency: 0.7,
    },
  ];
}

export function ArenaEnvironment({ arenaId }: ArenaEnvironmentProps) {
  const theme = getArenaThemeColors(arenaId);
  const preset = particlePresetForArena(arenaId);
  const lights = lightConfig(arenaId, theme);

  const { layer1, layer2 } = useMemo(() => {
    const l1 = new THREE.Color(theme.fog).offsetHSL(0, -0.1, -0.15).getStyle();
    const l2 = new THREE.Color(theme.accent)
      .offsetHSL(0, -0.15, -0.25)
      .getStyle();
    return { layer1: l1, layer2: l2 };
  }, [theme.fog, theme.accent]);

  return (
    <group>
      <fog attach="fog" args={[theme.fog, 10, 42]} />

      {/* Procedural sky */}
      <mesh position={[0, 2, -22]}>
        <planeGeometry args={[60, 32]} />
        <meshBasicMaterial color={theme.sky} />
      </mesh>

      {/* Parallax mid-grounds */}
      <ParallaxPlane
        position={[0, 0.2, -12]}
        size={[26, 14]}
        color={layer1}
        opacity={0.55}
        speed={0.12}
      />
      <ParallaxPlane
        position={[0, -0.4, -6]}
        size={[18, 10]}
        color={layer2}
        opacity={0.4}
        speed={0.22}
      />

      {/* Floor */}
      <mesh
        position={[0, -2.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial
          color={theme.floor}
          roughness={0.85}
          metalness={0.08}
        />
      </mesh>

      {/* Soft floor glow strip */}
      <mesh position={[0, -2.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 3]} />
        <meshBasicMaterial
          color={theme.accent}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      {lights.map((light, i) => (
        <AnimatedPointLight key={i} {...light} />
      ))}

      <AmbientParticles color={theme.particle} preset={preset} />
    </group>
  );
}
