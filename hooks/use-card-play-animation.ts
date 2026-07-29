"use client";

import gsap from "gsap";

/** TZ v4 local ack: 80–120ms lift/flight before/alongside network. */
export function useCardPlayAnimation() {
  const playAnimation = (
    cardElement: HTMLElement,
    targetPosition?: { x: number; y: number },
  ) => {
    const rect = cardElement.getBoundingClientRect();
    const clone = cardElement.cloneNode(true) as HTMLElement;

    clone.style.position = "fixed";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.zIndex = "10050";
    clone.style.pointerEvents = "none";
    clone.style.margin = "0";
    document.body.appendChild(clone);

    const targetX = targetPosition?.x ?? window.innerWidth / 2;
    const targetY = targetPosition?.y ?? window.innerHeight * 0.42;

    gsap
      .timeline({
        onComplete: () => clone.remove(),
      })
      .to(clone, {
        left: targetX - rect.width / 2,
        top: targetY - rect.height / 2,
        scale: 1.15,
        duration: 0.09,
        ease: "power2.out",
      })
      .to(clone, {
        scale: 0.35,
        opacity: 0,
        duration: 0.06,
        ease: "power2.in",
      });
  };

  const snapBack = (cardElement: HTMLElement) => {
    gsap.fromTo(
      cardElement,
      { x: 12, opacity: 0.6 },
      { x: 0, opacity: 1, duration: 0.2, ease: "elastic.out(1, 0.5)" },
    );
  };

  return { playAnimation, snapBack };
}
