"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/design/tokens";
import type { GameSocket } from "@/hooks/useGameSocket";

/** Столько попыток делает транспорт (BACKOFF_MS) — показываем «2/7», не голый счётчик. */
const MAX_ATTEMPTS = 7;

interface Look {
  filled: number;
  color: string;
  label: string | null;
  pulse: boolean;
}

function look(socket: GameSocket): Look {
  if (socket.status === "closed") {
    return { filled: 1, color: COLORS.red_hot, label: "Нет связи", pulse: false };
  }
  if (socket.status === "reconnecting") {
    return {
      filled: 2,
      color: COLORS.gold,
      label: `Переподключение… (${Math.min(socket.reconnectAttempt, MAX_ATTEMPTS)}/${MAX_ATTEMPTS})`,
      pulse: true,
    };
  }
  if (socket.status !== "open") {
    return { filled: 1, color: COLORS.text_secondary, label: "Подключаемся…", pulse: true };
  }

  const rtt = socket.rttMs;
  if (rtt === null) {
    return { filled: 2, color: COLORS.text_secondary, label: null, pulse: false };
  }
  if (rtt > 200) {
    return { filled: 1, color: COLORS.red_hot, label: `${rtt} мс`, pulse: false };
  }
  if (rtt > 80) {
    return { filled: 2, color: COLORS.text_energy, label: null, pulse: false };
  }
  return { filled: 3, color: COLORS.text_heal, label: null, pulse: false };
}

/**
 * Постоянный индикатор связи. Игрок всегда видит состояние соединения и
 * никогда не гадает, завис клиент или сервер (ЧАСТЬ 11.5 ТЗ).
 */
export function ConnectionPips({ socket }: { socket: GameSocket }) {
  const reducedMotion = useReducedMotion();
  const view = look(socket);
  const animate = view.pulse && !reducedMotion;

  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-full border px-2.5 py-1 font-ui text-[11px] backdrop-blur-md"
      style={{
        background: "rgba(10,10,16,0.7)",
        borderColor: "rgba(255,255,255,0.1)",
        color: COLORS.text_secondary,
      }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="w-1 rounded-sm"
            style={{
              height: 5 + index * 4,
              background: index < view.filled ? view.color : "rgba(255,255,255,0.14)",
            }}
            animate={animate ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
            transition={
              animate
                ? { duration: 1.1, repeat: Infinity, delay: index * 0.15 }
                : { duration: 0 }
            }
          />
        ))}
      </span>

      {view.label && <span>{view.label}</span>}

      {socket.status === "closed" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-5 gap-1 px-1.5 text-[11px]"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3 w-3" />
          Переподключиться
        </Button>
      )}
    </div>
  );
}
