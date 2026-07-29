"use client";

import { Suspense } from "react";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import { UNIQUE_EFFECTS } from "@/lib/animations/uniqueEffects/registry";

export function UniqueEffectLayer() {
  const uniqueEffect = useAbilityAnimationStore((s) => s.uniqueEffect);

  if (!uniqueEffect) return null;

  const EffectComponent = UNIQUE_EFFECTS[uniqueEffect.type];
  if (!EffectComponent) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9500,
      }}
    >
      <Suspense fallback={null}>
        <EffectComponent
          {...(uniqueEffect.params as {
            color?: string;
            secondary?: string;
            targetPlayer?: 1 | 2;
          })}
        />
      </Suspense>
    </div>
  );
}
