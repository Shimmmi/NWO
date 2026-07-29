"use client";

import { useEffect, useState } from "react";
import { COLORS } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

interface TurnTimerProps {
  deadline: string;
  totalSeconds?: number;
  className?: string;
  /** Часы сервера: разница с локальными компенсируется через hello. */
  now?: () => number;
  /** Пока соперник переподключается, отсчёт замирает. */
  paused?: boolean;
}

const SIZE = 56;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TurnTimer({
  deadline,
  totalSeconds = 90,
  className,
  now,
  paused = false,
}: TurnTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    if (paused) return;

    const clock = now ?? Date.now;
    const tick = () => {
      const ms = new Date(deadline).getTime() - clock();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadline, now, paused]);

  const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds)));
  // За десять секунд игрок должен понимать, что сейчас будет авто-пас.
  const urgent = !paused && remaining <= 10;
  const strokeColor = urgent ? COLORS.red_hot : COLORS.gold;
  const dashOffset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div
      className={cn(
        "relative inline-flex h-14 w-14 items-center justify-center font-ui transition-transform",
        urgent && "animate-pulse scale-105",
        className,
      )}
      aria-label={`Осталось ${remaining} сек.`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        className="-rotate-90"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.2s linear, stroke 0.3s ease",
            filter: urgent
              ? `drop-shadow(0 0 6px ${COLORS.red_glow})`
              : `drop-shadow(0 0 4px ${COLORS.gold}66)`,
          }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold tabular-nums"
        style={{ color: urgent ? COLORS.red_hot : COLORS.text_primary }}
      >
        {remaining}
      </span>
    </div>
  );
}
