"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/components/lobby/format";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import { getCharacterPortraitUrl } from "@/lib/game/art";
import type { ServerPayload } from "@/lib/net/protocol";

export type FriendInvite = ServerPayload<"friend_invite">;

export interface FriendInviteToastProps {
  invite: FriendInvite;
  onAccept: (invite: FriendInvite) => void;
  onDecline: (invite: FriendInvite) => void;
  /** Срок истёк — родитель убирает тост из стека. */
  onExpire: (invite: FriendInvite) => void;
}

/**
 * Игровой тост, а не `sonner`: приглашение на бой — событие уровня матча,
 * его видно на 3D-фоне и в нём есть портрет, рейтинг и живой таймер.
 */
export function FriendInviteToast({
  invite,
  onAccept,
  onDecline,
  onExpire,
}: FriendInviteToastProps) {
  const reducedMotion = useReducedMotion();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000)),
  );

  const expired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((invite.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !expired.current) {
        expired.current = true;
        onExpire(invite);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [invite, onExpire]);

  const accent = invite.from.characterId
    ? getCharacterColor(invite.from.characterId)
    : COLORS.gold;

  return (
    <motion.div
      layout
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 48, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 48 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="pointer-events-auto w-[320px] overflow-hidden rounded-xl border backdrop-blur-md"
      style={{
        background: "rgba(10,10,16,0.9)",
        borderColor: `${accent}66`,
        boxShadow: `0 0 32px ${accent}33`,
      }}
      role="alertdialog"
      aria-label={`Приглашение в бой от ${invite.from.nickname}`}
    >
      <div className="flex gap-3 p-3">
        <div
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border"
          style={{ borderColor: `${accent}88`, background: COLORS.bg_surface }}
        >
          {invite.from.characterId ? (
            <Image
              src={getCharacterPortraitUrl(invite.from.characterId, 1)}
              alt={invite.from.nickname}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display text-2xl"
              style={{ color: accent }}
            >
              {invite.from.nickname.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="font-ui text-[10px] uppercase tracking-[0.25em]"
            style={{ color: COLORS.gold }}
          >
            Вызов на бой
          </p>
          <p
            className="truncate font-ui text-base font-semibold"
            style={{ color: COLORS.text_primary }}
          >
            {invite.from.nickname}
          </p>
          <p className="font-mono text-xs" style={{ color: COLORS.text_secondary }}>
            рейтинг {invite.from.rating} · лобби {invite.code}
          </p>
          <p className="mt-0.5 font-ui text-xs" style={{ color: COLORS.text_secondary }}>
            Приглашение истечёт через {formatClock(secondsLeft)}
          </p>
        </div>
      </div>

      <div
        className="h-0.5 w-full"
        style={{
          background: accent,
          transformOrigin: "left",
          transform: `scaleX(${Math.min(1, secondsLeft / 60)})`,
          transition: "transform 1s linear",
        }}
      />

      <div className="flex gap-2 p-3 pt-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5 font-ui"
          onClick={() => onAccept(invite)}
          style={{
            background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
            color: "#1A0000",
          }}
        >
          <Swords className="h-4 w-4" />В БОЙ
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 font-ui"
          onClick={() => onDecline(invite)}
          style={{ color: COLORS.text_secondary }}
        >
          <X className="h-4 w-4" />
          Отклонить
        </Button>
      </div>
    </motion.div>
  );
}
