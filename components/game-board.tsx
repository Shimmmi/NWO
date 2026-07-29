"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, ScrollText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/constants";
import { getCharacterById } from "@/lib/data";
import type { Match } from "@/lib/game/types";
import { emptyBattleRound } from "@/lib/game/types";
import type { UserPublic } from "@/lib/schema";
import type { PlayerView } from "@/lib/net/protocol";
import { viewToMatch } from "@/lib/game/view-adapter";
import { useGameSocket, useSocketEvent } from "@/hooks/useGameSocket";
import { ConnectionBanner } from "@/components/game/connection-banner";
import { ConnectionPips } from "@/components/lobby/connection-pips";
import { OpponentAwayOverlay } from "@/components/game/opponent-away-overlay";
import {
  AnimationProvider,
  useGameAnimations,
} from "@/components/game/animation-provider";
import { BattleArena } from "@/components/game/battle-arena";
import { CombatLogPanel } from "@/components/game/combat-log-panel";
import { HandZone } from "@/components/game/hand-zone";
import { AbilityPhasePanel } from "@/components/game/ability-phase-panel";
import { PhaseAnnouncer } from "@/components/game/phase-announcer";
import { TurnTimer } from "@/components/game/turn-timer";
import { BattleIntro } from "@/components/game/battle-intro";
import { TransformScene } from "@/components/game/transform-scene";
import { BattleResult } from "@/components/game/battle-result";
import { computeBattleStats } from "@/lib/game/match-stats";
import { COLORS } from "@/lib/design/tokens";
import { BALANCE } from "@/lib/game/balance";
import { cn } from "@/lib/utils";
import {
  useAbilityFlowGate,
  useBattleFlowGate,
} from "@/hooks/useGameFlowGate";
import { presentationClock } from "@/lib/game-flow/PresentationClock";

const phaseLabels: Record<Match["phase"], string> = {
  energy_recovery: "Восстановление энергии",
  card_draw: "Добор карт",
  ability: "Фаза способностей",
  battle: "Бой",
  end_turn: "Конец хода",
};

interface GameBoardProps {
  matchId: string;
}

function GameBoardInner({ matchId }: GameBoardProps) {
  const searchParams = useSearchParams();
  const isMulti = searchParams.get("multi") === "1";
  const showIntroParam = searchParams.get("intro") === "1";
  const {
    enqueueFromResolution,
    enqueueRoundEvents,
    enqueueCallout,
    current: animCurrent,
  } = useGameAnimations();

  const socket = useGameSocket();
  const lastResolutionTurnRef = useRef<number | null>(null);
  const lastRoundEventsLenRef = useRef(0);
  const prevFormsRef = useRef<{ p1: number; p2: number } | null>(null);

  const [user, setUser] = useState<UserPublic | null>(null);
  const [seatFromServer, setSeatFromServer] = useState<1 | 2 | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [shakeTarget, setShakeTarget] = useState<1 | 2 | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(showIntroParam);
  /** Момент, до которого соперник может вернуться. null — он на связи. */
  const [awayUntil, setAwayUntil] = useState<number | null>(null);
  const [serverDeadline, setServerDeadline] = useState<number | null>(null);
  const [phaseBanner, setPhaseBanner] = useState<{
    phase: Match["phase"];
    visible: boolean;
  }>({ phase: "ability", visible: false });
  const [transform, setTransform] = useState<{
    characterId: string;
    fromForm: 1 | 2 | 3;
    toForm: 1 | 2 | 3;
  } | null>(null);
  const lastPhaseRef = useRef<Match["phase"] | null>(null);

  /**
   * Место за столом называет сервер: он же раздаёт проекции. Сверка по id
   * остаётся только для игры с ИИ, где сокета нет, и молчаливого «значит,
   * первый» тут быть не должно — с ним игрок видит себя соперником.
   */
  const myPlayerNum: 1 | 2 =
    seatFromServer ??
    (match && user && match.player2.id === user.userId ? 2 : 1);

  const myPlayer = match
    ? myPlayerNum === 1
      ? match.player1
      : match.player2
    : null;
  const opponent = match
    ? myPlayerNum === 1
      ? match.player2
      : match.player1
    : null;

  const turnPassed = match?.turnPassed ?? { 1: false, 2: false };

  const canPlayBattle =
    match?.status === "in_progress" &&
    match.phase === "battle" &&
    !turnPassed[myPlayerNum as 1 | 2];

  const canPlayAbility =
    match?.status === "in_progress" &&
    match.phase === "ability" &&
    !match.abilityPhasePassed[myPlayerNum as 1 | 2] &&
    match.abilityOrder === myPlayerNum;

  const hasSubmittedEarly =
    match != null &&
    (myPlayerNum === 1
      ? !!match.battleRound.p1Card
      : !!match.battleRound.p2Card);

  const battleGate = useBattleFlowGate({
    phaseAllowsBattle: Boolean(canPlayBattle),
    hasSubmitted: hasSubmittedEarly,
    networkPlaying: playing,
    matchFinished: match?.status === "finished",
  });

  const abilityGate = useAbilityFlowGate({
    phaseAllowsAbility: Boolean(canPlayAbility),
    networkPlaying: playing,
    matchFinished: match?.status === "finished",
  });

  const normalizeMatch = (m: Match): Match => ({
    ...m,
    combatLog: m.combatLog ?? [],
    abilityPhaseCards: m.abilityPhaseCards ?? [],
    turnPassed: m.turnPassed ?? { 1: false, 2: false },
    abilityOrder: m.abilityOrder ?? 1,
    abilityPhasePassed: m.abilityPhasePassed ?? { 1: false, 2: false },
    battleRound: m.battleRound ?? emptyBattleRound(),
    roundEvents: m.roundEvents ?? [],
  });

  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(apiPath(`/api/game/${matchId}`), {
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Матч не найден");
        return null;
      }
      const data = (await res.json()) as { view: PlayerView };
      setSeatFromServer(data.view.me.playerNum);
      return normalizeMatch(viewToMatch(data.view));
    } catch {
      toast.error("Ошибка загрузки матча");
      return null;
    }
  }, [matchId]);

  const applyMatchUpdate = useCallback(
    (next: Match) => {
      const normalized = normalizeMatch(next);

      if (normalized.status === "finished") {
        presentationClock.hardReset();
      }

      if (!prevFormsRef.current) {
        prevFormsRef.current = {
          p1: normalized.player1.currentForm,
          p2: normalized.player2.currentForm,
        };
      } else {
        if (normalized.player1.currentForm > prevFormsRef.current.p1) {
          setTransform({
            characterId: normalized.player1.characterId,
            fromForm: prevFormsRef.current.p1 as 1 | 2 | 3,
            toForm: normalized.player1.currentForm,
          });
        } else if (normalized.player2.currentForm > prevFormsRef.current.p2) {
          setTransform({
            characterId: normalized.player2.characterId,
            fromForm: prevFormsRef.current.p2 as 1 | 2 | 3,
            toForm: normalized.player2.currentForm,
          });
        }
        prevFormsRef.current = {
          p1: normalized.player1.currentForm,
          p2: normalized.player2.currentForm,
        };
      }

      if (
        lastPhaseRef.current &&
        lastPhaseRef.current !== normalized.phase &&
        normalized.status === "in_progress"
      ) {
        setPhaseBanner({ phase: normalized.phase, visible: true });
        window.setTimeout(() => {
          setPhaseBanner((p) => ({ ...p, visible: false }));
        }, 700); // TZ v4 FLOW-G: ≤700ms, no presentation debt
      }
      lastPhaseRef.current = normalized.phase;

      if (normalized.roundEvents.length > lastRoundEventsLenRef.current) {
        const newEvents = normalized.roundEvents.slice(
          lastRoundEventsLenRef.current,
        );
        lastRoundEventsLenRef.current = normalized.roundEvents.length;
        enqueueRoundEvents(newEvents);

        // TZ v4 impact-first: stage combat impacts at resolve, not only on Pass
        const resolveIds = new Set(
          newEvents
            .filter((e) => e.kind === "resolve")
            .map((e) => e.cardId),
        );
        if (resolveIds.size > 0) {
          const related = normalized.combatLog.filter((e) =>
            resolveIds.has(e.cardId),
          );
          if (related.length > 0) {
            enqueueFromResolution({
              turn: related[0]?.turn ?? normalized.currentTurn,
              combatEvents: related,
              roundEvents: [],
              player1EnergyAfter: normalized.player1.energy,
              player2EnergyAfter: normalized.player2.energy,
              player1DiscardAdded: 0,
              player2DiscardAdded: 0,
              damageDealt: { to1: 0, to2: 0 },
            });
          }
        }
      }

      if (
        normalized.lastResolution &&
        normalized.lastResolution.turn !== lastResolutionTurnRef.current
      ) {
        lastResolutionTurnRef.current = normalized.lastResolution.turn;
        enqueueFromResolution(normalized.lastResolution);
        lastRoundEventsLenRef.current = 0;
      }

      setMatch(normalized);
    },
    [enqueueFromResolution, enqueueRoundEvents],
  );

  useEffect(() => {
    Promise.all([
      fetch(apiPath("/api/auth/me"), { credentials: "include" }).then((res) =>
        res.ok ? res.json() : { user: null },
      ),
      fetchMatch(),
    ])
      .then(([userData, matchData]) => {
        setUser((userData as { user: UserPublic | null }).user);
        if (matchData) {
          lastRoundEventsLenRef.current = matchData.roundEvents.length;
          lastPhaseRef.current = matchData.phase;
          prevFormsRef.current = {
            p1: matchData.player1.currentForm,
            p2: matchData.player2.currentForm,
          };
          setMatch(matchData);
        }
      })
      .finally(() => setLoading(false));
  }, [fetchMatch]);

  useSocketEvent("game_state", (payload) => {
    if (!isMulti || payload.matchId !== matchId) return;

    setSeatFromServer(payload.playerNum);
    applyMatchUpdate(viewToMatch(payload.view));
    setPlaying(false);
  });

  useSocketEvent("game_over", (payload) => {
    if (!isMulti || payload.matchId !== matchId) return;

    const won = payload.winner === myPlayerNum;
    const sign = payload.ratingDelta >= 0 ? "+" : "";
    toast[won ? "success" : "error"](
      `${won ? "Победа" : "Поражение"}: ${sign}${payload.ratingDelta} → ${payload.newRating}`,
    );
  });

  useSocketEvent("opponent_disconnected", (payload) => {
    if (!isMulti) return;
    setAwayUntil(Date.now() + payload.graceSeconds * 1000);
  });

  useSocketEvent("opponent_reconnected", () => {
    if (!isMulti) return;
    setAwayUntil(null);
    toast.success("Соперник вернулся");
  });

  useSocketEvent("turn_deadline", (payload) => {
    if (!isMulti || payload.matchId !== matchId) return;
    setServerDeadline(payload.deadlineMs);
  });

  useSocketEvent("error", (payload) => {
    if (!isMulti) return;
    toast.error(payload.message);
    setPlaying(false);
  });

  // Возврат в бой: снапшот применяется целиком, пропущенные анимации не
  // доигрываются — их проигрывание было бы источником рассинхрона.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (!isMulti) return;

    if (socket.status === "reconnecting") {
      wasOfflineRef.current = true;
      return;
    }

    if (socket.status === "open" && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      lastRoundEventsLenRef.current = 0;
      lastResolutionTurnRef.current = null;
      void socket.send("request_snapshot", { matchId });
      toast.success("Вы вернулись в бой");
    }
  }, [isMulti, socket, matchId]);

  useEffect(() => {
    if (isMulti || !match || match.status === "finished") return;

    const interval = setInterval(async () => {
      const data = await fetchMatch();
      if (data) applyMatchUpdate(data);
    }, 3000);

    return () => clearInterval(interval);
  }, [isMulti, match, fetchMatch, applyMatchUpdate]);

  useEffect(() => {
    if (animCurrent?.kind === "damage" && animCurrent.playerNum) {
      setShakeTarget(animCurrent.playerNum);
      const t = setTimeout(() => setShakeTarget(null), 400);
      return () => clearTimeout(t);
    }
  }, [animCurrent]);

  const sendAction = async (
    action:
      | { action: "play"; cardId: string }
      | { action: "submit_card"; cardId: string }
      | { action: "pass" }
      | { action: "use_ability"; abilityId: string }
      | { action: "pass_ability" },
  ) => {
    if (!user || !match) return;
    setPlaying(true);

    try {
      if (isMulti) {
        try {
          if (action.action === "play" || action.action === "submit_card") {
            await socket.send("submit_card", { matchId, cardId: action.cardId });
          } else if (action.action === "use_ability") {
            const character = getCharacterById(myPlayer!.characterId);
            const ability = character?.uniqueAbilities.find(
              (a) => a.id === action.abilityId,
            );
            if (ability) {
              enqueueCallout({
                cardName: ability.name,
                playerNum: myPlayerNum as 1 | 2,
                rarity: "rare",
              });
            }
            await socket.send("use_ability", {
              matchId,
              abilityId: action.abilityId,
            });
          } else if (action.action === "pass_ability") {
            await socket.send("pass_ability", { matchId });
          } else {
            await socket.send("pass_turn", { matchId });
          }
        } catch (err) {
          // Ответ не пришёл за три попытки — состояние на экране могло уехать.
          toast.error(
            err instanceof Error ? err.message : "Действие не подтверждено",
          );
          void socket.send("request_snapshot", { matchId });
        }
        return;
      }

      const res = await fetch(apiPath(`/api/game/${matchId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId: user.userId, ...action }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Не удалось выполнить действие");
        return;
      }

      const data = (await res.json()) as { view: PlayerView };

      if (action.action === "use_ability") {
        const character = getCharacterById(myPlayer!.characterId);
        const ability = character?.uniqueAbilities.find(
          (a) => a.id === action.abilityId,
        );
        if (ability) {
          enqueueCallout({
            cardName: ability.name,
            playerNum: myPlayerNum as 1 | 2,
            rarity: "rare",
          });
        }
      }

      setSeatFromServer(data.view.me.playerNum);
      applyMatchUpdate(viewToMatch(data.view));
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setPlaying(false);
    }
  };

  const submitCard = (cardId: string) =>
    sendAction({ action: "submit_card", cardId });
  const passTurn = () => sendAction({ action: "pass" });
  const useAbility = (abilityId: string) =>
    sendAction({ action: "use_ability", abilityId });
  const passAbilityPhase = () => sendAction({ action: "pass_ability" });

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: COLORS.bg_void }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!match || !myPlayer || !opponent) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 text-zinc-100"
        style={{ background: COLORS.bg_void }}
      >
        <p>Матч не найден</p>
        <Button asChild variant="outline">
          <Link href="/game">К выбору режима</Link>
        </Button>
      </div>
    );
  }

  const lastRes = match.lastResolution;
  const hasSubmitted = hasSubmittedEarly;

  return (
    <div
      className="relative flex min-h-screen flex-col text-zinc-100"
      style={{ background: COLORS.bg_void }}
    >
      <AnimatePresence>
        {showIntro && (
          <BattleIntro
            player1CharacterId={match.player1.characterId}
            player2CharacterId={match.player2.characterId}
            player1Name={match.player1.nickname}
            player2Name={match.player2.nickname}
            onComplete={() => setShowIntro(false)}
          />
        )}
        {transform && (
          <TransformScene
            characterId={transform.characterId}
            fromForm={transform.fromForm}
            toForm={transform.toForm}
            onComplete={() => setTransform(null)}
          />
        )}
      </AnimatePresence>

      <PhaseAnnouncer
        phase={phaseBanner.phase}
        visible={phaseBanner.visible && !showIntro && !transform}
      />

      <header className="relative z-30 shrink-0 border-b border-zinc-800/80 bg-black/40 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/game">
                <ArrowLeft />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-base tracking-wide">Матч</h1>
              <p className="font-ui text-xs text-zinc-500">
                Ход {match.currentTurn} · {phaseLabels[match.phase]}
                {isMulti && " · Online"}
                {myPlayer.relicId && " · Реликвия"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {match.status === "in_progress" && (
              <TurnTimer
                deadline={
                  serverDeadline
                    ? new Date(serverDeadline).toISOString()
                    : match.turnDeadline
                }
                totalSeconds={BALANCE.TURN_TIMER}
                now={isMulti ? socket.serverNow : undefined}
                paused={awayUntil !== null}
              />
            )}
            {isMulti && <ConnectionPips socket={socket} />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogOpen(true)}
            >
              <ScrollText />
              Лог боя
            </Button>
          </div>
        </div>
      </header>

      {isMulti && <ConnectionBanner socket={socket} />}

      <main className="relative flex min-h-0 flex-1 flex-col gap-2 px-2 py-2 md:px-4">
        <OpponentAwayOverlay
          until={awayUntil}
          onClaim={() => {
            setAwayUntil(null);
            void socket.send("claim_victory", { matchId });
          }}
        />
        <BattleArena
          className="min-h-0 flex-1"
          opponent={opponent}
          player={myPlayer}
          playedCards={match.abilityPhaseCards ?? []}
          battleRound={match.battleRound}
          myPlayerNum={myPlayerNum}
          shakeTarget={
            shakeTarget === myPlayerNum
              ? 1
              : shakeTarget && shakeTarget !== myPlayerNum
                ? 2
                : null
          }
        />

        {!canPlayBattle && !canPlayAbility && match.status === "in_progress" && (
          <p className="font-ui text-center text-sm text-zinc-500">
            {match.phase === "ability"
              ? turnPassed[myPlayerNum as 1 | 2] ||
                match.abilityPhasePassed[myPlayerNum as 1 | 2]
                ? "Ожидание соперника в фазе способностей..."
                : "Ожидание хода в фазе способностей..."
              : turnPassed[myPlayerNum as 1 | 2]
                ? "Ожидание соперника..."
                : hasSubmitted
                  ? "Карта выбрана — ожидание соперника..."
                  : `Фаза: ${phaseLabels[match.phase]}`}
          </p>
        )}
      </main>

      {match.phase === "ability" && match.status === "in_progress" && (
        <AbilityPhasePanel
          player={myPlayer}
          match={match}
          playerNum={myPlayerNum as 1 | 2}
          playing={playing || !abilityGate.canAct}
          softLock={abilityGate.softLockVisual}
          onUseAbility={useAbility}
          onPassPhase={passAbilityPhase}
        />
      )}

      {match.phase === "battle" && match.status === "in_progress" && (
        <HandZone
          player={myPlayer}
          visible
          canInteract={battleGate.canAct}
          playing={playing}
          softLock={battleGate.softLockVisual}
          gateReason={battleGate.reason}
          onPlayCard={submitCard}
          onPassTurn={passTurn}
        />
      )}

      {match.status === "finished" && (
        <BattleResult
          winner={match.winner}
          playerNum={myPlayerNum as 1 | 2}
          stats={computeBattleStats(match, myPlayerNum as 1 | 2)}
        />
      )}

      {logOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4">
          <div
            className={cn(
              "pointer-events-auto w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-950/95 shadow-2xl backdrop-blur-md",
            )}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-200">Журнал боя</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLogOpen(false)}
              >
                <X />
              </Button>
            </div>
            <CombatLogPanel
              className="border-0 bg-transparent"
              combatLog={match.combatLog ?? []}
              turnHistory={match.turnHistory}
              lastResolutionTurn={lastRes?.turn}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function GameBoard(props: GameBoardProps) {
  return (
    <AnimationProvider>
      <GameBoardInner {...props} />
    </AnimationProvider>
  );
}
