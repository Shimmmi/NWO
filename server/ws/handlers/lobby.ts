import { ProtocolError } from "@/lib/net/errors";
import { log, logError } from "@/lib/net/log";
import type {
  ClientPayload,
  LobbyState,
  ServerPayload,
} from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";
import * as lobbies from "@/lib/redis/lobby-store";
import { getUserMatch, readMatch } from "@/lib/redis/match-store";
import * as metrics from "@/lib/redis/metrics-store";
import * as presence from "@/lib/redis/presence-store";
import { startMatch, type StartSide } from "@/server/ws/start-match";
import { registry, type Conn } from "@/server/ws/registry";

/** Отсчёт от «оба готовы» до старта. Должен совпадать со START_DELAY_MS стора. */
const START_DELAY_MS = 3000;

const DEFAULT_CHARACTER = "donald-rumpf";

/** Таймеры старта: живут только пока процесс держит комнату. */
const startTimers = new Map<string, NodeJS.Timeout>();

/* ------------------------------------------------------------------ *
 * Вход в комнату
 * ------------------------------------------------------------------ */

export async function onCreateLobby(
  conn: Conn,
  payload: ClientPayload<"create_lobby">,
): Promise<void> {
  if (await getUserMatch(conn.userId)) {
    throw new ProtocolError("ALREADY_IN_MATCH");
  }

  // Одна комната на игрока: старую закрываем, иначе она провисит весь TTL.
  if (conn.scope.kind === "lobby") await leaveCurrentLobby(conn, "left");

  const state = await lobbies.createLobby(
    {
      userId: conn.userId,
      nickname: conn.nickname,
      rating: conn.rating,
      characterId: payload.characterId,
      connId: conn.id,
    },
    conn.origin,
  );

  conn.scope = { kind: "lobby", code: state.code };
  metrics.bump("lobby.created");
  metrics.trackLobby(state.code, true);
  await presence.touch(conn.userId, "in_lobby");
  broadcast(state);
}

export async function onJoinLobby(
  conn: Conn,
  payload: ClientPayload<"join_lobby">,
): Promise<void> {
  if (await getUserMatch(conn.userId)) {
    throw new ProtocolError("ALREADY_IN_MATCH");
  }

  const code = payload.code.toUpperCase();

  if (conn.scope.kind === "lobby" && conn.scope.code !== code) {
    await leaveCurrentLobby(conn, "left");
  }

  // Доля удачных входов — метрика ссылок: битые и просроченные коды видны сразу.
  let state: LobbyState;
  try {
    state = await lobbies.joinLobby(
      code,
      {
        userId: conn.userId,
        nickname: conn.nickname,
        rating: conn.rating,
        characterId: DEFAULT_CHARACTER,
        connId: conn.id,
      },
      conn.origin,
    );
  } catch (err) {
    metrics.bump("lobby.join.fail");
    throw err;
  }

  conn.scope = { kind: "lobby", code };
  metrics.bump("lobby.join.ok");
  await presence.touch(conn.userId, "in_lobby");
  broadcast(state);
}

/* ------------------------------------------------------------------ *
 * Жизнь комнаты
 * ------------------------------------------------------------------ */

export async function onSetReady(
  conn: Conn,
  payload: ClientPayload<"set_ready">,
): Promise<void> {
  const code = requireLobby(conn);

  const state = await lobbies.setReady(
    code,
    conn.userId,
    payload.ready,
    conn.origin,
  );
  if (!state) throw new ProtocolError("LOBBY_NOT_FOUND", { code });

  broadcast(state);
  scheduleStart(state, conn.origin);
}

export async function onSetCharacter(
  conn: Conn,
  payload: ClientPayload<"set_character">,
): Promise<void> {
  const code = requireLobby(conn);

  const state = await lobbies.setCharacter(
    code,
    conn.userId,
    payload.characterId,
    conn.origin,
  );
  if (!state) throw new ProtocolError("LOBBY_NOT_FOUND", { code });

  cancelStart(code);
  broadcast(state);
}

export async function onLeaveLobby(conn: Conn): Promise<void> {
  await leaveCurrentLobby(conn, "left");
}

/**
 * Выход хоста закрывает комнату, выход гостя возвращает её в ожидание.
 * Вызывается и из обработчика разрыва связи.
 */
export async function leaveCurrentLobby(
  conn: Conn,
  reason: ServerPayload<"lobby_closed">["reason"],
): Promise<void> {
  if (conn.scope.kind !== "lobby") return;

  const { code } = conn.scope;
  conn.scope = { kind: "none" };
  cancelStart(code);

  const { closed, state } = await lobbies.leaveLobby(
    code,
    conn.userId,
    conn.origin,
  );

  if (closed) {
    log({ evt: "lobby.close", code, reason });
    metrics.trackLobby(code, false);
    for (const target of registry.all()) {
      if (target.scope.kind === "lobby" && target.scope.code === code) {
        target.scope = { kind: "none" };
        registry.send(target, "lobby_closed", { reason: "host_left" });
        await presence.touch(target.userId, "online");
      }
    }
  } else if (state) {
    broadcast(state);
  }

  registry.send(conn, "lobby_closed", { reason });
  await presence.touch(conn.userId, "online");
}

/* ------------------------------------------------------------------ *
 * Старт боя
 * ------------------------------------------------------------------ */

function scheduleStart(state: LobbyState, origin: string): void {
  cancelStart(state.code);

  const ready = state.players.length === 2 && state.players.every((p) => p.ready);
  if (!ready) return;

  const timer = setTimeout(() => {
    void beginFromLobby(state.code, origin).catch((err) =>
      logError("lobby", err),
    );
  }, START_DELAY_MS);

  timer.unref();
  startTimers.set(state.code, timer);
}

function cancelStart(code: string): void {
  const timer = startTimers.get(code);
  if (!timer) return;

  clearTimeout(timer);
  startTimers.delete(code);
}

async function beginFromLobby(code: string, origin: string): Promise<void> {
  startTimers.delete(code);

  // Состояние перечитывается: за три секунды кто-то мог отжать «Готов».
  const state = await lobbies.readLobby(code, origin);
  if (!state || state.players.length !== 2) return;
  if (!state.players.every((p) => p.ready)) return;

  const [host, guest] = state.players;
  const sides: [StartSide, StartSide] = [toSide(host), toSide(guest)];

  for (const player of state.players) {
    const conn = registry.forUser(player.userId);
    if (conn) conn.scope = { kind: "none" };
    registry.sendTo(player.userId, "lobby_closed", { reason: "started" });
  }

  await lobbies.leaveLobby(code, state.hostId, origin);
  metrics.trackLobby(code, false);
  await startMatch(sides[0], sides[1], "lobby");
}

function toSide(player: LobbyState["players"][number]): StartSide {
  return {
    userId: player.userId,
    nickname: player.nickname,
    rating: player.rating,
    characterId: player.characterId || DEFAULT_CHARACTER,
  };
}

/* ------------------------------------------------------------------ *
 * Реванш
 * ------------------------------------------------------------------ */

export async function onRematchOffer(
  conn: Conn,
  payload: ClientPayload<"rematch_offer">,
): Promise<void> {
  const stored = await readMatch(payload.matchId);
  if (!stored) throw new ProtocolError("NOT_IN_MATCH");

  const { match } = stored;
  const opponentId =
    match.player1.id === conn.userId ? match.player2.id : match.player1.id;

  if (match.player1.id !== conn.userId && match.player2.id !== conn.userId) {
    throw new ProtocolError("NOT_IN_MATCH");
  }

  // Соперник закрыл вкладку — предлагать реванш некому.
  if (!registry.isOnline(opponentId)) {
    throw new ProtocolError("FRIEND_OFFLINE", { nickname: "Соперник" });
  }

  await kv().set(K.rematch(payload.matchId), conn.userId, {
    ex: TTL.REMATCH_SEC,
  });

  registry.sendTo(opponentId, "rematch_offered", {
    matchId: payload.matchId,
    from: {
      userId: conn.userId,
      nickname: conn.nickname,
      rating: conn.rating,
    },
    expiresAt: Date.now() + TTL.REMATCH_SEC * 1000,
  });
}

export async function onRematchAccept(
  conn: Conn,
  payload: ClientPayload<"rematch_accept">,
): Promise<void> {
  const offeredBy = await kv().getdel(K.rematch(payload.matchId));
  if (!offeredBy) throw new ProtocolError("LOBBY_EXPIRED");

  const stored = await readMatch(payload.matchId);
  if (!stored) throw new ProtocolError("NOT_IN_MATCH");

  const { match } = stored;
  const initiator = match.player1.id === offeredBy ? match.player1 : match.player2;
  const accepter = match.player1.id === offeredBy ? match.player2 : match.player1;

  if (accepter.id !== conn.userId) throw new ProtocolError("NOT_IN_MATCH");
  if (!registry.isOnline(initiator.id)) {
    throw new ProtocolError("FRIEND_OFFLINE", { nickname: initiator.nickname });
  }

  const ratingOf = (userId: string) =>
    registry.forUser(userId)?.rating ?? 1000;

  // Стороны меняются местами: преимущество первого хода не закрепляется.
  await startMatch(
    {
      userId: accepter.id,
      nickname: accepter.nickname,
      rating: ratingOf(accepter.id),
      characterId: accepter.characterId,
    },
    {
      userId: initiator.id,
      nickname: initiator.nickname,
      rating: ratingOf(initiator.id),
      characterId: initiator.characterId,
    },
    "rematch",
  );
}

export async function declineRematch(
  conn: Conn,
  matchId: string,
): Promise<void> {
  const offeredBy = await kv().getdel(K.rematch(matchId));
  if (!offeredBy || offeredBy === conn.userId) return;

  registry.sendTo(offeredBy, "rematch_declined", { matchId });
}

/* ------------------------------------------------------------------ *
 * Внутреннее
 * ------------------------------------------------------------------ */

function requireLobby(conn: Conn): string {
  if (conn.scope.kind !== "lobby") throw new ProtocolError("LOBBY_NOT_FOUND");
  return conn.scope.code;
}

function broadcast(state: LobbyState): void {
  for (const player of state.players) {
    registry.sendTo(player.userId, "lobby_state", state);
  }
}

export function stopLobbyTimers(): void {
  for (const timer of startTimers.values()) clearTimeout(timer);
  startTimers.clear();
}
