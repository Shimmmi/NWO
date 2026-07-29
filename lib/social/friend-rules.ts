import type { FriendRecord, FriendStatus, UserRecord } from "@/lib/schema";

/** Больше — уже не список друзей, а адресная книга: панель перестаёт быть читаемой. */
export const MAX_FRIENDS = 100;
export const MAX_OUTGOING = 50;

export type FriendRequestDecision =
  /** Заявку нужно записать. Получатель отдан наружу уже суженным до не-null. */
  | { kind: "send"; target: UserRecord }
  /** Писать нечего, но это не ошибка — отвечаем 200. */
  | { kind: "noop"; status: FriendStatus }
  | { kind: "reject"; httpStatus: number; error: string };

/**
 * Чистое решение по заявке в друзья — вся матрица правил ЧАСТИ 8.2 в одном месте.
 * Роут только собирает входные данные и исполняет вердикт.
 */
export function evaluateFriendRequest(input: {
  me: UserRecord;
  targetId: string;
  target: UserRecord | null;
  /** Все рёбра, где владелец — отправитель. */
  myEdges: FriendRecord[];
  /** Ребро в обратную сторону: нужно, чтобы увидеть чужую блокировку. */
  theirEdge: FriendRecord | null;
}): FriendRequestDecision {
  const { me, targetId, target, myEdges, theirEdge } = input;

  if (targetId === me.userId) {
    return {
      kind: "reject",
      httpStatus: 400,
      error: "Нельзя добавить в друзья самого себя",
    };
  }

  if (me.isGuest) {
    return {
      kind: "reject",
      httpStatus: 403,
      error:
        "Гостевой аккаунт не может отправлять заявки в друзья. Зарегистрируйтесь.",
    };
  }

  if (!target) {
    return { kind: "reject", httpStatus: 404, error: "Игрок не найден" };
  }

  const myEdge = myEdges.find((edge) => edge.friendId === targetId) ?? null;

  if (myEdge?.status === "blocked") {
    return {
      kind: "reject",
      httpStatus: 403,
      error: "Вы заблокировали этого игрока. Сначала снимите блокировку.",
    };
  }
  if (theirEdge?.status === "blocked") {
    // Формулировка нейтральная: факт блокировки не раскрываем.
    return {
      kind: "reject",
      httpStatus: 403,
      error: "Не удалось отправить заявку этому игроку",
    };
  }

  if (myEdge?.status === "pending_out" || myEdge?.status === "accepted") {
    return { kind: "noop", status: myEdge.status };
  }
  if (myEdge?.status === "pending_in") {
    return {
      kind: "reject",
      httpStatus: 409,
      error: "Этот игрок уже отправил вам заявку — примите её",
    };
  }

  if (myEdges.filter((e) => e.status === "accepted").length >= MAX_FRIENDS) {
    return {
      kind: "reject",
      httpStatus: 409,
      error: `Достигнут предел в ${MAX_FRIENDS} друзей`,
    };
  }
  if (myEdges.filter((e) => e.status === "pending_out").length >= MAX_OUTGOING) {
    return {
      kind: "reject",
      httpStatus: 409,
      error: `Слишком много неотвеченных заявок (предел — ${MAX_OUTGOING}). Дождитесь ответа.`,
    };
  }

  return { kind: "send", target };
}
