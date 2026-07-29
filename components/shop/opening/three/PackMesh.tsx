"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BoosterSku } from "@/lib/shop/catalog";
import type { OpeningPhase } from "@/lib/stores/openingStore";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";

const ART_TINT: Record<string, string> = {
  "pack-usa": COLORS.usa_blue,
  "pack-russia": COLORS.russia_red,
  "pack-china": COLORS.china_red,
  "pack-ukraine": COLORS.ukraine_blue,
  "pack-mix": COLORS.gold,
  "pack-summit": COLORS.legendary,
};

export function PackMesh({
  sku,
  phase,
}: {
  sku: BoosterSku;
  phase: OpeningPhase;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const tint =
    sku.pool.type === "character"
      ? getCharacterColor(sku.pool.characterId)
      : (ART_TINT[sku.artKey] ?? COLORS.gold);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    m.position.y = Math.sin(t * 1.4) * 0.06;
    m.rotation.y = Math.sin(t * 0.7) * 0.18;
    m.rotation.z = Math.sin(t * 0.9) * 0.03;
    if (phase === "tear_rip") {
      m.scale.setScalar(1 + Math.sin(t * 20) * 0.02);
      m.rotation.x = (t % 1) * 0.4;
    }
  });

  return (
    <mesh ref={ref} position={[0, 0, 0]} castShadow>
      <boxGeometry args={[1.4, 2.0, 0.18]} />
      <meshStandardMaterial
        color={tint}
        metalness={0.65}
        roughness={0.28}
        emissive={COLORS.gold}
        emissiveIntensity={phase === "tear_rip" ? 0.45 : 0.15}
      />
    </mesh>
  );
}
