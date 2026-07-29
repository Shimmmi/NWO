import { CLOSE } from "@/lib/net/close-codes";
import { buildError, ProtocolError } from "@/lib/net/errors";
import { log, logError } from "@/lib/net/log";
import {
  isClientMessageType,
  MATCH_ACTIONS,
  parseClientPayload,
  type ClientMessageType,
  type Envelope,
} from "@/lib/net/protocol";
import {
  onInviteFriend,
  onInviteRespond,
  onSubscribePresence,
} from "@/server/ws/handlers/friends";
import {
  onCreateLobby,
  onJoinLobby,
  onLeaveLobby,
  onRematchAccept,
  onRematchOffer,
  onSetCharacter,
  onSetReady,
} from "@/server/ws/handlers/lobby";
import {
  onClaimVictory,
  onPassAbility,
  onPassTurn,
  onRequestSnapshot,
  onSubmitCard,
  onSurrender,
  onUseAbility,
} from "@/server/ws/handlers/match";
import { onCancelMatchmaking, onFindMatch } from "@/server/ws/handlers/queue";
import { registry, type Conn } from "@/server/ws/registry";

/** За столько до истечения сессии игрок предупреждается, но не отключается. */
const SESSION_WARN_MS = 5 * 60 * 1000;

/** Действия, которым нужна заведомо живая сессия: они начинают новую активность. */
const NEEDS_FRESH_SESSION = new Set<ClientMessageType>([
  "find_match",
  "create_lobby",
  "join_lobby",
  "rematch_accept",
]);

export async function route(conn: Conn, env: Envelope): Promise<void> {
  if (!isClientMessageType(env.type)) {
    registry.send(conn, "error", buildError("ILLEGAL_ACTION"));
    return;
  }

  const type = env.type;

  if (type === "pong") {
    const parsed = parseClientPayload("pong", env.payload);
    if (parsed.success) registry.notePong(conn, parsed.data.echo);
    return;
  }

  const verdict = registry.consume(conn, type);
  if (!verdict.ok) {
    log({
      evt: "ws.rate_limited",
      userId: conn.userId,
      type,
      retryAfterMs: verdict.retryAfterMs ?? 0,
    });
    const error = buildError("RATE_LIMITED", {}, verdict.retryAfterMs);
    registry.fail(conn, env.id, error);
    if (verdict.kill) conn.ws.close(CLOSE.RATE_LIMITED, "rate limited");
    return;
  }

  const parsed = parseClientPayload(type, env.payload);
  if (!parsed.success) {
    registry.fail(conn, env.id, buildError("ILLEGAL_ACTION", { reason: parsed.issue }));
    return;
  }

  // Повтор после разрыва не должен играть карту дважды (ЧАСТЬ 3.8 ТЗ).
  if (MATCH_ACTIONS.has(type) && !registry.markSeen(conn, env.id)) {
    registry.ack(conn, env.id);
    return;
  }

  if (!checkSession(conn, type, env.id)) return;

  try {
    await dispatch(conn, type, parsed.data);
    registry.ack(conn, env.id);
  } catch (err) {
    if (err instanceof ProtocolError) {
      registry.fail(conn, env.id, err.payload);
      return;
    }

    logError("router", err);
    registry.fail(conn, env.id, buildError("INTERNAL"));
  }
}

function checkSession(
  conn: Conn,
  type: ClientMessageType,
  msgId: string,
): boolean {
  const remainingMs = conn.sessionExpMs - Date.now();

  if (remainingMs <= 0) {
    conn.ws.close(CLOSE.AUTH_EXPIRED, "session expired");
    return false;
  }

  if (remainingMs > SESSION_WARN_MS) return true;

  // Начатый матч дописывается, новая активность блокируется (ЧАСТЬ 5.5 ТЗ).
  const error = buildError("AUTH_REQUIRED");
  if (NEEDS_FRESH_SESSION.has(type)) {
    registry.fail(conn, msgId, error);
    return false;
  }

  registry.send(conn, "error", error);
  return true;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- сужение по ключу union'а
   TypeScript не выводит: type и payload связаны, но компилятор их не сопоставляет. */
async function dispatch(
  conn: Conn,
  type: ClientMessageType,
  payload: any,
): Promise<void> {
  switch (type) {
    case "request_snapshot":
      return onRequestSnapshot(conn, payload);

    case "find_match":
      return onFindMatch(conn, payload);
    case "cancel_matchmaking":
      return onCancelMatchmaking(conn);

    case "create_lobby":
      return onCreateLobby(conn, payload);
    case "join_lobby":
      return onJoinLobby(conn, payload);
    case "leave_lobby":
      return onLeaveLobby(conn);
    case "set_ready":
      return onSetReady(conn, payload);
    case "set_character":
      return onSetCharacter(conn, payload);
    case "rematch_offer":
      return onRematchOffer(conn, payload);
    case "rematch_accept":
      return onRematchAccept(conn, payload);

    case "invite_friend":
      return onInviteFriend(conn, payload);
    case "invite_respond":
      return onInviteRespond(conn, payload);
    case "subscribe_presence":
      return onSubscribePresence(conn);

    case "submit_card":
      return onSubmitCard(conn, payload);
    case "pass_turn":
      return onPassTurn(conn, payload);
    case "use_ability":
      return onUseAbility(conn, payload);
    case "pass_ability":
      return onPassAbility(conn, payload);
    case "surrender":
      return onSurrender(conn, payload);
    case "claim_victory":
      return onClaimVictory(conn, payload);

    // resume и pong обрабатываются до маршрутизации
    case "resume":
    case "pong":
      return;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
