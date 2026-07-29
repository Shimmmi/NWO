"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProtocolErrorPayload } from "@/lib/net/errors";
import type {
  ClientMessageType,
  ClientPayload,
  ServerMessageType,
  ServerPayload,
} from "@/lib/net/protocol";
import {
  gameClient,
  type ClientSnapshot,
  type SocketStatus,
} from "@/lib/ws/client";

export interface GameSocket {
  status: SocketStatus;
  rttMs: number | null;
  reconnectAttempt: number;
  lastError: ProtocolErrorPayload | null;
  /** Сообщение и реакция на последнее закрытие: «обновите страницу», «войдите заново». */
  closeMessage: string | null;
  reaction: ClientSnapshot["reaction"];
  send<T extends ClientMessageType>(
    type: T,
    payload: ClientPayload<T>,
  ): Promise<void>;
  serverNow: () => number;
}

/**
 * Подключение живёт дольше любого компонента: сокет один на вкладку, а хук
 * лишь подписывается на его состояние.
 */
export function useGameSocket(): GameSocket {
  const [snapshot, setSnapshot] = useState<ClientSnapshot>(() =>
    gameClient().snapshot(),
  );

  useEffect(() => {
    const client = gameClient();
    const unwatch = client.watch(setSnapshot);
    void client.connect();
    return unwatch;
  }, []);

  const send = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) =>
      gameClient().send(type, payload),
    [],
  );

  const serverNow = useCallback(() => gameClient().serverNow(), []);

  return {
    status: snapshot.status,
    rttMs: snapshot.rttMs,
    reconnectAttempt: snapshot.attempt,
    lastError: snapshot.lastError,
    closeMessage: snapshot.closeMessage,
    reaction: snapshot.reaction,
    send,
    serverNow,
  };
}

/**
 * Подписка на серверное сообщение. Обработчик держится в ref, поэтому
 * подписка не пересоздаётся на каждый рендер и события не теряются.
 */
export function useSocketEvent<T extends ServerMessageType>(
  type: T,
  handler: (payload: ServerPayload<T>) => void,
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    return gameClient().on(type, (payload) => ref.current(payload));
  }, [type]);
}
