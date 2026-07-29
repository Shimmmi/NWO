/**
 * Сквозная проверка сетевого слоя: поднимает настоящий сервер, регистрирует
 * двух игроков, сводит их через очередь и играет матч по WebSocket.
 *
 * Запуск: npx tsx scripts/check-netcode-e2e.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import WebSocket from "ws";
import {
  PROTOCOL_VERSION,
  type ClientMessageType,
  type ClientPayload,
  type Envelope,
  type ServerMessageType,
  type ServerPayload,
} from "@/lib/net/protocol";

// Случайный порт: соседний прогон или недобитый процесс не должны мешать.
const PORT = Number(
  process.env.E2E_PORT ?? 3200 + Math.floor(Math.random() * 400),
);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/nwo`;
const WS_URL = `ws://127.0.0.1:${PORT}/nwo/ws`;

const BOOT_TIMEOUT_MS = 180_000;
const EVENT_TIMEOUT_MS = 30_000;

let failures = 0;

function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  OK   ${label}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${label}`);
}

/* ------------------------------------------------------------------ *
 * Тестовый клиент
 * ------------------------------------------------------------------ */

class TestClient {
  private ws!: WebSocket;
  private seq = 0;
  private readonly inbox: Envelope[] = [];
  private readonly waiters: {
    label: string;
    match: (e: Envelope) => boolean;
    resolve: (e: Envelope) => void;
  }[] = [];

  constructor(
    readonly name: string,
    private cookie: string,
  ) {}

  async connect(): Promise<void> {
    const ticket = await this.ticket();
    this.ws = new WebSocket(`${WS_URL}?t=${ticket}`, { origin: ORIGIN });

    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });

    this.ws.on("message", (raw: Buffer) => {
      const envelope = JSON.parse(raw.toString()) as Envelope;

      // Без ответа на ping сервер оборвёт соединение через 45 секунд.
      if (envelope.type === "ping") {
        const echo = (envelope.payload as ServerPayload<"ping">).echo;
        this.raw("pong", { echo });
        return;
      }

      const index = this.waiters.findIndex((w) => w.match(envelope));
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        waiter.resolve(envelope);
        return;
      }

      this.inbox.push(envelope);
    });
  }

  async ticket(): Promise<string> {
    const res = await fetch(`${BASE}/api/ws-ticket`, {
      method: "POST",
      headers: { cookie: this.cookie },
    });
    if (!res.ok) throw new Error(`ticket ${res.status}`);

    const data = (await res.json()) as { ticket: string };
    return data.ticket;
  }

  /** Возвращает id отправленного сообщения — по нему сверяется ack. */
  send<T extends ClientMessageType>(type: T, payload: ClientPayload<T>): string {
    return this.raw(type, payload);
  }

  private raw(type: string, payload: unknown): string {
    const id = `${this.name}-${this.seq}`;
    this.ws.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        id,
        seq: this.seq++,
        type,
        ts: Date.now(),
        payload,
      } satisfies Envelope),
    );
    return id;
  }

  /** Ждёт сообщение указанного типа, сначала заглядывая в уже пришедшее. */
  async expect<T extends ServerMessageType>(
    type: T,
    timeoutMs = EVENT_TIMEOUT_MS,
  ): Promise<ServerPayload<T>> {
    return this.await_(type, (e) => e.type === type, timeoutMs) as Promise<
      ServerPayload<T>
    >;
  }

  /**
   * Ack сверяется по id: соседний запрос подтверждается тем же типом, и без
   * сверки тест ловит чужое подтверждение и уходит вперёд состояния.
   */
  async ack(id: string, timeoutMs = EVENT_TIMEOUT_MS): Promise<ServerPayload<"ack">> {
    return this.await_(
      `ack(${id})`,
      (e) => e.type === "ack" && (e.payload as ServerPayload<"ack">).id === id,
      timeoutMs,
    ) as Promise<ServerPayload<"ack">>;
  }

  private async await_(
    label: string,
    match: (e: Envelope) => boolean,
    timeoutMs: number,
  ): Promise<unknown> {
    const buffered = this.inbox.findIndex(match);
    if (buffered >= 0) {
      const [envelope] = this.inbox.splice(buffered, 1);
      return envelope.payload;
    }

    const envelope = await Promise.race([
      new Promise<Envelope>((resolve) =>
        this.waiters.push({ label, match, resolve }),
      ),
      sleep(timeoutMs).then(() => {
        // Что пришло вместо ожидаемого — половина диагноза: обычно это error.
        const seen = this.inbox.map((e) => e.type).join(", ") || "ничего";
        throw new Error(
          `${this.name}: не дождался ${label} (пришло: ${seen})\n${JSON.stringify(
            this.inbox.slice(-3),
          )}`,
        );
      }),
    ]);

    return envelope.payload;
  }

  /**
   * Свежая проекция: ждём именно свой ack, а проекцию берём последнюю из
   * пришедших — сервер шлёт её до подтверждения, значит она уже в очереди.
   */
  async snapshot(matchId: string): Promise<ServerPayload<"game_state">["view"]> {
    this.drain();
    const id = this.send("request_snapshot", { matchId });
    await this.ack(id);

    for (let i = this.inbox.length - 1; i >= 0; i--) {
      if (this.inbox[i].type !== "game_state") continue;
      const [envelope] = this.inbox.splice(i, 1);
      return (envelope.payload as ServerPayload<"game_state">).view;
    }

    throw new Error(`${this.name}: снапшот не пришёл`);
  }

  drain(): void {
    this.inbox.length = 0;
  }

  close(): void {
    this.ws?.close();
  }
}

/* ------------------------------------------------------------------ *
 * Подготовка
 * ------------------------------------------------------------------ */

async function boot(): Promise<ChildProcess> {
  if (await portBusy()) {
    throw new Error(
      `порт ${PORT} занят: остановите прошлый запуск или задайте E2E_PORT`,
    );
  }

  // Своя группа процессов: npx плодит дерево, и убить надо всё дерево целиком,
  // иначе следующий запуск упрётся в занятый порт.
  const child = spawn("node_modules/.bin/tsx", ["server/app-server.ts"], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      // Прод-режим: dev-компилятор перезаписывает .next и ломает готовую сборку.
      NODE_ENV: "production",
      REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
      // Свой префикс ключей: очередь стенда не должна подсовывать соперников.
      REDIS_PREFIX: `nwo-e2e-${PORT}`,
      DYNAMODB_ENDPOINT:
        process.env.DYNAMODB_ENDPOINT ?? "http://127.0.0.1:8020",
      AWS_ACCESS_KEY_ID: "local",
      AWS_SECRET_ACCESS_KEY: "local",
      AWS_REGION: "ru-central1",
      AUTH_SECRET: "e2e-secret-32-bytes-long-for-tests",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (b: Buffer) => process.stdout.write(dim(b)));
  child.stderr.on("data", (b: Buffer) => process.stderr.write(dim(b)));

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok || res.status === 503) return child;
    } catch {
      /* сервер ещё поднимается */
    }
    await sleep(1000);
  }

  throw new Error("сервер не поднялся");
}

async function shutdown(server: ChildProcess): Promise<void> {
  if (!server.pid) return;

  signalGroup(server.pid, "SIGTERM");

  // Порт — единственный надёжный признак: дерево процессов у tsx многослойное.
  for (let i = 0; i < 20 && (await portBusy()); i++) await sleep(500);

  if (await portBusy()) {
    signalGroup(server.pid, "SIGKILL");
    await sleep(1000);
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    /* группа уже мертва */
  }
}

async function portBusy(): Promise<boolean> {
  try {
    await fetch(`${BASE}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return true;
  } catch {
    return false;
  }
}

function dim(chunk: Buffer): string {
  return chunk
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((l) => `       │ ${l}\n`)
    .join("");
}

async function register(tag: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `e2e-${tag}-${Date.now()}@test.local`,
      password: "password12345",
      nickname: `E2E_${tag}_${Math.floor(Math.random() * 9000 + 1000)}`,
    }),
  });

  if (!res.ok) throw new Error(`register ${tag}: ${res.status}`);

  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error(`register ${tag}: нет куки`);

  return cookie.split(";")[0];
}

/* ------------------------------------------------------------------ *
 * Сценарий
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const server = await boot();

  try {
    console.log("\n1. Хендшейк и hello");
    const [cookieA, cookieB] = await Promise.all([
      register("a"),
      register("b"),
    ]);

    const a = new TestClient("A", cookieA);
    const b = new TestClient("B", cookieB);
    await a.connect();
    await b.connect();

    const helloA = await a.expect("hello");
    const helloB = await b.expect("hello");
    check(helloA.protocolVersion === PROTOCOL_VERSION, "версия протокола");
    check(helloA.resumeToken.length > 20, "выдан resume-token");
    check(helloA.resumeInto.kind === "none", "свежая сессия ничего не резюмирует");
    check(helloA.userId !== helloB.userId, "разные игроки");

    console.log("\n2. Одноразовость тикета");
    const reused = await fetch(`${BASE}/api/ws-ticket`, {
      method: "POST",
      headers: { cookie: cookieA },
    });
    const { ticket } = (await reused.json()) as { ticket: string };
    const first = new WebSocket(`${WS_URL}?t=${ticket}`, { origin: ORIGIN });
    await new Promise((r) => first.once("open", r));
    const second = new WebSocket(`${WS_URL}?t=${ticket}`, { origin: ORIGIN });
    const rejected = await new Promise<boolean>((resolve) => {
      second.once("error", () => resolve(true));
      second.once("open", () => resolve(false));
    });
    check(rejected, "повторное предъявление тикета отклонено");
    first.close();
    second.close();

    // Первое соединение A было вытеснено вторым — переподключаемся.
    await sleep(500);
    const a2 = new TestClient("A", cookieA);
    await a2.connect();
    await a2.expect("hello");

    console.log("\n3. Очередь и подбор");
    a2.send("find_match", { characterId: "donald-rumpf" });
    b.send("find_match", { characterId: "vladimir-pu" });

    const foundA = await a2.expect("match_found");
    const foundB = await b.expect("match_found");
    check(foundA.matchId === foundB.matchId, "оба попали в один матч");
    check(foundA.playerNum !== foundB.playerNum, "разные места за столом");
    check(foundA.source === "queue", "источник матча — очередь");
    check(
      foundA.opponent.nickname === helloB.nickname,
      "ник соперника берётся с сервера",
    );

    console.log("\n4. Fog of war в game_state");
    const stateA = await a2.expect("game_state");
    const view = stateA.view;
    check(view.me.hand.length > 0, "своя рука видна");
    check(
      !("hand" in view.opponent) && !("deck" in view.opponent),
      "рука и колода соперника отсутствуют как поля",
    );
    check(
      typeof view.opponent.handCount === "number",
      "у соперника видно только число карт",
    );
    check(
      !JSON.stringify(view.opponent).includes("cost"),
      "в проекции соперника нет карточных данных",
    );

    console.log("\n5. Фаза способностей");
    const matchId = foundA.matchId;
    const seats = new Map([
      [foundA.playerNum, a2],
      [foundB.playerNum, b],
    ]);

    let current = await a2.snapshot(matchId);
    check(current.phase === "ability", "матч открывается фазой способностей");
    const deadlineAtStart = Date.parse(current.turnDeadline);

    for (let guard = 0; guard < 6 && current.phase === "ability"; guard++) {
      const actor = seats.get(current.abilityOrder)!;
      const passAck = await actor.ack(actor.send("pass_ability", { matchId }));
      if (!passAck.ok) break;

      current = await a2.snapshot(matchId);
    }

    check(current.phase === "battle", "фаза способностей проходится пасами");
    check(
      Date.parse(current.turnDeadline) > deadlineAtStart,
      `смена фазы продлевает дедлайн (было ${deadlineAtStart}, стало ${Date.parse(
        current.turnDeadline,
      )})`,
    );

    console.log("\n6. Ход и подтверждение");
    a2.drain();
    b.drain();

    const cardId = current.me.hand[0].id;
    const ack = await a2.ack(a2.send("submit_card", { matchId, cardId }));
    check(ack.ok, `подача карты подтверждена${ack.error ? `: ${ack.error.code}` : ""}`);

    // Состояние берём снапшотом: между ack и рассылкой могут пройти чужие
    // кадры, и сравнивать надо с итоговым состоянием, а не с первым пришедшим.
    const afterSubmit = await a2.snapshot(matchId);
    check(
      afterSubmit.battleRound.myCard?.id === cardId,
      `своя карта видна сразу (получено: ${
        afterSubmit.battleRound.myCard?.id ?? "null"
      }, фаза ${afterSubmit.phase})`,
    );

    const oppSees = await b.snapshot(matchId);
    check(
      oppSees.battleRound.opponentSubmitted &&
        oppSees.battleRound.opponentCard === null,
      `соперник видит факт подачи, но не карту (submitted=${oppSees.battleRound.opponentSubmitted}, card=${
        oppSees.battleRound.opponentCard?.id ?? "null"
      })`,
    );

    console.log("\n7. Идемпотентность повтора");
    const before = afterSubmit.me.hand.length;
    const dupe = JSON.stringify({
      v: PROTOCOL_VERSION,
      id: "A-dupe",
      seq: 999,
      type: "submit_card",
      ts: Date.now(),
      payload: { matchId, cardId },
    });
    a2.drain();
    // Один и тот же id дважды: второй раз действие не должно примениться.
    (a2 as unknown as { ws: WebSocket }).ws.send(dupe);
    await a2.ack("A-dupe");
    (a2 as unknown as { ws: WebSocket }).ws.send(dupe);
    await a2.ack("A-dupe");

    const afterDupes = await a2.snapshot(matchId);
    check(
      afterDupes.me.hand.length === before,
      `повтор не тронул руку (было ${before}, стало ${afterDupes.me.hand.length})`,
    );

    console.log("\n8. Нелегальное действие");
    a2.drain();
    const bad = await a2.ack(
      a2.send("submit_card", { matchId, cardId: "no-such-card" }),
    );
    check(!bad.ok && bad.error?.code === "ILLEGAL_ACTION", "нелегальный ход отклонён");
    check(
      typeof bad.error?.message === "string" && bad.error.message.length > 5,
      "ошибка человекочитаема",
    );

    console.log("\n9. Реконнект возвращает в бой");
    a2.close();
    await sleep(1000);

    const backAlerts = await b.expect("opponent_disconnected");
    check(backAlerts.graceSeconds > 0, "соперник узнал об отключении");

    const a3 = new TestClient("A", cookieA);
    await a3.connect();
    const helloBack = await a3.expect("hello");
    check(
      helloBack.resumeInto.kind === "match" &&
        helloBack.resumeInto.matchId === matchId,
      "hello возвращает игрока в его матч",
    );

    const restored = await a3.expect("game_state");
    check(restored.view.id === matchId, "снапшот пришёл сразу после возврата");
    await b.expect("opponent_reconnected");
    check(true, "соперник уведомлён о возврате");

    console.log("\n10. Сдача и рейтинг");
    a3.drain();
    b.drain();
    a3.send("surrender", { matchId });

    const overA = await a3.expect("game_over");
    const overB = await b.expect("game_over");
    check(overA.reason === "surrender", "причина — сдача");
    check(overA.winner === foundB.playerNum, "победа засчитана сопернику");
    check(overA.ratingDelta < 0, "сдавшийся теряет рейтинг");
    check(overB.ratingDelta > 0, "победитель получает рейтинг");
    check(overB.newRating > 1000, "новый рейтинг пересчитан");

    console.log("\n11. После матча можно искать снова");
    b.drain();

    // Весь матч выше укладывается в секунду, а на тяжёлые операции стоит
    // интервал в 2 с. Живой игрок столько всё равно не отыгрывает.
    await sleep(2_100);
    b.send("find_match", { characterId: "vladimir-pu" });
    const queued = await b.expect("queue_state");
    check(queued.elapsedSeconds >= 0, "постановка в очередь после матча прошла");
    check(
      queued.etaSeconds === null || queued.etaSeconds > 0,
      "ETA либо честно отсутствует, либо положителен",
    );

    b.send("cancel_matchmaking", {});
    const left = await b.expect("queue_left");
    check(left.reason === "cancelled", "отмена поиска работает");

    a3.close();
    b.close();
  } finally {
    await shutdown(server);
  }

  console.log(
    failures === 0
      ? "\nNETCODE E2E: OK"
      : `\nNETCODE E2E: провалено проверок — ${failures}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nNETCODE E2E: сорвалось —", err);
  process.exit(1);
});
