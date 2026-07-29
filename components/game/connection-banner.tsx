"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/design/tokens";
import type { GameSocket } from "@/hooks/useGameSocket";

/** Максимум попыток из BACKOFF_MS клиента — показываем «2 из 7», а не голый счётчик. */
const MAX_ATTEMPTS = 7;

/**
 * Строка состояния связи. Заменяет собой «Не удалось подключиться к серверу»:
 * в каждом состоянии игрок видит, что происходит и что делать.
 */
export function ConnectionBanner({ socket }: { socket: GameSocket }) {
  const visible = socket.status === "reconnecting" || socket.status === "closed";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="pointer-events-auto fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
        >
          <div
            className="flex items-center gap-3 rounded-full border px-4 py-2 font-ui text-sm shadow-lg backdrop-blur-md"
            style={{
              borderColor: `${COLORS.gold}44`,
              background: "rgba(10,10,12,0.88)",
              color: COLORS.text_primary,
            }}
            role="status"
            aria-live="polite"
          >
            {socket.status === "reconnecting" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: COLORS.gold }} />
                <span>
                  Соединение потеряно. Переподключаемся… (
                  {Math.min(socket.reconnectAttempt, MAX_ATTEMPTS)}/{MAX_ATTEMPTS})
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" style={{ color: COLORS.red_hot }} />
                <span>{socket.closeMessage ?? "Соединение закрыто"}</span>
                {(socket.reaction === "reload" || socket.reaction === "relogin") && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1.5 rounded-full px-3 text-xs"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Обновить
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
