import { ProtocolError } from "@/lib/net/errors";
import { log } from "@/lib/net/log";
import type { LobbyPlayerState, LobbyState } from "@/lib/net/protocol";
import { kv } from "@/lib/redis/client";
import { K, TTL } from "@/lib/redis/keys";

export interface LobbyMember {
  userId: string;
  nickname: string;
  rating: number;
  characterId: string;
  connId: string;
}

/** Отсчёт до старта, когда оба игрока нажали «Готов» (ЧАСТЬ 7.2 ТЗ). */
const START_DELAY_MS = 3000;

/** Без визуально похожих символов: ни 0/O, ни 1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 10;

/* ------------------------------------------------------------------ *
 * Публичный API
 * ------------------------------------------------------------------ */

export async function createLobby(
  host: LobbyMember,
  origin: string,
): Promise<LobbyState> {
  const code = await reserveCode();
  const createdAt = Date.now();

  await kv().hset(K.lobby(code), {
    code,
    hostId: host.userId,
    hostNick: host.nickname,
    hostRating: host.rating,
    hostChar: host.characterId,
    hostConn: host.connId,
    hostReady: "0",
    guestId: "",
    guestNick: "",
    guestRating: "0",
    guestChar: "",
    guestConn: "",
    guestReady: "0",
    createdAt,
  });

  await touch(code);
  await kv().set(K.userLobby(host.userId), code, { ex: TTL.LOBBY_SEC });

  log({ evt: "lobby.create", code, userId: host.userId });
  return (await readLobby(code, origin))!;
}

export async function joinLobby(
  code: string,
  guest: LobbyMember,
  origin: string,
): Promise<LobbyState> {
  const result = await kv().script(
    "joinLobby",
    [K.lobby(code)],
    [
      guest.userId,
      guest.nickname,
      String(guest.rating),
      guest.characterId,
      guest.connId,
    ],
  );

  const status = Array.isArray(result) ? Number(result[0]) : -1;

  if (status === -1) {
    log({ evt: "lobby.join", code, userId: guest.userId, ok: false });
    throw new ProtocolError("LOBBY_NOT_FOUND", { code });
  }
  if (status === -2) {
    log({ evt: "lobby.join", code, userId: guest.userId, ok: false });
    throw new ProtocolError("LOBBY_FULL");
  }

  // status === -3 — это сам хост вернулся в свою комнату, не ошибка.
  const state = await readLobby(code, origin);
  if (!state) throw new ProtocolError("LOBBY_NOT_FOUND", { code });

  if (status !== -3) {
    await kv().set(K.userLobby(guest.userId), code, { ex: TTL.LOBBY_SEC });
    log({ evt: "lobby.join", code, userId: guest.userId, ok: true });
  }

  return state;
}

export async function readLobby(
  code: string,
  origin: string,
): Promise<LobbyState | null> {
  const hash = await kv().hgetall(K.lobby(code));
  if (!hash.hostId) return null;

  await touch(code);
  return buildState(hash, origin);
}

export async function setReady(
  code: string,
  userId: string,
  ready: boolean,
  origin: string,
): Promise<LobbyState | null> {
  const hash = await kv().hgetall(K.lobby(code));
  const role = roleOf(hash, userId);
  if (!role) return null;

  await kv().hset(K.lobby(code), {
    [role === "host" ? "hostReady" : "guestReady"]: ready ? "1" : "0",
  });

  return readLobby(code, origin);
}

export async function setCharacter(
  code: string,
  userId: string,
  characterId: string,
  origin: string,
): Promise<LobbyState | null> {
  const hash = await kv().hgetall(K.lobby(code));
  const role = roleOf(hash, userId);
  if (!role) return null;

  // Готовность сбрасывается: иначе можно нажать «Готов» и молча переобуться.
  await kv().hset(
    K.lobby(code),
    role === "host"
      ? { hostChar: characterId, hostReady: "0" }
      : { guestChar: characterId, guestReady: "0" },
  );

  return readLobby(code, origin);
}

export async function leaveLobby(
  code: string,
  userId: string,
  origin: string,
): Promise<{ closed: boolean; state: LobbyState | null }> {
  const hash = await kv().hgetall(K.lobby(code));
  const role = roleOf(hash, userId);
  if (!role) return { closed: !hash.hostId, state: null };

  if (role === "host") {
    await kv().del(K.lobby(code), K.lobbyCode(code));
    await kv().del(K.userLobby(hash.hostId));
    if (hash.guestId) await kv().del(K.userLobby(hash.guestId));
    return { closed: true, state: null };
  }

  await kv().hset(K.lobby(code), {
    guestId: "",
    guestNick: "",
    guestRating: "0",
    guestChar: "",
    guestConn: "",
    guestReady: "0",
  });
  await kv().del(K.userLobby(userId));

  return { closed: false, state: await readLobby(code, origin) };
}

export async function getUserLobby(userId: string): Promise<string | null> {
  return kv().get(K.userLobby(userId));
}

/* ------------------------------------------------------------------ *
 * Внутреннее
 * ------------------------------------------------------------------ */

async function touch(code: string): Promise<void> {
  await kv().expire(K.lobby(code), TTL.LOBBY_SEC);
  await kv().expire(K.lobbyCode(code), TTL.LOBBY_SEC);
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

async function reserveCode(): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const free = await kv().set(K.lobbyCode(code), "1", {
      nx: true,
      ex: TTL.LOBBY_SEC,
    });
    if (free) return code;
  }
  throw new ProtocolError("INTERNAL");
}

function roleOf(
  hash: Record<string, string>,
  userId: string,
): "host" | "guest" | null {
  if (!hash.hostId) return null;
  if (hash.hostId === userId) return "host";
  if (hash.guestId && hash.guestId === userId) return "guest";
  return null;
}

function buildState(hash: Record<string, string>, origin: string): LobbyState {
  const players: LobbyPlayerState[] = [
    {
      userId: hash.hostId,
      nickname: hash.hostNick ?? "",
      rating: Number(hash.hostRating ?? 0),
      characterId: hash.hostChar ?? "",
      ready: hash.hostReady === "1",
      isHost: true,
      connected: Boolean(hash.hostConn),
    },
  ];

  if (hash.guestId) {
    players.push({
      userId: hash.guestId,
      nickname: hash.guestNick ?? "",
      rating: Number(hash.guestRating ?? 0),
      characterId: hash.guestChar ?? "",
      ready: hash.guestReady === "1",
      isHost: false,
      connected: Boolean(hash.guestConn),
    });
  }

  const bothReady = players.length === 2 && players.every((p) => p.ready);

  return {
    code: hash.code,
    inviteUrl: `${origin}/nwo/join/${hash.code}`,
    hostId: hash.hostId,
    players,
    createdAt: Number(hash.createdAt ?? 0),
    // TTL только что продлён, поэтому отсчёт идёт от текущего момента.
    expiresAt: Date.now() + TTL.LOBBY_SEC * 1000,
    startingInMs: bothReady ? START_DELAY_MS : null,
  };
}
