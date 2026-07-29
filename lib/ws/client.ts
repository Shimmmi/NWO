import { apiPath, BASE_PATH } from "@/lib/constants";
import { CLOSE, describeClose, type CloseReaction } from "@/lib/net/close-codes";
import { buildError, type ProtocolErrorPayload } from "@/lib/net/errors";
import {
  decodeEnvelope,
  MATCH_ACTIONS,
  PROTOCOL_VERSION,
  type ClientMessageType,
  type ClientPayload,
  type Envelope,
  type ServerMessageType,
  type ServerPayload,
} from "@/lib/net/protocol";

export type SocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed";

/** Без джиттера все клиенты придут одной волной после перезапуска сервера. */
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 8000, 8000];
const JITTER = 0.3;

const ACK_TIMEOUT_MS = 3000;
const ACK_TRIES = 3;

type Handler<T extends ServerMessageType> = (p: ServerPayload<T>) => void;

interface Pending {
  envelope: Envelope;
  tries: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: () => void;
  reject: (e: ProtocolErrorPayload) => void;
}

export interface ClientSnapshot {
  status: SocketStatus;
  rttMs: number | null;
  attempt: number;
  lastError: ProtocolErrorPayload | null;
  /** Причина последнего закрытия — по ней UI решает, что предложить игроку. */
  reaction: CloseReaction | null;
  closeMessage: string | null;
}

/**
 * Транспорт: один сокет на вкладку, автоматический реконнект, подтверждения
 * игровых действий и очередь неотправленного. React о нём не знает —
 * подписка живёт в hooks/useGameSocket.ts.
 */
export class GameClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private attempt = 0;
  private status: SocketStatus = "idle";
  private rttMs: number | null = null;
  private lastError: ProtocolErrorPayload | null = null;
  private reaction: CloseReaction | null = null;
  private closeMessage: string | null = null;

  private resumeToken: string | null = null;
  private lastSeq = -1;
  /** Разница часов клиента и сервера — таймер хода считается по серверному времени. */
  private clockSkewMs = 0;

  private intentionalClose = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly pending = new Map<string, Pending>();
  private readonly outbox: Envelope[] = [];
  private readonly handlers = new Map<string, Set<(p: unknown) => void>>();
  private readonly watchers = new Set<(s: ClientSnapshot) => void>();

  private netListenersBound = false;

  /* ---------------------------------------------------------------- *
   * Публичный API
   * ---------------------------------------------------------------- */

  snapshot(): ClientSnapshot {
    return {
      status: this.status,
      rttMs: this.rttMs,
      attempt: this.attempt,
      lastError: this.lastError,
      reaction: this.reaction,
      closeMessage: this.closeMessage,
    };
  }

  watch(fn: (s: ClientSnapshot) => void): () => void {
    this.watchers.add(fn);
    fn(this.snapshot());
    return () => this.watchers.delete(fn);
  }

  on<T extends ServerMessageType>(type: T, handler: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as (p: unknown) => void);
    this.handlers.set(type, set);

    return () => {
      set.delete(handler as (p: unknown) => void);
    };
  }

  /** Серверное время с поправкой на расхождение часов. */
  serverNow(): number {
    return Date.now() + this.clockSkewMs;
  }

  async connect(): Promise<void> {
    if (this.status === "open" || this.status === "connecting") return;

    this.intentionalClose = false;
    this.bindNetworkListeners();
    await this.open();
  }

  close(): void {
    this.intentionalClose = true;
    this.clearTimer();

    for (const p of this.pending.values()) {
      if (p.timer) clearTimeout(p.timer);
    }
    this.pending.clear();
    this.outbox.length = 0;

    this.ws?.close(CLOSE.NORMAL, "client closed");
    this.ws = null;
    this.setStatus("closed");
  }

  /**
   * Резолвится по `ack`. Действия матча переотправляются с тем же id —
   * сервер идемпотентен, повтор не сыграет карту дважды.
   */
  send<T extends ClientMessageType>(
    type: T,
    payload: ClientPayload<T>,
  ): Promise<void> {
    const envelope: Envelope = {
      v: PROTOCOL_VERSION,
      id: newId(),
      seq: this.seq++,
      type,
      ts: Date.now(),
      payload,
    };

    if (!MATCH_ACTIONS.has(type)) {
      this.transmit(envelope);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const entry: Pending = {
        envelope,
        tries: 0,
        timer: null,
        resolve,
        reject: (e) => reject(new SocketError(e)),
      };
      this.pending.set(envelope.id, entry);
      this.attemptSend(entry);
    });
  }

  /* ---------------------------------------------------------------- *
   * Соединение
   * ---------------------------------------------------------------- */

  private async open(): Promise<void> {
    this.setStatus(this.attempt ? "reconnecting" : "connecting");

    let ticket: string;
    try {
      ticket = await this.fetchTicket();
    } catch {
      this.scheduleReconnect();
      return;
    }

    const ws = new WebSocket(`${resolveWsUrl()}?t=${encodeURIComponent(ticket)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.reaction = null;
      this.closeMessage = null;
      this.setStatus("open");

      if (this.resumeToken) {
        this.transmit({
          v: PROTOCOL_VERSION,
          id: newId(),
          seq: this.seq++,
          type: "resume",
          ts: Date.now(),
          payload: { resumeToken: this.resumeToken, lastSeq: this.lastSeq },
        });
      }

      this.flushOutbox();
    };

    ws.onmessage = (e: MessageEvent<string>) => this.receive(e.data);

    ws.onclose = (e: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;

      const meta = describeClose(e.code);
      this.reaction = meta.reaction;
      this.closeMessage = meta.message;

      if (this.intentionalClose || meta.reaction === "stop") {
        this.setStatus("closed");
        return;
      }

      if (meta.reaction === "reload" || meta.reaction === "relogin") {
        this.setStatus("closed");
        this.emitStatus();
        return;
      }

      this.scheduleReconnect();
    };

    // onerror всегда сопровождается onclose — реконнект планируется там.
    ws.onerror = () => {};
  }

  private async fetchTicket(): Promise<string> {
    const res = await fetch(apiPath("/api/ws-ticket"), {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) throw new Error(`ticket ${res.status}`);

    const data = (await res.json()) as { ticket?: string };
    if (!data.ticket) throw new Error("ticket missing");

    return data.ticket;
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.timer) return;

    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    const delay = base * (1 + (Math.random() * 2 - 1) * JITTER);
    this.attempt++;
    this.setStatus("reconnecting");

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.open();
    }, delay);
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  /** Возврат сети и вкладки — повод не ждать таймер, а пробовать сразу. */
  private bindNetworkListeners(): void {
    if (this.netListenersBound || typeof window === "undefined") return;
    this.netListenersBound = true;

    const retryNow = () => {
      if (this.intentionalClose) return;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

      this.clearTimer();
      void this.open();
    };

    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") retryNow();
    });
  }

  /* ---------------------------------------------------------------- *
   * Приём
   * ---------------------------------------------------------------- */

  private receive(raw: string): void {
    const decoded = decodeEnvelope(raw);
    if (!decoded.ok) return;

    const { envelope } = decoded;
    this.lastSeq = envelope.seq;

    switch (envelope.type) {
      case "ping": {
        const { echo } = envelope.payload as ServerPayload<"ping">;
        this.clockSkewMs = envelope.ts - Date.now();
        this.transmit({
          v: PROTOCOL_VERSION,
          id: newId(),
          seq: this.seq++,
          type: "pong",
          ts: Date.now(),
          payload: { echo },
        });
        this.rttMs = Math.max(0, Date.now() - echo + this.clockSkewMs);
        this.emitStatus();
        return;
      }

      case "hello": {
        const hello = envelope.payload as ServerPayload<"hello">;
        this.resumeToken = hello.resumeToken;
        this.clockSkewMs = hello.serverTime - Date.now();
        break;
      }

      case "ack": {
        this.settle(envelope.payload as ServerPayload<"ack">);
        return;
      }

      case "error": {
        this.lastError = envelope.payload as ProtocolErrorPayload;
        this.emitStatus();
        break;
      }
    }

    for (const handler of this.handlers.get(envelope.type) ?? []) {
      handler(envelope.payload);
    }
  }

  private settle(ack: ServerPayload<"ack">): void {
    const entry = this.pending.get(ack.id);
    if (!entry) return;

    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(ack.id);

    if (ack.ok) entry.resolve();
    else entry.reject(ack.error ?? buildError("INTERNAL"));
  }

  /* ---------------------------------------------------------------- *
   * Отправка
   * ---------------------------------------------------------------- */

  private attemptSend(entry: Pending): void {
    entry.tries++;
    this.transmit(entry.envelope);

    entry.timer = setTimeout(() => {
      if (!this.pending.has(entry.envelope.id)) return;

      if (entry.tries >= ACK_TRIES) {
        this.pending.delete(entry.envelope.id);
        entry.reject(buildError("INTERNAL"));
        return;
      }

      this.attemptSend(entry);
    }, ACK_TIMEOUT_MS);
  }

  private transmit(envelope: Envelope): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope));
      return;
    }

    // Копится до восстановления связи: порядок сохраняется.
    this.outbox.push(envelope);
  }

  private flushOutbox(): void {
    const queued = this.outbox.splice(0, this.outbox.length);
    for (const envelope of queued) this.transmit(envelope);
  }

  /* ---------------------------------------------------------------- *
   * Статус
   * ---------------------------------------------------------------- */

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emitStatus();
  }

  private emitStatus(): void {
    const snapshot = this.snapshot();
    for (const watcher of this.watchers) watcher(snapshot);
  }
}

export class SocketError extends Error {
  constructor(readonly payload: ProtocolErrorPayload) {
    super(payload.message);
    this.name = "SocketError";
  }
}

/**
 * Адрес всегда same-origin и без переопределения через env: именно вшитый в
 * билд `NEXT_PUBLIC_WS_URL` был корневой причиной «Не удалось подключиться к
 * серверу» (ЧАСТЬ 0.2 ТЗ).
 */
export function resolveWsUrl(): string {
  const { protocol, host } = window.location;
  const scheme = protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${host}${BASE_PATH}/ws`;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

let singleton: GameClient | null = null;

/** Один сокет на вкладку: два соединения одного игрока — гарантированный рассинхрон. */
export function gameClient(): GameClient {
  singleton ??= new GameClient();
  return singleton;
}
