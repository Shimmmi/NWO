import { z } from "zod";

export const errorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "PROTOCOL_VERSION",
  "RATE_LIMITED",
  "NOT_IN_MATCH",
  "NOT_YOUR_TURN",
  "ILLEGAL_ACTION",
  "LOBBY_NOT_FOUND",
  "LOBBY_FULL",
  "LOBBY_EXPIRED",
  "ALREADY_QUEUED",
  "ALREADY_IN_MATCH",
  "FRIEND_OFFLINE",
  "STORAGE_UNAVAILABLE",
  "INTERNAL",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Что клиент предпримет после ошибки — UI показывает это как подсказку. */
export const recoverySchema = z.enum([
  "retry",
  "reconnect",
  "reload",
  "relogin",
  "none",
]);

export type Recovery = z.infer<typeof recoverySchema>;

export const errorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  recovery: recoverySchema,
  retryAfterMs: z.number().int().optional(),
});

export type ProtocolErrorPayload = z.infer<typeof errorSchema>;

interface ErrorTemplate {
  message: string | ((ctx: Record<string, string | number>) => string);
  recovery: Recovery;
}

const TEMPLATES: Record<ErrorCode, ErrorTemplate> = {
  AUTH_REQUIRED: {
    message: "Сессия истекла. Войдите заново.",
    recovery: "relogin",
  },
  AUTH_INVALID: {
    message: "Не удалось подтвердить вход. Обновите страницу.",
    recovery: "reload",
  },
  PROTOCOL_VERSION: {
    message: "Вышло обновление игры. Обновите страницу.",
    recovery: "reload",
  },
  RATE_LIMITED: {
    message: "Слишком быстро. Подождите секунду.",
    recovery: "retry",
  },
  NOT_IN_MATCH: {
    message: "Матч не найден или уже завершён.",
    recovery: "none",
  },
  NOT_YOUR_TURN: {
    message: "Сейчас ход соперника.",
    recovery: "none",
  },
  ILLEGAL_ACTION: {
    message: "Это действие сейчас недоступно.",
    recovery: "none",
  },
  LOBBY_NOT_FOUND: {
    message: (ctx) =>
      ctx.code
        ? `Лобби с кодом ${ctx.code} не найдено. Проверьте код.`
        : "Лобби не найдено. Проверьте код.",
    recovery: "none",
  },
  LOBBY_FULL: {
    message: "В этом лобби уже двое игроков.",
    recovery: "none",
  },
  LOBBY_EXPIRED: {
    message: "Лобби закрылось — прошло больше 10 минут.",
    recovery: "none",
  },
  ALREADY_QUEUED: {
    message: "Вы уже ищете соперника.",
    recovery: "none",
  },
  ALREADY_IN_MATCH: {
    message: "Вы уже в бою. Вернуться к матчу?",
    recovery: "none",
  },
  FRIEND_OFFLINE: {
    message: (ctx) =>
      ctx.nickname ? `${ctx.nickname} сейчас не в сети.` : "Игрок не в сети.",
    recovery: "none",
  },
  STORAGE_UNAVAILABLE: {
    message: "Технические работы. Пробуем восстановить связь…",
    recovery: "reconnect",
  },
  INTERNAL: {
    message: "Что-то пошло не так. Переподключаемся…",
    recovery: "reconnect",
  },
};

export function buildError(
  code: ErrorCode,
  ctx: Record<string, string | number> = {},
  retryAfterMs?: number,
): ProtocolErrorPayload {
  const template = TEMPLATES[code];
  const message =
    typeof template.message === "function"
      ? template.message(ctx)
      : template.message;

  return {
    code,
    message,
    recovery: template.recovery,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

/**
 * Ошибка, которую хендлеры бросают вместо ручного формирования кадра.
 * Роутер ловит её и превращает в `error` + отрицательный `ack`.
 */
export class ProtocolError extends Error {
  readonly payload: ProtocolErrorPayload;

  constructor(
    code: ErrorCode,
    ctx: Record<string, string | number> = {},
    retryAfterMs?: number,
  ) {
    const payload = buildError(code, ctx, retryAfterMs);
    super(payload.message);
    this.name = "ProtocolError";
    this.payload = payload;
  }
}

export function toProtocolError(err: unknown): ProtocolErrorPayload {
  if (err instanceof ProtocolError) return err.payload;
  return buildError("INTERNAL");
}
