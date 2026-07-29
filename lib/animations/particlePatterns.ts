import type { ParticlePattern } from "./types";

export interface ParticleSeed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
}

export interface PatternOptions {
  count: number;
  originX: number;
  originY: number;
  color: string;
  secondary?: string;
  pattern: ParticlePattern;
  /** Legendary particles are 1.5–2× larger */
  legendary?: boolean;
}

/** Seed velocities/positions for canvas particle bursts. */
export function seedParticlePattern(opts: PatternOptions): ParticleSeed[] {
  const {
    count,
    originX,
    originY,
    color,
    secondary,
    pattern,
    legendary = false,
  } = opts;
  const sizeMul = legendary ? 1.75 : 1;
  const seeds: ParticleSeed[] = [];

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count);
    const c = secondary && i % 3 === 0 ? secondary : color;
    const life = 0.8 + Math.random() * 0.6;
    const baseSize = (2 + Math.random() * 3) * sizeMul;

    switch (pattern) {
      case "radial": {
        const angle = t * Math.PI * 2 + Math.random() * 0.2;
        const speed = 2 + Math.random() * 4;
        seeds.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: baseSize,
          life,
          color: c,
        });
        break;
      }
      case "spiral": {
        const angle = t * Math.PI * 6;
        const radius = 0.5 + t * 2;
        const speed = 1.5 + Math.random() * 2;
        seeds.push({
          x: originX + Math.cos(angle) * radius * 4,
          y: originY + Math.sin(angle) * radius * 4,
          vx: Math.cos(angle + Math.PI / 2) * speed + Math.cos(angle) * 0.8,
          vy: Math.sin(angle + Math.PI / 2) * speed + Math.sin(angle) * 0.8,
          size: baseSize,
          life,
          color: c,
        });
        break;
      }
      case "explosion": {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 7;
        seeds.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: baseSize * 1.2,
          life: life * 0.9,
          color: c,
        });
        break;
      }
      case "rain": {
        seeds.push({
          x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 800),
          y: -10 - Math.random() * 80,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 3 + Math.random() * 5,
          size: baseSize * 0.8,
          life: 1.0 + Math.random() * 0.4,
          color: c,
        });
        break;
      }
      case "shockwave": {
        const angle = t * Math.PI * 2;
        const speed = 3.5 + Math.random() * 2;
        seeds.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * 0.35,
          size: baseSize * 0.7,
          life: 0.9 + Math.random() * 0.3,
          color: c,
        });
        break;
      }
    }
  }

  return seeds;
}

export const PARTICLE_GRAVITY = 0.004;
