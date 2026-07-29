"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/design/tokens";

/**
 * Кнопка «Засчитать победу» появляется не сразу: полминуты — вежливость к
 * тому, у кого моргнул Wi-Fi, дальше — уважение ко времени ждущего.
 */
const CLAIM_AFTER_MS = 30_000;

interface Props {
  /** Момент истечения grace-периода. null — соперник на связи. */
  until: number | null;
  onClaim: () => void;
}

export function OpponentAwayOverlay({ until, onClaim }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;

    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [until]);

  const remainingMs = until === null ? 0 : Math.max(0, until - now);
  const waitedMs = until === null ? 0 : 60_000 - remainingMs;
  const canClaim = waitedMs >= CLAIM_AFTER_MS;

  return (
    <AnimatePresence>
      {until !== null && remainingMs > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-40 flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(6,6,8,0.6)" }}
        >
          <div
            className="flex flex-col items-center gap-4 rounded-2xl border px-8 py-7 text-center"
            style={{
              borderColor: `${COLORS.gold}33`,
              background: "rgba(14,14,18,0.94)",
            }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: COLORS.gold }} />

            <div>
              <p className="font-display text-lg" style={{ color: COLORS.text_primary }}>
                Соперник переподключается
              </p>
              <p
                className="mt-1 font-ui text-3xl font-bold tabular-nums"
                style={{ color: COLORS.gold }}
              >
                {formatClock(remainingMs)}
              </p>
            </div>

            <Button
              size="sm"
              variant={canClaim ? "default" : "secondary"}
              disabled={!canClaim}
              onClick={onClaim}
              className="rounded-full px-5"
            >
              {canClaim ? "Засчитать победу" : "Ждём соперника"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
