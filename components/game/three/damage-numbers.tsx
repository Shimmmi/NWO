"use client";

import { useEffect, useRef } from "react";
import { Text } from "@react-three/drei";
import gsap from "gsap";
import type { Mesh, MeshBasicMaterial } from "three";
import {
  useGameEffectStore,
  type DamageNumberEvent,
} from "@/lib/three/effect-store";
import { COLORS } from "@/lib/design/tokens";

const TYPE_CONFIG: Record<
  DamageNumberEvent["type"],
  { color: string; prefix: string; size: number }
> = {
  damage: { color: COLORS.text_damage, prefix: "-", size: 0.45 },
  heal: { color: COLORS.text_heal, prefix: "+", size: 0.38 },
  energy: { color: COLORS.text_energy, prefix: "+", size: 0.32 },
  block: { color: "#88CCFF", prefix: "", size: 0.36 },
  crit: { color: COLORS.legendary, prefix: "!!", size: 0.58 },
};

function DamageNumberMesh({ value, type, position }: DamageNumberEvent) {
  const ref = useRef<Mesh>(null);
  const config = TYPE_CONFIG[type];
  const label =
    type === "crit"
      ? `!!${value}`
      : type === "block"
        ? `${value}`
        : `${config.prefix}${value}`;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const startX = position[0];
    const startY = position[1];
    const drift = (Math.random() - 0.5) * 0.5;

    mesh.position.set(startX, startY, position[2]);
    const mat = mesh.material as MeshBasicMaterial;
    if (mat) mat.opacity = 1;

    const tl = gsap.timeline();
    tl.to(mesh.position, {
      y: startY + 1.5,
      x: startX + drift,
      duration: 1.0,
      ease: "power2.out",
    }).to(
      mat,
      {
        opacity: 0,
        duration: 0.4,
        ease: "power1.in",
      },
      0.6,
    );

    return () => {
      tl.kill();
    };
  }, [position, value]);

  return (
    <Text
      ref={ref}
      position={position}
      fontSize={config.size}
      color={config.color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="#000000"
      material-transparent
      material-depthWrite={false}
    >
      {label}
    </Text>
  );
}

export function DamageNumbers() {
  const numbers = useGameEffectStore((s) => s.damageNumbers);

  return (
    <group>
      {numbers.map((n) => (
        <DamageNumberMesh key={n.id} {...n} />
      ))}
    </group>
  );
}
