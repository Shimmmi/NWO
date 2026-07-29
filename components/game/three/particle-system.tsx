"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getPresentationDelta,
  useGameEffectStore,
  type ParticleBurst as ParticleBurstData,
} from "@/lib/three/effect-store";

function burstSpeed(type: ParticleBurstData["type"]): number {
  switch (type) {
    case "hit":
    case "crit":
      return 0.15;
    case "death":
      return 0.08;
    case "transform":
      return 0.1;
    case "heal":
    case "energy":
      return 0.07;
    default:
      return 0.06;
  }
}

function ParticleBurstMesh({
  position,
  type,
  color,
  count,
}: ParticleBurstData) {
  const ref = useRef<THREE.Points>(null);
  const elapsed = useRef(0);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const speed = burstSpeed(type);
    const [px, py, pz] = position;

    for (let i = 0; i < count; i++) {
      pos[i * 3] = px;
      pos[i * 3 + 1] = py;
      pos[i * 3 + 2] = pz;

      vel[i * 3] = (Math.random() - 0.5) * speed;
      vel[i * 3 + 1] =
        type === "heal" || type === "energy"
          ? Math.random() * speed + 0.03
          : Math.random() * speed + 0.02;
      vel[i * 3 + 2] = (Math.random() - 0.5) * speed * 0.5;
    }

    return { positions: pos, velocities: vel };
  }, [count, position, type]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const d = getPresentationDelta(delta);
    if (d === 0) return;

    elapsed.current += d;
    const attr = ref.current.geometry.attributes.position;
    const arr = attr.array as Float32Array;
    const scale = d / Math.max(delta, 0.0001);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3] += velocities[i3] * scale;
      arr[i3 + 1] += velocities[i3 + 1] * scale;
      arr[i3 + 2] += velocities[i3 + 2] * scale;
      velocities[i3 + 1] -= 0.004 * scale;
    }

    attr.needsUpdate = true;
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - elapsed.current * 2);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={type === "hit" || type === "crit" ? 0.06 : 0.04}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export function ParticleSystem() {
  const bursts = useGameEffectStore((s) => s.particleBursts);

  return (
    <group>
      {bursts.map((burst) => (
        <ParticleBurstMesh key={burst.id} {...burst} />
      ))}
    </group>
  );
}
