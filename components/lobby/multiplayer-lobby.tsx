"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, KeyRound, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectionBanner } from "@/components/game/connection-banner";
import { CharacterCarousel } from "@/components/lobby/character-carousel";
import { ConnectionPips } from "@/components/lobby/connection-pips";
import {
  FriendInviteStack,
  FriendPanel,
  FriendPanelToggle,
} from "@/components/lobby/friend-panel";
import type { FriendInvite } from "@/components/lobby/friend-invite-toast";
import type { LobbySceneMode } from "@/components/lobby/lobby-scene";
import { StaticLobbyBackdrop } from "@/components/lobby/static-backdrop";
import {
  LobbyClosedNotice,
  LobbyRoom,
  type LobbyClosedReason,
} from "@/components/lobby/lobby-room";
import { QueuePanel, type QueueState } from "@/components/lobby/queue-panel";
import { VersusReveal } from "@/components/lobby/versus-reveal";
import { BattleIntro } from "@/components/game/battle-intro";
import {
  LOBBY_VARIANTS,
  resolveLobbyVariant,
  type LobbyVariant,
} from "@/components/lobby/variants";
import { useFriends } from "@/hooks/usePresence";
import { useGameSocket, useSocketEvent } from "@/hooks/useGameSocket";
import { apiPath } from "@/lib/constants";
import { getAllCharacters } from "@/lib/data";
import { COLORS } from "@/lib/design/tokens";
import type {
  ClientMessageType,
  ClientPayload,
  LobbyState,
  ServerPayload,
} from "@/lib/net/protocol";
import type { UserPublic } from "@/lib/schema";

const LobbyScene = dynamic(
  () => import("@/components/lobby/lobby-scene").then((m) => m.LobbyScene),
  {
    ssr: false,
    loading: () => null,
  },
);

type Phase = "idle" | "queue" | "lobby" | "closed" | "versus" | "intro";

interface Identity {
  userId: string;
  nickname: string;
  rating: number;
}

function matchHref(matchId: string): string {
  // basePath из next.config добавляется роутером сам: путь пишем без /nwo.
  // BattleIntro уже отыгран на экране лобби — повторно не запускаем.
  return `/game/${matchId}?multi=1`;
}

export interface MultiplayerLobbyProps {
  /** Комната, в которую игрок уже вошёл по deep-link: рендерим её сразу. */
  initialLobby?: LobbyState;
}

export function MultiplayerLobby({ initialLobby }: MultiplayerLobbyProps = {}) {
  const router = useRouter();
  const socket = useGameSocket();
  const friends = useFriends();
  const reducedMotion = useReducedMotion();

  const characters = getAllCharacters();
  const [selectedId, setSelectedId] = useState(characters[0]?.id ?? "");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [profile, setProfile] = useState<UserPublic | null>(null);

  const [phase, setPhase] = useState<Phase>(initialLobby ? "lobby" : "idle");
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [expandTick, setExpandTick] = useState(0);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(
    initialLobby ?? null,
  );
  const [closedReason, setClosedReason] = useState<LobbyClosedReason | null>(null);
  const [matchFound, setMatchFound] = useState<ServerPayload<"match_found"> | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [changingCharacter, setChangingCharacter] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [invites, setInvites] = useState<FriendInvite[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [variant, setVariant] = useState<LobbyVariant>("a");

  const lastWindow = useRef<number | null>(null);
  const applyPresence = friends.applyPresence;
  const refreshFriends = friends.refresh;

  useEffect(() => {
    setVariant(resolveLobbyVariant());
  }, []);

  const layout = LOBBY_VARIANTS[variant];

  // `hello` приходит один раз на соединение, поэтому при входе через deep-link
  // оно уже израсходовано — личность подстраховывается профилем из REST.
  const me: Identity | null =
    identity ??
    (profile
      ? {
          userId: profile.userId,
          nickname: profile.nickname,
          rating: profile.rating,
        }
      : null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiPath("/api/auth/me"), { credentials: "include" })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data: { user: UserPublic | null }) => {
        if (!cancelled) setProfile(data.user);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = useCallback((error: unknown) => {
    // Транспорт уже переводит протокольные ошибки в русский текст,
    // поэтому здесь остаётся только показать его.
    const message =
      error instanceof Error && error.message ? error.message : "Действие не удалось";
    toast.error(message);
  }, []);

  const transmit = socket.send;
  const send = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => {
      transmit(type, payload).catch(report);
    },
    [transmit, report],
  );

  /* ------------------------------------------------------------------ *
   * Подписки на сокет
   * ------------------------------------------------------------------ */

  useSocketEvent("hello", (payload) => {
    setIdentity({
      userId: payload.userId,
      nickname: payload.nickname,
      rating: payload.rating,
    });
    transmit("subscribe_presence", {}).catch(() => {
      // Presence — не критичный канал: панель друзей работает и по REST.
    });

    if (payload.resumeInto.kind === "match") {
      router.push(matchHref(payload.resumeInto.matchId));
    } else if (payload.resumeInto.kind === "queue") {
      setPhase("queue");
    }
  });

  useSocketEvent("queue_state", (payload) => {
    setQueueState(payload);
    setPhase((current) => (current === "versus" ? current : "queue"));

    const previous = lastWindow.current;
    // Окно только расширяется; -1 («без ограничений») — тоже расширение.
    const widened =
      previous !== null &&
      previous !== payload.searchWindow &&
      (payload.searchWindow < 0 || payload.searchWindow > previous);
    if (widened) setExpandTick((tick) => tick + 1);
    lastWindow.current = payload.searchWindow;
  });

  useSocketEvent("queue_left", (payload) => {
    lastWindow.current = null;
    setQueueState(null);

    if (payload.reason === "matched") return;

    setPhase((current) => (current === "versus" ? current : "idle"));
    if (payload.reason === "timeout") {
      toast.info("Поиск остановлен: соперник так и не нашёлся.");
    } else if (payload.reason === "error") {
      toast.error("Поиск прерван из-за сбоя. Попробуйте ещё раз.");
    }
  });

  useSocketEvent("lobby_state", (payload) => {
    setLobbyState(payload);
    setClosedReason(null);
    setQueueState(null);
    setPhase((current) => (current === "versus" ? current : "lobby"));

    const mine = payload.players.find((player) => player.userId === me?.userId);
    if (mine) setSelectedId(mine.characterId);
    if (payload.players.length === 2) setInvitedIds([]);
  });

  useSocketEvent("lobby_closed", (payload) => {
    setInvitedIds([]);
    // «started» — не закрытие для игрока: состав лобби нужен подводке боя.
    if (payload.reason === "started") return;
    setLobbyState(null);
    setClosedReason(payload.reason);
    setPhase("closed");
  });

  useSocketEvent("match_found", (payload) => {
    setMatchFound(payload);
    setQueueState(null);
    setPhase("versus");
  });

  useSocketEvent("friend_invite", (payload) => {
    setInvites((current) =>
      current.some((invite) => invite.inviteId === payload.inviteId)
        ? current
        : [...current, payload],
    );
  });

  useSocketEvent("friend_request", (payload) => {
    toast.info(`${payload.from.nickname} хочет добавить вас в друзья`);
    void refreshFriends();
  });

  useSocketEvent("presence_update", (payload) => {
    applyPresence(payload);
  });

  useSocketEvent("error", (payload) => {
    toast.error(payload.message);
    if (payload.code === "ALREADY_QUEUED") setPhase("queue");

    const lobbyRefused =
      payload.code === "LOBBY_NOT_FOUND" ||
      payload.code === "LOBBY_FULL" ||
      payload.code === "LOBBY_EXPIRED";
    // Неудачный вход по коду не должен выкидывать из уже открытой комнаты.
    if (lobbyRefused && !lobbyState) setPhase("idle");
  });

  /* ------------------------------------------------------------------ *
   * Действия
   * ------------------------------------------------------------------ */

  const findMatch = useCallback(() => {
    lastWindow.current = null;
    setExpandTick(0);
    setPhase("queue");
    send("find_match", { characterId: selectedId });
  }, [selectedId, send]);

  const cancelQueue = useCallback(() => {
    // Оптимистично: экран возвращается сразу, а queue_left { matched }
    // при опоздавшей отмене всё равно приведёт в подводку боя.
    setPhase("idle");
    setQueueState(null);
    send("cancel_matchmaking", {});
  }, [send]);

  const playAi = useCallback(() => {
    send("cancel_matchmaking", {});
    router.push("/game/ai");
  }, [router, send]);

  const createLobby = useCallback(() => {
    setClosedReason(null);
    send("create_lobby", { characterId: selectedId });
  }, [selectedId, send]);

  const joinLobby = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast.error("Код лобби состоит из 6 символов");
      return;
    }
    setClosedReason(null);
    send("join_lobby", { code });
  }, [joinCode, send]);

  const leaveLobby = useCallback(() => {
    send("leave_lobby", {});
    setLobbyState(null);
    setClosedReason(null);
    setInvitedIds([]);
    setPhase("idle");
  }, [send]);

  const chooseCharacter = useCallback(
    (characterId: string) => {
      setSelectedId(characterId);
      if (lobbyState) {
        send("set_character", { characterId });
        setChangingCharacter(false);
      }
    },
    [lobbyState, send],
  );

  const inviteFriend = useCallback(
    (friendId: string) => {
      setInvitedIds((current) =>
        current.includes(friendId) ? current : [...current, friendId],
      );
      send("invite_friend", { friendId });
    },
    [send],
  );

  const respondInvite = useCallback(
    (invite: FriendInvite, accept: boolean) => {
      setInvites((current) =>
        current.filter((item) => item.inviteId !== invite.inviteId),
      );
      send("invite_respond", { inviteId: invite.inviteId, accept });
    },
    [send],
  );

  const dropInvite = useCallback((invite: FriendInvite) => {
    setInvites((current) => current.filter((item) => item.inviteId !== invite.inviteId));
  }, []);

  const enterMatch = useCallback(() => {
    if (!matchFound) return;
    router.push(matchHref(matchFound.matchId));
  }, [matchFound, router]);

  /** VS-сцена закончилась — остаёмся на странице и показываем BattleIntro. */
  const afterVersus = useCallback(() => {
    setPhase("intro");
  }, []);

  // `?find=1` — возврат с экрана «лобби закрылось»: обещанный поиск запускается сам.
  // Query читается через location, а не useSearchParams: тот переводит страницу
  // в чистый CSR, и до загрузки бандла игрок видел бы пустой экран.
  const autoFindDone = useRef(false);

  useEffect(() => {
    if (autoFindDone.current) return;
    if (socket.status !== "open" || lobbyState) return;
    if (new URLSearchParams(window.location.search).get("find") !== "1") return;
    autoFindDone.current = true;
    findMatch();
  }, [socket.status, lobbyState, findMatch]);

  /* ------------------------------------------------------------------ *
   * Производные данные для сцены
   * ------------------------------------------------------------------ */

  const myLobbyPlayer = lobbyState?.players.find(
    (player) => player.userId === me?.userId,
  );
  const lobbyOpponent = lobbyState?.players.find(
    (player) => player.userId !== me?.userId,
  );

  const opponentCharacterId =
    phase === "versus" || phase === "intro"
      ? (matchFound?.opponent.characterId ?? lobbyOpponent?.characterId ?? null)
      : (lobbyOpponent?.characterId ?? null);

  const sceneMode: LobbySceneMode =
    phase === "versus" || phase === "intro"
      ? "versus"
      : phase === "queue"
        ? "search"
        : phase === "lobby"
          ? "lobby"
          : "solo";

  const onlineCount = useMemo(
    () => friends.friends.filter((friend) => friend.status !== "offline").length,
    [friends.friends],
  );

  const inLobby = lobbyState !== null;
  const showCarousel = phase === "idle" || (phase === "lobby" && changingCharacter);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: COLORS.bg_void }}
    >
      <div className="absolute inset-0">
        <StaticLobbyBackdrop
          myCharacterId={selectedId}
          opponentCharacterId={opponentCharacterId}
        />
        <LobbyScene
          mode={sceneMode}
          myCharacterId={selectedId}
          opponentCharacterId={opponentCharacterId}
          myReady={myLobbyPlayer?.ready ?? false}
          opponentReady={lobbyOpponent?.ready ?? false}
          searchWindow={queueState?.searchWindow ?? 0}
          expandTick={expandTick}
          variant={variant}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/game" aria-label="Назад к выбору режима">
                <ArrowLeft />
              </Link>
            </Button>
            <h1
              className="font-display text-base tracking-[0.3em] sm:text-lg"
              style={{ color: COLORS.gold, textShadow: `0 0 40px ${COLORS.gold}66` }}
            >
              МУЛЬТИПЛЕЕР
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ConnectionPips socket={socket} />
            <UserMenu />
          </div>
        </header>

        <div className="flex items-start justify-between gap-3 px-4">
          <FriendPanelToggle
            onClick={() => setFriendsOpen(true)}
            onlineCount={onlineCount}
            requestCount={friends.incoming.length}
          />

          <div
            className="pointer-events-auto rounded-xl border px-3 py-2 text-right backdrop-blur-md"
            style={{
              background: "rgba(10,10,16,0.6)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <p
              className="font-ui text-[10px] uppercase tracking-[0.25em]"
              style={{ color: COLORS.text_secondary }}
            >
              Рейтинг
            </p>
            <p className="font-mono text-lg" style={{ color: COLORS.gold }}>
              {me?.rating ?? "—"}
            </p>
            <p className="font-ui text-[11px]" style={{ color: COLORS.text_secondary }}>
              {profile
                ? `${profile.wins} побед / ${profile.losses}`
                : "статистика загружается"}
            </p>
          </div>
        </div>

        <main className="relative flex flex-1 flex-col items-center justify-end gap-5 px-4 pb-8">
          <AnimatePresence mode="wait">
            {phase === "queue" && (
              <QueuePanel
                key="queue"
                state={queueState}
                expandTick={expandTick}
                onCancel={cancelQueue}
                onPlayAi={playAi}
              />
            )}

            {phase === "lobby" && lobbyState && (
              <motion.div
                key="room"
                initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: 20 }}
                className="flex w-full flex-col items-center gap-4"
              >
                <LobbyRoom
                  state={lobbyState}
                  myUserId={me?.userId ?? ""}
                  onToggleReady={(ready) => send("set_ready", { ready })}
                  onChangeCharacter={() => setChangingCharacter((value) => !value)}
                  onLeave={leaveLobby}
                  onInviteFriend={() => setFriendsOpen(true)}
                />
              </motion.div>
            )}

            {phase === "closed" && closedReason && (
              <LobbyClosedNotice
                key="closed"
                reason={closedReason}
                onFindMatch={() => {
                  setClosedReason(null);
                  findMatch();
                }}
                onBack={() => {
                  setClosedReason(null);
                  setPhase("idle");
                }}
              />
            )}
          </AnimatePresence>

          {showCarousel && (
            <CharacterCarousel
              selectedId={selectedId}
              onSelect={chooseCharacter}
              warnResetsReady={inLobby}
            />
          )}

          {phase === "idle" && (
            <div
              className={
                layout.ctaPlacement === "center"
                  ? "absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center px-4"
                  : "flex w-full justify-center"
              }
            >
              <div className="flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-stretch">
              <Button
                className="h-14 flex-[2] gap-2 font-display text-lg tracking-[0.2em]"
                onClick={findMatch}
                style={{
                  background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
                  color: "#1A0000",
                }}
              >
                <Swords className="h-5 w-5" />
                НАЙТИ МАТЧ
              </Button>

              <Button
                variant="outline"
                className="h-14 flex-1 gap-2 font-ui"
                onClick={createLobby}
              >
                <Users className="h-4 w-4" />
                Создать лобби
              </Button>

              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") joinLobby();
                  }}
                  placeholder="КОД"
                  maxLength={6}
                  aria-label="Код лобби"
                  className="h-14 text-center font-ui text-lg tracking-[0.3em] uppercase"
                  style={{
                    background: "rgba(10,10,16,0.6)",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                />
                <Button
                  variant="outline"
                  className="h-14 gap-2 font-ui"
                  onClick={joinLobby}
                >
                  <KeyRound className="h-4 w-4" />
                  Войти
                </Button>
              </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {phase === "versus" && matchFound && (
        <VersusReveal
          me={{
            nickname: me?.nickname ?? "Вы",
            rating: me?.rating ?? 1000,
          }}
          opponent={{
            nickname: matchFound.opponent.nickname,
            rating: matchFound.opponent.rating,
          }}
          countdownMs={matchFound.countdownMs}
          onComplete={afterVersus}
          layout={layout.versusLayout}
        />
      )}

      {phase === "intro" && matchFound && (
        <BattleIntro
          player1CharacterId={
            matchFound.playerNum === 1
              ? selectedId
              : (matchFound.opponent.characterId ?? selectedId)
          }
          player2CharacterId={
            matchFound.playerNum === 1
              ? (matchFound.opponent.characterId ?? selectedId)
              : selectedId
          }
          player1Name={
            matchFound.playerNum === 1
              ? (me?.nickname ?? "Вы")
              : matchFound.opponent.nickname
          }
          player2Name={
            matchFound.playerNum === 1
              ? matchFound.opponent.nickname
              : (me?.nickname ?? "Вы")
          }
          onComplete={enterMatch}
        />
      )}

      <FriendPanel
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        friends={friends}
        inLobby={inLobby}
        onInvite={inviteFriend}
        invitedIds={invitedIds}
      />

      <FriendInviteStack
        invites={invites}
        onAccept={(invite) => respondInvite(invite, true)}
        onDecline={(invite) => respondInvite(invite, false)}
        onExpire={dropInvite}
      />

      <ConnectionBanner socket={socket} />
    </div>
  );
}
