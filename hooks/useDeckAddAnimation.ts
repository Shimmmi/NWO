"use client";

import { useCallback } from "react";
import gsap from "gsap";
import { DECK_RARITY_CONFIG } from "@/components/deck-builder/constants";
import { COLORS } from "@/lib/design/tokens";
import type { AbilityCard } from "@/lib/game/types";

export function useDeckAddAnimation() {
  const playAddAnimation = useCallback(
    (
      sourceElement: HTMLElement,
      targetElement: HTMLElement,
      card: AbilityCard,
    ) => {
      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const color = DECK_RARITY_CONFIG[card.rarity].color;

      const clone = document.createElement("div");
      clone.style.cssText = `
        position: fixed;
        left: ${sourceRect.left}px;
        top: ${sourceRect.top}px;
        width: ${sourceRect.width}px;
        height: ${sourceRect.height}px;
        background: ${COLORS.bg_card};
        border: 1.5px solid ${color};
        border-radius: 10px;
        pointer-events: none;
        z-index: 99999;
        box-shadow: 0 0 20px ${color}88;
      `;
      document.body.appendChild(clone);

      gsap
        .timeline({ onComplete: () => clone.remove() })
        .to(clone, {
          left: targetRect.left + targetRect.width * 0.2,
          top: targetRect.top + targetRect.height * 0.2,
          width: targetRect.width * 0.6,
          height: targetRect.height * 0.6,
          opacity: 0.8,
          duration: 0.3,
          ease: "power2.in",
        })
        .to(clone, {
          scale: 0,
          opacity: 0,
          duration: 0.15,
          ease: "power2.in",
        });

      gsap.fromTo(
        targetElement,
        { background: `${color}22` },
        { background: "transparent", duration: 0.5, ease: "power2.out" },
      );
    },
    [],
  );

  return { playAddAnimation };
}
