export const CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  AUTH_FAILED: 4401,
  AUTH_EXPIRED: 4402,
  REPLACED: 4409,
  PROTOCOL_MISMATCH: 4410,
  RATE_LIMITED: 4429,
  SERVER_SHUTDOWN: 4503,
} as const;

export type CloseCode = (typeof CLOSE)[keyof typeof CLOSE];

/** Что клиент делает после закрытия с данным кодом. */
export type CloseReaction = "reconnect" | "reload" | "relogin" | "stop";

interface CloseMeta {
  message: string;
  reaction: CloseReaction;
}

const META: Record<number, CloseMeta> = {
  [CLOSE.NORMAL]: { message: "Соединение закрыто", reaction: "stop" },
  [CLOSE.GOING_AWAY]: { message: "Соединение закрыто", reaction: "reconnect" },
  [CLOSE.AUTH_FAILED]: {
    message: "Не удалось подтвердить вход. Обновите страницу.",
    reaction: "reload",
  },
  [CLOSE.AUTH_EXPIRED]: {
    message: "Сессия истекла. Войдите заново.",
    reaction: "relogin",
  },
  [CLOSE.REPLACED]: {
    message: "Игра открыта в другой вкладке",
    reaction: "stop",
  },
  [CLOSE.PROTOCOL_MISMATCH]: {
    message: "Вышло обновление игры. Обновите страницу.",
    reaction: "reload",
  },
  [CLOSE.RATE_LIMITED]: {
    message: "Слишком много запросов. Подождите немного.",
    reaction: "reconnect",
  },
  [CLOSE.SERVER_SHUTDOWN]: {
    message: "Обновление сервера. Переподключаемся…",
    reaction: "reconnect",
  },
};

const FALLBACK: CloseMeta = {
  message: "Связь с сервером потеряна. Переподключаемся…",
  reaction: "reconnect",
};

export function describeClose(code: number): CloseMeta {
  return META[code] ?? FALLBACK;
}
