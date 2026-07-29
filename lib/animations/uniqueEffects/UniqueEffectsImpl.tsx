"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { EffectShell, type EffectProps } from "./effectShell";

export function MushroomCloudEffect({ color = "#FF6600" }: EffectProps) {
  const stemRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stemRef.current || !capRef.current) return;
    const tl = gsap.timeline();
    gsap.set(stemRef.current, { scaleY: 0, transformOrigin: "50% 100%" });
    gsap.set(capRef.current, { scale: 0, opacity: 0 });
    tl.to(stemRef.current, { scaleY: 1, duration: 0.55, ease: "power2.out" })
      .to(
        capRef.current,
        { scale: 1.4, opacity: 0.85, duration: 0.45, ease: "power2.out" },
        0.35,
      )
      .to(
        [stemRef.current, capRef.current],
        { opacity: 0, duration: 0.35 },
        0.95,
      );
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <EffectShell>
      <div style={{ position: "relative", width: 180, height: 260 }}>
        <div
          ref={stemRef}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 20,
            width: 48,
            height: 140,
            marginLeft: -24,
            borderRadius: 24,
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            boxShadow: `0 0 40px ${color}`,
          }}
        />
        <div
          ref={capRef}
          style={{
            position: "absolute",
            left: "50%",
            top: 10,
            width: 180,
            height: 90,
            marginLeft: -90,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, #fff8 0%, ${color} 40%, ${color}00 70%)`,
            boxShadow: `0 0 60px ${color}`,
          }}
        />
      </div>
    </EffectShell>
  );
}

export function PhoenixRiseEffect({
  color = "#FF4500",
  secondary = "#FFD700",
}: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ y: 120, scale: 0.3, opacity: 0, rotate: -8 }}
        animate={{ y: -40, scale: 1.4, opacity: [0, 1, 1, 0], rotate: 0 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: 220,
          height: 280,
          background: `radial-gradient(ellipse at 50% 70%,
            ${secondary}ee 0%,
            ${color}cc 35%,
            transparent 70%)`,
          filter: "blur(1px)",
        }}
      />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0.4, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 0.9, delay: 0.1 * i }}
          style={{
            position: "absolute",
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `3px solid ${color}`,
            boxShadow: `0 0 30px ${secondary}`,
          }}
        />
      ))}
    </EffectShell>
  );
}

export function ScreenBlackoutEffect({ color = "#1DA1F2" }: EffectProps) {
  return (
    <EffectShell
      style={{
        background: "#000",
      }}
    >
      <motion.div
        initial={{ scale: 2.5, opacity: 0 }}
        animate={{ scale: 1, opacity: [0, 1, 0] }}
        transition={{ duration: 0.7 }}
        style={{
          font: "900 96px var(--font-display), serif",
          color,
          letterSpacing: "0.2em",
          textShadow: `0 0 40px ${color}`,
        }}
      >
        MUTE
      </motion.div>
    </EffectShell>
  );
}

export function ClockFreezeEffect({ color = "#D4AF37" }: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -40 }}
        animate={{ scale: 1.2, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        style={{
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `6px solid ${color}`,
          boxShadow: `0 0 50px ${color}88, inset 0 0 30px ${color}44`,
          position: "relative",
        }}
      >
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 25 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 4,
            height: 70,
            marginLeft: -2,
            marginTop: -70,
            background: color,
            transformOrigin: "50% 100%",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 4,
            height: 50,
            marginLeft: -2,
            marginTop: -50,
            background: "#fff",
            transform: "rotate(110deg)",
            transformOrigin: "50% 100%",
            borderRadius: 2,
          }}
        />
      </motion.div>
    </EffectShell>
  );
}

export function BearRoarEffect({
  color = "#885500",
  secondary = "#CC0000",
}: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{
          scale: [0.8, 1.15, 1.05, 1.2, 1],
          opacity: [0, 1, 1, 1, 0],
          x: [0, -8, 6, -10, 0],
        }}
        transition={{ duration: 0.9 }}
        style={{
          width: "70vw",
          height: "40vh",
          background: `radial-gradient(ellipse at center,
            ${secondary}aa 0%,
            ${color}66 40%,
            transparent 70%)`,
          filter: "blur(2px)",
        }}
      />
    </EffectShell>
  );
}

export function DragonRiseEffect({
  color = "#FFD700",
  secondary = "#DE2910",
}: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ y: 200, scale: 0.2, opacity: 0 }}
        animate={{ y: -60, scale: 1.5, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.0, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: 260,
          height: 320,
          background: `conic-gradient(from 200deg,
            ${secondary},
            ${color},
            ${secondary},
            transparent)`,
          clipPath:
            "polygon(50% 0%, 70% 30%, 100% 40%, 75% 55%, 85% 100%, 50% 75%, 15% 100%, 25% 55%, 0% 40%, 30% 30%)",
          filter: `drop-shadow(0 0 30px ${color})`,
        }}
      />
    </EffectShell>
  );
}

export function DragonFireEffect({
  color = "#FF4400",
  secondary = "#FFDE00",
}: EffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 80 }, () => ({
      x: canvas.width * 0.3,
      y: canvas.height * 0.45,
      vx: 4 + Math.random() * 8,
      vy: (Math.random() - 0.5) * 4,
      life: 0.6 + Math.random() * 0.5,
      age: 0,
      size: 4 + Math.random() * 10,
    }));

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      let alive = 0;
      for (const p of particles) {
        p.age += dt;
        if (p.age >= p.life) continue;
        alive++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        const fade = 1 - p.age / p.life;
        const grad = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * fade,
        );
        grad.addColorStop(0, secondary);
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [color, secondary]);

  return (
    <EffectShell>
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </EffectShell>
  );
}

export function GreatWallEffect({
  color = "#DE2910",
  secondary = "#FFDE00",
}: EffectProps) {
  return (
    <EffectShell style={{ alignItems: "flex-end", paddingBottom: "18%" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{
              delay: i * 0.03,
              duration: 0.35,
              ease: [0.2, 0.9, 0.2, 1],
            }}
            style={{
              width: 28,
              height: 40 + (i % 3) * 28,
              transformOrigin: "50% 100%",
              background: `linear-gradient(180deg, ${secondary}, ${color})`,
              boxShadow: `0 0 12px ${color}88`,
              borderTop: `3px solid ${secondary}`,
            }}
          />
        ))}
      </div>
    </EffectShell>
  );
}

export function UkraineFlagEffect({
  color = "#005BBB",
  secondary = "#FFD500",
}: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.0 }}
        style={{
          width: "min(70vw, 480px)",
          height: "min(40vh, 260px)",
          transformOrigin: "center",
          boxShadow: `0 0 60px ${secondary}`,
          overflow: "hidden",
        }}
      >
        <div style={{ height: "50%", background: color }} />
        <div style={{ height: "50%", background: secondary }} />
      </motion.div>
    </EffectShell>
  );
}

export function IronShieldEffect({
  color = "#FFFFFF",
  secondary = "#005BBB",
}: EffectProps) {
  return (
    <EffectShell>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.6 + i * 0.3], opacity: [0.9, 0] }}
          transition={{ duration: 0.85, delay: i * 0.08 }}
          style={{
            position: "absolute",
            width: 180,
            height: 220,
            borderRadius: "40% 40% 45% 45%",
            border: `4px solid ${i % 2 === 0 ? color : secondary}`,
            boxShadow: `0 0 40px ${secondary}`,
          }}
        />
      ))}
    </EffectShell>
  );
}

export function TridentStrikeEffect({
  color = "#005BBB",
  secondary = "#FFD500",
}: EffectProps) {
  return (
    <EffectShell>
      <motion.div
        initial={{ y: -220, opacity: 0, scale: 1.4 }}
        animate={{ y: 0, opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 0.7, ease: [0.15, 0.9, 0.2, 1] }}
        style={{
          width: 120,
          height: 220,
          background: `linear-gradient(180deg, ${secondary}, ${color})`,
          clipPath:
            "polygon(50% 0%, 62% 28%, 95% 22%, 70% 40%, 78% 100%, 50% 78%, 22% 100%, 30% 40%, 5% 22%, 38% 28%)",
          filter: `drop-shadow(0 0 28px ${secondary})`,
        }}
      />
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 2.4, opacity: [0.8, 0] }}
        transition={{ duration: 0.55, delay: 0.25 }}
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: "50%",
          border: `3px solid ${secondary}`,
        }}
      />
    </EffectShell>
  );
}

export function FreedomWaveEffect({
  color = "#FFD500",
  secondary = "#005BBB",
}: EffectProps) {
  return (
    <EffectShell>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 3 + i * 0.4, opacity: [0.7, 0] }}
          transition={{ duration: 0.9, delay: i * 0.07 }}
          style={{
            position: "absolute",
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `3px solid ${i % 2 === 0 ? color : secondary}`,
            boxShadow: `0 0 24px ${color}`,
          }}
        />
      ))}
    </EffectShell>
  );
}
