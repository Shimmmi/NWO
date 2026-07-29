"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FlashFreezeLayer } from "./FlashFreezeLayer";
import { ImpactLinesLayer } from "./ImpactLinesLayer";
import { TextSlamLayer } from "./TextSlamLayer";
import { ParticleBurstLayer } from "./ParticleBurstLayer";
import { SilhouetteLayer } from "./SilhouetteLayer";
import { UniqueEffectLayer } from "./UniqueEffectLayer";

function AbilityAnimationLayers() {
  return (
    <div
      id="ability-animation-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        pointerEvents: "none",
      }}
    >
      <FlashFreezeLayer />
      <ImpactLinesLayer />
      <SilhouetteLayer />
      <TextSlamLayer />
      <ParticleBurstLayer />
      <UniqueEffectLayer />
    </div>
  );
}

/** Mounts cinematic layers in a body portal so board overflow/transform cannot clip them. */
export function AbilityAnimationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {children}
      {mounted ? createPortal(<AbilityAnimationLayers />, document.body) : null}
    </>
  );
}
