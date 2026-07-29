"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { COLORS } from "@/lib/design/tokens";

export interface VersusFighter {
  nickname: string;
  rating: number;
}

export interface VersusRevealProps {
  me: VersusFighter;
  opponent: VersusFighter;
  /** Сколько всего длится подводка до боя: приходит в `match_found`. */
  countdownMs: number;
  onComplete: () => void;
  /** A/B: горизонтальный VS или диагональный. */
  layout?: "horizontal" | "diagonal";
}

const NAMES_AT_MS = 600;
const RATINGS_AT_MS = 1000;
const COUNTDOWN_AT_MS = 1800;

function RatingCounter({ value, visible }: { value: number; visible: boolean }) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      setShown(value);
      return;
    }

    const started = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 600);
      setShown(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, value, reducedMotion]);

  return (
    <span className="font-mono text-sm" style={{ color: COLORS.text_secondary }}>
      {shown}
    </span>
  );
}

/**
 * Подводка «соперник найден»: ники, рейтинги, отсчёт. Переход в бой делает
 * родитель по `onComplete` — сцена под оверлеем продолжает жить, поэтому
 * камера не прыгает на границе экранов.
 */
export function VersusReveal({
  me,
  opponent,
  countdownMs,
  onComplete,
  layout = "horizontal",
}: VersusRevealProps) {
  const reducedMotion = useReducedMotion();
  const [stage, setStage] = useState(reducedMotion ? 3 : 0);
  const [counter, setCounter] = useState<number | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const total = Math.max(1200, countdownMs);
    const startedAt = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (!reducedMotion) {
      timers.push(setTimeout(() => setStage(1), NAMES_AT_MS));
      timers.push(setTimeout(() => setStage(2), RATINGS_AT_MS));
      timers.push(setTimeout(() => setStage(3), COUNTDOWN_AT_MS));
    }

    const tick = () =>
      setCounter(
        Math.max(0, Math.ceil((total - (performance.now() - startedAt)) / 1000)),
      );

    tick();
    const interval = setInterval(tick, 250);

    timers.push(
      setTimeout(() => {
        if (done.current) return;
        done.current = true;
        onComplete();
      }, total),
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
      clearInterval(interval);
    };
  }, [countdownMs, onComplete, reducedMotion]);

  const slide = (from: number) =>
    reducedMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : { initial: { opacity: 0, x: from }, animate: { opacity: 1, x: 0 } };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-6">
      <div
        className={
          layout === "diagonal"
            ? "relative flex h-48 w-full max-w-3xl items-center justify-center px-8"
            : "flex w-full max-w-3xl items-center justify-between px-8"
        }
      >
        {stage >= 1 && (
          <motion.div
            {...slide(-80)}
            transition={{ duration: 0.35 }}
            className={
              layout === "diagonal"
                ? "absolute left-8 top-0 text-left"
                : "text-left"
            }
          >
            <p
              className="font-display text-2xl tracking-[0.15em]"
              style={{ color: COLORS.text_primary }}
            >
              {me.nickname}
            </p>
            {stage >= 2 && <RatingCounter value={me.rating} visible />}
          </motion.div>
        )}

        <motion.p
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 2.2 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: layout === "diagonal" && !reducedMotion ? -12 : 0,
          }}
          transition={{ duration: reducedMotion ? 0.2 : 0.5, ease: "easeOut" }}
          className="font-display text-5xl"
          style={{ color: COLORS.gold, textShadow: `0 0 40px ${COLORS.gold_glow}` }}
        >
          VS
        </motion.p>

        {stage >= 1 && (
          <motion.div
            {...slide(80)}
            transition={{ duration: 0.35 }}
            className={
              layout === "diagonal"
                ? "absolute bottom-0 right-8 text-right"
                : "text-right"
            }
          >
            <p
              className="font-display text-2xl tracking-[0.15em]"
              style={{ color: COLORS.text_primary }}
            >
              {opponent.nickname}
            </p>
            {stage >= 2 && <RatingCounter value={opponent.rating} visible />}
          </motion.div>
        )}
      </div>

      {stage >= 3 && counter !== null && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
          aria-live="assertive"
        >
          <p
            className="font-ui text-xs uppercase tracking-[0.3em]"
            style={{ color: COLORS.text_secondary }}
          >
            Бой начинается через
          </p>
          <p
            className="font-display text-6xl"
            style={{ color: COLORS.gold, textShadow: `0 0 50px ${COLORS.gold_glow}` }}
          >
            {counter}
          </p>
        </motion.div>
      )}
    </div>
  );
}
