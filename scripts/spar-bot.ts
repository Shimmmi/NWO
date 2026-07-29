/**
 * Спарринг-партнёр для ручной проверки в браузере: регистрируется, встаёт в
 * очередь и играет матч до конца по легальным ходам. Нужен там, где вторая
 * вкладка не помогает — сессия одна на браузер.
 *
 * Запуск: npx tsx scripts/spar-bot.ts [--base http://127.0.0.1:3410/nwo]
 */
import WebSocket from "ws";
import { setTimeout as sleep } from "node:timers/promises";
import {
  PROTOCOL_VERSION,
  type ClientMessageType,
  type ClientPayload,
  type Envelope,
  type ServerPayload,
} from "@/lib/net/protocol";

const base = argValue("--base") ?? "http://127.0.0.1:3410/nwo";
const character = argValue("--character") ?? "vladimir-pu";
const origin = new URL(base).origin;
const wsUrl = `${origin.replace(/^http/, "ws")}${new URL(base).pathname}/ws`;

/** Пауза перед ходом: мгновенные ответы бота мешают смотреть анимации. */
const THINK_MS = 1200;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function register(): Promise<string> {
  const tag = Math.floor(Math.random() * 9000 + 1000);
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: `spar-${Date.now()}@test.local`,
      password: "password12345",
      nickname: `Спарринг${tag}`,
    }),
  });
  if (!res.ok) throw new Error(`регистрация не прошла: ${res.status}`);

  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error("сервер не выдал куку сессии");

  return cookie.split(";")[0];
}

async function ticket(cookie: string): Promise<string> {
  const res = await fetch(`${base}/api/ws-ticket`, {
    method: "POST",
    headers: { cookie },
  });
  if (!res.ok) throw new Error(`тикет не выдан: ${res.status}`);

  return ((await res.json()) as { ticket: string }).ticket;
}

async function main(): Promise<void> {
  const cookie = await register();
  const ws = new WebSocket(`${wsUrl}?t=${await ticket(cookie)}`, { origin });

  let seq = 0;
  const send = <T extends ClientMessageType>(
    type: T,
    payload: ClientPayload<T>,
  ): void => {
    ws.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        id: `spar-${seq}`,
        seq: seq++,
        type,
        ts: Date.now(),
        payload,
      } satisfies Envelope),
    );
  };

  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  let matchId: string | null = null;
  let busy = false;

  ws.on("message", (raw: Buffer) => {
    const env = JSON.parse(raw.toString()) as Envelope;

    switch (env.type) {
      case "ping":
        send("pong", { echo: (env.payload as ServerPayload<"ping">).echo });
        return;

      case "hello":
        console.log("подключился, встаю в очередь");
        send("find_match", { characterId: character });
        return;

      case "match_found": {
        const found = env.payload as ServerPayload<"match_found">;
        matchId = found.matchId;
        console.log(`матч найден: соперник ${found.opponent.nickname}`);
        return;
      }

      case "game_state": {
        const state = env.payload as ServerPayload<"game_state">;
        if (!matchId || busy) return;

        const move = decide(state);
        if (!move) return;

        busy = true;
        void sleep(THINK_MS).then(() => {
          busy = false;
          if (move.kind === "pass_ability") {
            send("pass_ability", { matchId: state.matchId });
          } else if (move.kind === "pass_turn") {
            send("pass_turn", { matchId: state.matchId });
          } else {
            console.log(`играю ${move.cardId}`);
            send("submit_card", { matchId: state.matchId, cardId: move.cardId });
          }
        });
        return;
      }

      case "game_over": {
        const over = env.payload as ServerPayload<"game_over">;
        console.log(`матч окончен: ${over.reason}, победил игрок ${over.winner}`);
        ws.close();
        process.exit(0);
      }

      case "error":
        console.error("ошибка сервера:", JSON.stringify(env.payload));
        return;
    }
  });

  ws.on("close", (code) => {
    console.log(`соединение закрыто: ${code}`);
    process.exit(0);
  });
}

type Move =
  | { kind: "pass_ability" }
  | { kind: "pass_turn" }
  | { kind: "submit"; cardId: string };

/** Простейшая стратегия: способности пропускаем, в бою играем первую карту. */
function decide(state: ServerPayload<"game_state">): Move | null {
  const { view, playerNum } = state;

  if (view.phase === "ability") {
    return view.abilityOrder === playerNum ? { kind: "pass_ability" } : null;
  }

  if (view.phase !== "battle") return null;
  if (view.turnPassed[playerNum]) return null;
  if (view.battleRound.myCard) return null;

  const card = view.me.hand[0];
  return card ? { kind: "submit", cardId: card.id } : { kind: "pass_turn" };
}

void main().catch((err) => {
  console.error("спарринг-бот упал:", err);
  process.exit(1);
});
