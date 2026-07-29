"use client";

import { useEffect, useRef } from "react";
import { useAbilityAnimationStore } from "@/lib/animations/store";
import {
  PARTICLE_GRAVITY,
  seedParticlePattern,
  type ParticleSeed,
} from "@/lib/animations/particlePatterns";

export function ParticleBurstLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = useAbilityAnimationStore((s) => s.particleBurstConfig);
  const localPlayerNum = useAbilityAnimationStore((s) => s.localPlayerNum);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!config || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const targetIsLeft = config.targetPlayer === localPlayerNum;
    const originX = canvas.width * (targetIsLeft ? 0.28 : 0.72);
    const originY = canvas.height * 0.42;

    const particles: ParticleSeed[] = seedParticlePattern({
      count: config.count,
      originX,
      originY,
      color: config.color,
      secondary: config.secondary,
      pattern: config.pattern,
      legendary: config.count >= 180,
    });

    const ages = new Float32Array(particles.length);
    const start = performance.now();
    let last = start;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = (now - start) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        ages[i] += dt;
        const p = particles[i];
        if (ages[i] >= p.life) continue;
        alive += 1;

        p.vx *= 0.99;
        p.vy += PARTICLE_GRAVITY * 60;
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;

        const fade = 1 - ages[i] / p.life;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (alive > 0 && elapsed < 1.6) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        useAbilityAnimationStore.setState({ particleBurstConfig: null });
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
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
        zIndex: 9250,
      }}
    />
  );
}
