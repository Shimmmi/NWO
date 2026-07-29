"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MultiplayerLobby } from "@/components/lobby/multiplayer-lobby";
import { StaticLobbyBackdrop } from "@/components/lobby/static-backdrop";
import { ConnectionPips } from "@/components/lobby/connection-pips";
import { useGameSocket, useSocketEvent } from "@/hooks/useGameSocket";
import { getAllCharacters } from "@/lib/data";
import { COLORS } from "@/lib/design/tokens";
import type { LobbyState } from "@/lib/net/protocol";

export interface JoinFlowProps {
  code: string;
}

type JoinResult = "joining" | "joined" | "expired" | "full" | "failed";

const RESULT_TEXT: Record<
  Exclude<JoinResult, "joining" | "joined">,
  { title: string; body: string }
> = {
  expired: {
    title: "Лобби закрылось",
    body: "Ссылка больше не действует: комната истекла или её закрыл хост.",
  },
  full: {
    title: "В этом лобби уже двое игроков",
    body: "Место занято. Можно найти соперника в общей очереди.",
  },
  failed: {
    title: "Не получилось войти по ссылке",
    body: "Комната не отвечает. Попробуйте ещё раз или найдите матч в очереди.",
  },
};

export function JoinFlow({ code }: JoinFlowProps) {
  const router = useRouter();
  const socket = useGameSocket();
  const [result, setResult] = useState<JoinResult>("joining");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const requested = useRef(false);
  const fallbackCharacterId = getAllCharacters()[0]?.id ?? "";

  const transmit = socket.send;

  // Запрос уходит один раз на соединение: повторный join_lobby после
  // реконнекта сервер бы отклонил как «вы уже в лобби».
  useEffect(() => {
    if (socket.status !== "open" || requested.current) return;
    requested.current = true;
    transmit("join_lobby", { code }).catch(() => setResult("failed"));
  }, [socket.status, transmit, code]);

  useSocketEvent("lobby_state", (payload) => {
    // Хост, открывший собственную ссылку, попадает сюда же — без ошибки.
    setLobby(payload);
    setResult("joined");
  });

  useSocketEvent("error", (payload) => {
    if (payload.code === "LOBBY_FULL") setResult("full");
    else if (
      payload.code === "LOBBY_EXPIRED" ||
      payload.code === "LOBBY_NOT_FOUND"
    ) {
      setResult("expired");
    } else if (payload.code !== "RATE_LIMITED") {
      setResult("failed");
    }
  });

  if (result === "joined" && lobby) {
    return <MultiplayerLobby initialLobby={lobby} />;
  }

  const notice =
    result === "expired" || result === "full" || result === "failed"
      ? RESULT_TEXT[result]
      : null;

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: COLORS.bg_void }}
    >
      <StaticLobbyBackdrop
        myCharacterId={fallbackCharacterId}
        opponentCharacterId={null}
      />

      <div className="absolute right-4 top-4 z-20">
        <ConnectionPips socket={socket} />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <section
          className="w-full max-w-md rounded-2xl border p-6 text-center backdrop-blur-md"
          style={{
            background: "rgba(10,10,16,0.78)",
            borderColor: `${COLORS.gold}33`,
          }}
          aria-live="polite"
        >
          <p
            className="font-ui text-[10px] uppercase tracking-[0.3em]"
            style={{ color: COLORS.text_secondary }}
          >
            Приглашение в лобби
          </p>
          <p
            className="mt-1 font-ui text-3xl tracking-[0.4em]"
            style={{ color: COLORS.gold, fontWeight: 700 }}
          >
            {code}
          </p>

          {!notice ? (
            <div className="mt-6">
              <div
                className="mx-auto h-7 w-7 rounded-full border-2 border-t-transparent"
                style={{
                  borderColor: COLORS.gold,
                  borderTopColor: "transparent",
                  animation: "spin 1s linear infinite",
                }}
                aria-hidden
              />
              <p
                className="mt-3 font-ui text-sm"
                style={{ color: COLORS.text_secondary }}
              >
                {socket.status === "open"
                  ? "Заходим в комнату…"
                  : "Устанавливаем связь с игровым сервером…"}
              </p>
            </div>
          ) : (
            <>
              <h1
                className="mt-6 font-display text-xl tracking-[0.2em]"
                style={{ color: COLORS.gold }}
              >
                {notice.title.toUpperCase()}
              </h1>
              <p
                className="mt-2 font-ui text-sm"
                style={{ color: COLORS.text_secondary }}
              >
                {notice.body}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  className="font-ui"
                  onClick={() => router.push("/game/multi?find=1")}
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
                    color: "#1A0000",
                  }}
                >
                  Найти матч
                </Button>
                <Button
                  variant="ghost"
                  className="font-ui"
                  onClick={() => router.push("/game")}
                >
                  Вернуться в меню
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
