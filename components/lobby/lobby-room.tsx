"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  Users,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/components/lobby/format";
import { getCharacterById } from "@/lib/data";
import { COLORS, getCharacterColor } from "@/lib/design/tokens";
import type { LobbyPlayerState, LobbyState } from "@/lib/net/protocol";

export type LobbyClosedReason = "host_left" | "expired" | "started" | "left";

export interface LobbyRoomProps {
  state: LobbyState;
  myUserId: string;
  onToggleReady: (ready: boolean) => void;
  onChangeCharacter: () => void;
  onLeave: () => void;
  /** Открывает френд-панель: единственный способ позвать друга из комнаты. */
  onInviteFriend: () => void;
}

const COPY_FEEDBACK_MS = 2000;

const CLOSED_TEXT: Record<LobbyClosedReason, { title: string; body: string }> = {
  host_left: {
    title: "Хост закрыл лобби",
    body: "Создатель комнаты вышел, поэтому лобби удалено.",
  },
  expired: {
    title: "Лобби закрылось",
    body: "Комната жила больше 10 минут и была закрыта автоматически.",
  },
  started: {
    title: "Матч начинается",
    body: "Лобби закрыто, потому что бой уже стартовал.",
  },
  left: {
    title: "Вы вышли из лобби",
    body: "Комната больше не отслеживается.",
  },
};

export function LobbyClosedNotice({
  reason,
  onFindMatch,
  onBack,
}: {
  reason: LobbyClosedReason;
  onFindMatch: () => void;
  onBack: () => void;
}) {
  const text = CLOSED_TEXT[reason];

  return (
    <section
      className="pointer-events-auto w-full max-w-md rounded-2xl border p-6 text-center backdrop-blur-md"
      style={{ background: "rgba(10,10,16,0.78)", borderColor: `${COLORS.gold}33` }}
      role="status"
    >
      <h2
        className="font-display text-xl tracking-[0.2em]"
        style={{ color: COLORS.gold }}
      >
        {text.title.toUpperCase()}
      </h2>
      <p className="mt-2 font-ui text-sm" style={{ color: COLORS.text_secondary }}>
        {text.body}
      </p>

      {reason !== "started" && (
        <div className="mt-5 flex flex-col gap-2">
          <Button
            className="font-ui"
            onClick={onFindMatch}
            style={{
              background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
              color: "#1A0000",
            }}
          >
            Найти матч
          </Button>
          <Button variant="ghost" className="font-ui" onClick={onBack}>
            Вернуться в меню
          </Button>
        </div>
      )}
    </section>
  );
}

function StatusLine({ player }: { player: LobbyPlayerState }) {
  if (!player.connected) {
    return (
      <span className="flex items-center gap-1.5 font-ui text-xs" style={{ color: COLORS.red_hot }}>
        <WifiOff className="h-3.5 w-3.5" />
        Потерял связь — ждём возвращения
      </span>
    );
  }
  if (player.ready) {
    return (
      <span className="flex items-center gap-1.5 font-ui text-xs" style={{ color: COLORS.text_heal }}>
        <Check className="h-3.5 w-3.5" />
        Готов
      </span>
    );
  }
  return (
    <span className="font-ui text-xs" style={{ color: COLORS.text_secondary }}>
      Не готов
    </span>
  );
}

function PlayerSlot({
  player,
  isMe,
  align,
}: {
  player: LobbyPlayerState;
  isMe: boolean;
  align: "left" | "right";
}) {
  const character = getCharacterById(player.characterId);
  const accent = getCharacterColor(player.characterId);

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: COLORS.bg_glass,
        borderColor: player.ready ? `${COLORS.gold}88` : "rgba(255,255,255,0.08)",
        boxShadow: player.ready ? `0 0 24px ${COLORS.gold}33` : "none",
        textAlign: align,
        opacity: player.connected ? 1 : 0.65,
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      >
        {player.isHost && (
          <Crown className="h-3.5 w-3.5" style={{ color: COLORS.gold }} aria-label="Хост" />
        )}
        <span
          className="font-ui text-base font-semibold"
          style={{ color: COLORS.text_primary }}
        >
          {player.nickname}
        </span>
        <span className="font-mono text-xs" style={{ color: COLORS.text_secondary }}>
          {player.rating}
        </span>
      </div>

      <p className="mt-1 font-display text-sm tracking-wider" style={{ color: accent }}>
        {character?.name ?? player.characterId}
      </p>
      <p className="font-ui text-xs" style={{ color: COLORS.text_secondary }}>
        {isMe ? "Вы" : "Соперник"}
        {character ? ` · ${character.country}` : ""}
      </p>

      <div
        className="mt-2 flex"
        style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}
      >
        <StatusLine player={player} />
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div
      className="rounded-xl border border-dashed p-4 text-right"
      style={{ background: COLORS.bg_glass, borderColor: "rgba(255,255,255,0.12)" }}
    >
      <p className="font-display text-sm tracking-[0.2em]" style={{ color: COLORS.gold }}>
        ЖДЁМ СОПЕРНИКА…
      </p>
      <p className="mt-1 font-ui text-xs" style={{ color: COLORS.text_secondary }}>
        Поделитесь кодом или ссылкой — или позовите друга из панели слева
      </p>
    </div>
  );
}

export function LobbyRoom({
  state,
  myUserId,
  onToggleReady,
  onChangeCharacter,
  onLeave,
  onInviteFriend,
}: LobbyRoomProps) {
  const reducedMotion = useReducedMotion();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [countdown, setCountdown] = useState<number | null>(() =>
    state.startingInMs === null ? null : Math.ceil(state.startingInMs / 1000),
  );
  const [expiresIn, setExpiresIn] = useState(() =>
    Math.max(0, Math.round((state.expiresAt - Date.now()) / 1000)),
  );
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const me = state.players.find((p) => p.userId === myUserId) ?? state.players[0];
  const opponent = state.players.find((p) => p.userId !== me.userId) ?? null;
  const codeCells = useMemo(() => state.code.split(""), [state.code]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const copy = useCallback(async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Буфер может быть недоступен (нет https, отказ в разрешении) —
      // тогда игрок диктует код с экрана, поэтому это не ошибка сценария.
      return;
    }
    setCopied(kind);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS);
  }, []);

  // Отсчёт считается от момента получения startingInMs: сервер присылает
  // его один раз, а тикать секунды должен клиент.
  useEffect(() => {
    if (state.startingInMs === null) {
      setCountdown(null);
      return;
    }

    const deadline = Date.now() + state.startingInMs;
    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [state.startingInMs]);

  useEffect(() => {
    const tick = () =>
      setExpiresIn(Math.max(0, Math.round((state.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.expiresAt]);

  return (
    <section
      className="pointer-events-auto w-full max-w-3xl rounded-2xl border p-5 backdrop-blur-md"
      style={{ background: "rgba(10,10,16,0.7)", borderColor: `${COLORS.gold}33` }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="font-ui text-[10px] uppercase tracking-[0.3em]"
            style={{ color: COLORS.text_secondary }}
          >
            Код комнаты
          </p>
          <div className="mt-1 flex gap-1.5" aria-label={`Код лобби ${state.code}`}>
            {codeCells.map((char, index) => (
              <span
                key={`${char}-${index}`}
                className="flex h-12 w-9 items-center justify-center rounded-md border font-ui text-[32px] tracking-[0.4em]"
                style={{
                  borderColor: `${COLORS.gold}55`,
                  background: "rgba(212,175,55,0.06)",
                  color: COLORS.gold,
                  fontWeight: 700,
                }}
              >
                {char}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-ui"
            onClick={() => void copy(state.code, "code")}
          >
            {copied === "code" ? (
              <Check className="h-4 w-4" style={{ color: COLORS.text_heal }} />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === "code" ? "Скопировано" : "Копировать код"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 font-ui"
            onClick={() => void copy(state.inviteUrl, "link")}
          >
            {copied === "link" ? (
              <Check className="h-4 w-4" style={{ color: COLORS.text_heal }} />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {copied === "link" ? "Скопировано" : "Копировать ссылку"}
          </Button>
        </div>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PlayerSlot player={me} isMe align="left" />
        {opponent ? (
          <PlayerSlot player={opponent} isMe={false} align="right" />
        ) : (
          <EmptySlot />
        )}
      </div>

      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            className="mt-4 rounded-xl border py-3 text-center"
            style={{
              borderColor: `${COLORS.gold}66`,
              background: "rgba(212,175,55,0.08)",
            }}
            aria-live="assertive"
          >
            <p
              className="font-ui text-xs uppercase tracking-[0.3em]"
              style={{ color: COLORS.text_secondary }}
            >
              Оба готовы — бой начинается
            </p>
            <p
              className="font-display text-4xl"
              style={{ color: COLORS.gold, textShadow: `0 0 30px ${COLORS.gold}88` }}
            >
              {countdown}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          className="flex-1 gap-2 font-ui text-base"
          onClick={() => onToggleReady(!me.ready)}
          style={
            me.ready
              ? {
                  background: "transparent",
                  border: `1px solid ${COLORS.gold}88`,
                  color: COLORS.gold,
                }
              : {
                  background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
                  color: "#1A0000",
                }
          }
        >
          <Check className="h-4 w-4" />
          {me.ready ? "Отменить готовность" : "Готов"}
        </Button>

        <Button variant="outline" className="gap-2 font-ui" onClick={onChangeCharacter}>
          Сменить бойца
        </Button>

        {!opponent && (
          <Button variant="outline" className="gap-2 font-ui" onClick={onInviteFriend}>
            <Users className="h-4 w-4" />
            Позвать друга
          </Button>
        )}

        <Button
          variant="ghost"
          className="gap-2 font-ui"
          onClick={onLeave}
          style={{ color: COLORS.text_secondary }}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>

      <p className="mt-3 font-ui text-xs" style={{ color: COLORS.text_secondary }}>
        {me.ready && opponent && !opponent.ready
          ? "Ждём готовности соперника."
          : `Комната закроется через ${formatClock(expiresIn)}, если бой не начнётся.`}
      </p>
    </section>
  );
}
