"use client";

import { Canvas } from "@react-three/fiber";
import { PackMesh } from "@/components/shop/opening/three/PackMesh";
import type { BoosterSku } from "@/lib/shop/catalog";
import type { OpeningPhase } from "@/lib/stores/openingStore";
import { COLORS } from "@/lib/design/tokens";

/** Pack-present only — card reveals are DOM OpeningCardFan. */
export function BoosterOpeningCanvas({
  sku,
  phase,
  quality,
}: {
  sku: BoosterSku;
  phase: OpeningPhase;
  quality: "lite" | "full";
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 4.2], fov: 42 }}
      dpr={quality === "full" ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: quality === "full", alpha: false }}
      style={{ width: "100%", height: "100%", background: COLORS.bg_void }}
    >
      <color attach="background" args={[COLORS.bg_void]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 2]} intensity={1.4} color="#fff2cc" />
      <pointLight position={[-2, 1, 3]} intensity={0.6} color={COLORS.gold} />
      <PackMesh sku={sku} phase={phase} />
    </Canvas>
  );
}
