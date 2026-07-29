"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { useGameEffectStore } from "@/lib/three/effect-store";

export function useScreenShake(containerRef: RefObject<HTMLElement | null>) {
  const shakeEvent = useGameEffectStore((s) => s.currentShake);

  useEffect(() => {
    if (!shakeEvent || !containerRef.current) return;

    const intensity =
      shakeEvent.type === "crit" ? 12 : shakeEvent.type === "damage" ? 6 : 3;
    const duration = shakeEvent.type === "crit" ? 0.6 : 0.3;
    const el = containerRef.current;

    gsap
      .timeline()
      .to(el, {
        x: `+=${intensity}`,
        y: `-=${intensity / 2}`,
        duration: duration * 0.15,
        ease: "none",
      })
      .to(el, {
        x: `-=${intensity * 1.5}`,
        y: `+=${intensity}`,
        duration: duration * 0.15,
        ease: "none",
      })
      .to(el, {
        x: `+=${intensity}`,
        y: `-=${intensity * 0.7}`,
        duration: duration * 0.15,
        ease: "none",
      })
      .to(el, {
        x: 0,
        y: 0,
        duration: duration * 0.55,
        ease: "elastic.out(1, 0.5)",
      });
  }, [shakeEvent, containerRef]);
}
