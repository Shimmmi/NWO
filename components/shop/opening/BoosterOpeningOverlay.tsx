"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useDetectGPU } from "@react-three/drei";
import { OpeningOrchestrator } from "@/components/shop/opening/OpeningOrchestrator";
import { BoosterOpeningCanvas } from "@/components/shop/opening/BoosterOpeningCanvas";
import { OpeningFallback2D } from "@/components/shop/opening/OpeningFallback2D";
import { OpeningCardFan } from "@/components/shop/opening/OpeningCardFan";
import { OpeningSummary } from "@/components/shop/opening/OpeningSummary";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import type { BoosterSku } from "@/lib/shop/catalog";
import type { PackOpenResult } from "@/lib/shop/packRoll";
import { useOpeningStore, type OpeningPhase } from "@/lib/stores/openingStore";

const PACK_PHASES: OpeningPhase[] = [
  "purchase_handoff",
  "pack_present",
  "tear_rip",
];

export function BoosterOpeningOverlay({
  sku,
  result,
  onComplete,
}: {
  sku: BoosterSku;
  result: PackOpenResult;
  onComplete: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const gpu = useDetectGPU();
  const tier = gpu?.tier ?? 1;
  const use3dPack = tier > 0 && !reducedMotion;

  const phase = useOpeningStore((s) => s.phase);
  const revealIndex = useOpeningStore((s) => s.revealIndex);
  const setPhase = useOpeningStore((s) => s.setPhase);
  const setRevealIndex = useOpeningStore((s) => s.setRevealIndex);
  const reset = useOpeningStore((s) => s.reset);
  const holdRef = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  const orch = useMemo(() => new OpeningOrchestrator(), []);
  const showPack = PACK_PHASES.includes(phase);
  const showFan = !showPack && phase !== "idle";

  useEffect(() => {
    reset();
    orch.play({
      sku,
      result,
      reducedMotion: Boolean(reducedMotion),
      onPhase: (p, idx) => {
        setPhase(p);
        setRevealIndex(idx);
      },
      onComplete,
    });
    return () => orch.dispose();
  }, [orch, sku, result, reducedMotion, setPhase, setRevealIndex, reset, onComplete]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "summary") {
          orch.complete();
          return;
        }
        setHolding(true);
        holdRef.current = window.setTimeout(() => {
          orch.skipToSummary();
          setHolding(false);
        }, 450);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        if (holdRef.current) clearTimeout(holdRef.current);
        setHolding(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [orch, phase]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: COLORS.bg_void,
        display: "flex",
        flexDirection: "column",
      }}
      onClick={() => {
        if (phase === "summary") return;
        orch.skipOne();
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        {showPack &&
          (use3dPack ? (
            <BoosterOpeningCanvas
              sku={sku}
              phase={phase}
              quality={tier <= 1 ? "lite" : "full"}
            />
          ) : (
            <OpeningFallback2D sku={sku} phase={phase} />
          ))}

        {showFan && (
          <OpeningCardFan
            result={result}
            phase={phase}
            revealIndex={revealIndex}
          />
        )}

        {phase === "legendary_interrupt" && (
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle, ${COLORS.legendary}55, transparent 60%)`,
              animation: "wo-flash 0.4s ease-out",
            }}
          />
        )}
      </div>

      {phase === "summary" && (
        <OpeningSummary onContinue={() => orch.complete()} />
      )}

      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 0,
          right: 0,
          textAlign: "center",
          font: `500 12px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_secondary,
          pointerEvents: "none",
        }}
      >
        {phase === "summary"
          ? "Space / кнопка — продолжить"
          : holding
            ? "Пропуск…"
            : "Клик — следующая карта · удерживайте Space — пропустить"}
      </div>
    </div>
  );
}
