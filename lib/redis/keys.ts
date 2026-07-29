/**
 * Единственное место, где формируются ключи Redis.
 * Строковых литералов ключей вне этого файла быть не должно.
 */
/** Префикс выносится в env: тесты и стенды делят один Redis, но не данные. */
const P = process.env.REDIS_PREFIX?.trim() || "nwo";

export const K = {
  // матч
  match: (id: string) => `${P}:match:${id}`,
  matchVer: (id: string) => `${P}:match:${id}:ver`,
  matchGrace: (id: string, playerNum: 1 | 2) =>
    `${P}:match:${id}:grace:${playerNum}`,
  matchSnap: (id: string) => `${P}:match:${id}:snap`,
  matchStrikes: (id: string, playerNum: 1 | 2) =>
    `${P}:match:${id}:strikes:${playerNum}`,
  rematch: (id: string) => `${P}:match:${id}:rematch`,

  // привязка пользователя
  userMatch: (userId: string) => `${P}:user:${userId}:match`,
  userLobby: (userId: string) => `${P}:user:${userId}:lobby`,

  // лобби и приглашения
  lobby: (code: string) => `${P}:lobby:${code}`,
  /** Бронь кода: SET NX здесь, а не на самом лобби — то HASH. */
  lobbyCode: (code: string) => `${P}:lobby:code:${code}`,
  invite: (inviteId: string) => `${P}:invite:${inviteId}`,
  /** Активное приглашение пары: гарантия «не больше одного» без сканов. */
  invitePair: (fromId: string, toId: string) =>
    `${P}:invite:pair:${fromId}:${toId}`,
  inviteCooldown: (fromId: string, toId: string) =>
    `${P}:invite:cd:${fromId}:${toId}`,

  // очередь
  queue: (bucket: number) => `${P}:mmq:${bucket}`,
  queueBuckets: () => `${P}:mmq:buckets`,
  queueMeta: (userId: string) => `${P}:mmq:meta:${userId}`,
  queueStats: () => `${P}:mmq:stats`,
  /** Последний соперник — основа антиреванша при подборе. */
  lastOpponent: (userId: string) => `${P}:mmq:last:${userId}`,

  // присутствие и сессии
  presence: (userId: string) => `${P}:presence:${userId}`,
  socket: (userId: string) => `${P}:sock:${userId}`,
  ticket: (jti: string) => `${P}:ticket:${jti}`,
  resume: (token: string) => `${P}:resume:${token}`,
  seen: (connId: string, msgId: string) => `${P}:seen:${connId}:${msgId}`,

  // метрики: счётчики за сутки, мгновенные значения и живые множества
  stat: (name: string, day: string) => `${P}:stat:${name}:${day}`,
  gauge: (name: string) => `${P}:gauge:${name}`,
  liveMatches: () => `${P}:live:matches`,
  liveLobbies: () => `${P}:live:lobbies`,
  rttSamples: () => `${P}:live:rtt`,

  // pub/sub — задел на несколько инстансов
  room: (matchId: string) => `${P}:room:${matchId}`,

  scanAll: () => `${P}:*`,
} as const;

export const TTL = {
  MATCH_SEC: 6 * 60 * 60,
  GRACE_SEC: 60,
  LOBBY_SEC: 10 * 60,
  INVITE_SEC: 2 * 60,
  INVITE_COOLDOWN_SEC: 60,
  PRESENCE_SEC: 45,
  TICKET_SEC: 30,
  RESUME_SEC: 5 * 60,
  SEEN_SEC: 120,
  REMATCH_SEC: 60,
  /** Счётчики держатся двое суток: вчерашний день ещё виден в /api/metrics. */
  STAT_SEC: 48 * 60 * 60,
} as const;
