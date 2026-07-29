"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, Radar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, formatCount, pluralize } from "@/components/lobby/format";
import { COLORS } from "@/lib/design/tokens";
import type { ServerPayload } from "@/lib/net/protocol";

export type QueueState = ServerPayload<"queue_state">;

export interface QueuePanelProps {
  state: QueueState | null;
  /** Растёт при каждом расширении окна — панель подсвечивает шкалу. */
  expandTick: number;
  onCancel: () => void;
  onPlayAi: () => void;
}

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Верхняя граница шкалы окна: дальше окно всё равно объявляется безграничным. */
const WINDOW_SCALE = 800;

function windowLabel(searchWindow: number): string {
  if (searchWindow < 0) return "Окно без ограничений — ищем любого соперника";
  return `Окно подбора ±${formatCount(searchWindow)} рейтинга`;
}

function windowFill(searchWindow: number): number {
  if (searchWindow < 0) return 1;
  return Math.min(1, searchWindow / WINDOW_SCALE);
}

export function QueuePanel({
  state,
  expandTick,
  onCancel,
  onPlayAi,
}: QueuePanelProps) {
  const reducedMotion = useReducedMotion();
  const [cancelling, setCancelling] = useState(false);
  const [aiDismissed, setAiDismissed] = useState(false);
  const [elapsed, setElapsed] = useState(state?.elapsedSeconds ?? 0);
  const [eta, setEta] = useState<number | null>(state?.etaSeconds ?? null);

  /** Первая полученная оценка: по ней считается «прождал дольше двух ETA». */
  const firstEta = useRef<number | null>(null);

  useEffect(() => {
    if (!state) return;
    setElapsed(state.elapsedSeconds);
    setEta(state.etaSeconds);
    if (firstEta.current === null && state.etaSeconds !== null) {
      firstEta.current = state.etaSeconds;
    }
  }, [state]);

  // Между кадрами queue_state секунды тикают локально: число обновляется
  // раз в секунду и не дёргается на каждом сообщении сервера.
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
      setEta((value) => (value === null ? null : Math.max(0, value - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!state) {
    // Первый queue_state ещё в пути: экран всё равно объясняет, что происходит.
    return (
      <section
        className="pointer-events-auto w-full max-w-md rounded-2xl border p-6 text-center backdrop-blur-md"
        style={{ background: "rgba(10,10,16,0.72)", borderColor: `${COLORS.gold}33` }}
        aria-live="polite"
      >
        <Radar
          className={reducedMotion ? "mx-auto h-7 w-7" : "mx-auto h-7 w-7 animate-pulse"}
          style={{ color: COLORS.gold }}
          aria-hidden
        />
        <h2
          className="mt-3 font-display text-lg tracking-[0.2em]"
          style={{ color: COLORS.gold }}
        >
          ВСТАЁМ В ОЧЕРЕДЬ
        </h2>
        <p className="mt-1 font-ui text-sm" style={{ color: COLORS.text_secondary }}>
          Отправили заявку на подбор — ждём подтверждения сервера.
        </p>
        <Button
          variant="ghost"
          className="mt-4 gap-2 font-ui"
          onClick={onCancel}
          style={{ color: COLORS.text_secondary }}
        >
          <X className="h-4 w-4" />
          Отменить
        </Button>
      </section>
    );
  }

  const baseline = firstEta.current;
  const widening = baseline !== null && elapsed > baseline * 2;
  const progress =
    eta !== null && elapsed + eta > 0 ? Math.min(1, elapsed / (elapsed + eta)) : 0;

  const headline = widening
    ? "Расширяем поиск…"
    : eta === null
      ? "Ищем соперника…"
      : "Ищем соперника";

  const subline =
    eta === null
      ? "Пока мало данных для точной оценки — держим вас в очереди"
      : `Примерно ${formatClock(eta)}`;

  return (
    <motion.section
      initial={reducedMotion ? undefined : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      className="pointer-events-auto w-full max-w-md rounded-2xl border p-6 backdrop-blur-md"
      style={{
        background: "rgba(10,10,16,0.72)",
        borderColor: `${COLORS.gold}33`,
      }}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            {eta !== null && (
              <circle
                cx="64"
                cy="64"
                r={RING_RADIUS}
                fill="none"
                stroke={COLORS.gold}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - progress)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {eta === null ? (
              <Radar
                className={reducedMotion ? "h-8 w-8" : "h-8 w-8 animate-pulse"}
                style={{ color: COLORS.gold }}
                aria-hidden
              />
            ) : (
              <span
                className="font-mono text-2xl"
                style={{ color: COLORS.text_primary }}
              >
                {formatClock(eta)}
              </span>
            )}
            <span
              className="font-ui text-[10px] uppercase tracking-[0.2em]"
              style={{ color: COLORS.text_secondary }}
            >
              в очереди {formatClock(elapsed)}
            </span>
          </div>
        </div>

        <div className="text-center">
          <h2
            className="font-display text-xl tracking-[0.2em]"
            style={{ color: COLORS.gold, textShadow: `0 0 30px ${COLORS.gold}55` }}
          >
            {headline.toUpperCase()}
          </h2>
          <p className="mt-1 font-ui text-sm" style={{ color: COLORS.text_secondary }}>
            {subline}
          </p>
        </div>

        <div className="w-full">
          <div className="mb-1.5 flex items-baseline justify-between font-ui text-xs">
            <span style={{ color: COLORS.text_secondary }}>
              {windowLabel(state.searchWindow)}
            </span>
            <span style={{ color: COLORS.text_secondary }}>
              {state.position > 0 ? `${state.position}-й в очереди` : "первый в очереди"}
            </span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.gold_glow})`,
              }}
              animate={{ width: `${windowFill(state.searchWindow) * 100}%` }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 90, damping: 18 }
              }
            />
          </div>

          {/* Импульс на расширении окна: главный сигнал «система работает». */}
          <AnimatePresence>
            <motion.div
              key={expandTick}
              initial={{ opacity: reducedMotion ? 0 : 0.9, scaleX: 0.2 }}
              animate={{ opacity: 0, scaleX: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.8, ease: "easeOut" }}
              className="mt-[-8px] h-2 w-full origin-center rounded-full"
              style={{ background: COLORS.gold_glow }}
            />
          </AnimatePresence>

          <p
            className="mt-3 text-center font-ui text-xs"
            style={{ color: COLORS.text_secondary }}
          >
            {formatCount(state.playersSearching)}{" "}
            {pluralize(state.playersSearching)} ищут бой прямо сейчас
          </p>
        </div>

        {state.offerAi && !aiDismissed && (
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl border p-3"
            style={{
              background: COLORS.bg_glass,
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <p
              className="mb-2 text-center font-ui text-xs"
              style={{ color: COLORS.text_secondary }}
            >
              Живой соперник не находится. Сыграть с ИИ, пока ждём?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 font-ui"
                onClick={onPlayAi}
                style={{
                  background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
                  color: "#1A0000",
                }}
              >
                <Bot className="h-4 w-4" />
                Сыграть с ИИ
              </Button>
              <Button
                variant="outline"
                className="flex-1 font-ui"
                onClick={() => setAiDismissed(true)}
              >
                Продолжить поиск
              </Button>
            </div>
          </motion.div>
        )}

        <Button
          variant="ghost"
          className="gap-2 font-ui"
          disabled={cancelling}
          onClick={() => {
            // Отклик до ответа сервера: откат делает родитель по queue_left.
            setCancelling(true);
            onCancel();
          }}
          style={{ color: COLORS.text_secondary }}
        >
          <X className="h-4 w-4" />
          {cancelling ? "Отменяем…" : "Отменить поиск"}
        </Button>
      </div>
    </motion.section>
  );
}
