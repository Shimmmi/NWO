"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useAbilityAnimationStore } from "@/lib/animations/store";

export function ImpactLinesLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useAbilityAnimationStore((s) => s.impactLinesConfig);
  const localPlayerNum = useAbilityAnimationStore((s) => s.localPlayerNum);
  const animRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Map match player → visual side (left = local player)
    const originIsLeft = config.originPlayer === localPlayerNum;
    const originX = canvas.width * (originIsLeft ? 0.28 : 0.72);
    const originY = canvas.height * 0.4;

    const angleStep = (Math.PI * 2) / config.count;
    const progress = { value: 0 };

    animRef.current = gsap.to(progress, {
      value: 1,
      duration: config.duration / 1000,
      ease: "power2.out",
      onUpdate: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const p = progress.value;

        const opacity = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        ctx.globalAlpha = Math.max(0, opacity);

        for (let i = 0; i < config.count; i++) {
          const angle = angleStep * i + (Math.PI / config.count) * 0.5;
          const isThick = i % 3 === 0;

          const minRadius = 60;
          const maxRadius = canvas.width * 0.6;
          const currentRadius = minRadius + (maxRadius - minRadius) * p;

          const lineWeight =
            config.style === "legendary"
              ? isThick
                ? config.weight * 2.5
                : config.weight * 1.2
              : isThick
                ? config.weight * 1.5
                : config.weight;

          const x0 = originX + Math.cos(angle) * minRadius;
          const y0 = originY + Math.sin(angle) * minRadius;
          const x1 = originX + Math.cos(angle) * currentRadius;
          const y1 = originY + Math.sin(angle) * currentRadius;

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);

          const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
          gradient.addColorStop(0, `${config.color}FF`);
          gradient.addColorStop(0.6, `${config.color}CC`);
          gradient.addColorStop(1, `${config.color}00`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = lineWeight;
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      },
      onComplete: () => ctx.clearRect(0, 0, canvas.width, canvas.height),
    });

    return () => {
      animRef.current?.kill();
    };
  }, [config, localPlayerNum]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9200,
        mixBlendMode: "screen",
      }}
    />
  );
}
