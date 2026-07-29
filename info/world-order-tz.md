# WORLD ORDER — Техническое задание на реализацию
> Версия 2.0 · Целевая платформа: Cursor AI · Стек: Next.js 15 + TypeScript 5

---

## СОДЕРЖАНИЕ

1. [Стек и версии](#1-стек-и-версии)
2. [Структура проекта](#2-структура-проекта)
3. [Аутентификация](#3-аутентификация)
4. [Игровой движок](#4-игровой-движок)
5. [WebSocket и мультиплеер](#5-websocket-и-мультиплеер)
6. [База данных](#6-база-данных)
7. [Персонажи](#7-персонажи)
8. [API эндпоинты](#8-api-эндпоинты)
9. [Конфигурация и деплой](#9-конфигурация-и-деплой)
10. [Известные проблемы и фиксы](#10-известные-проблемы-и-фиксы)
11. [Инструкции для Cursor](#11-инструкции-для-cursor)

---

## 1. СТЕК И ВЕРСИИ

### 1.1 Актуальный стек (исправленный)

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Фреймворк | Next.js App Router | `^15.2.0` |
| Язык | TypeScript | `^5.7.0` |
| Стили | Tailwind CSS | `^3.4.0` |
| UI-примитивы | shadcn/ui | latest (CLI) |
| Анимации | tw-animate-css | `^1.2.0` |
| Иконки | lucide-react | `^0.400.0` |
| Уведомления | sonner | `^1.5.0` |
| База данных | DynamoDB (Yandex Cloud Document API) | AWS SDK v3 |
| Аутентификация | PBKDF2 + HMAC-сессии | Node.js crypto |
| Реалтайм | ws | `^8.17.0` |
| Валидация | zod | `^3.23.0` |
| Контейнеризация | Docker + Docker Compose | v3.9 |

> ⚠️ **Важно:** Next.js 16 и TypeScript 6 не существуют. Указанные версии были артефактом Yandex-конструктора. Использовать строго версии из таблицы выше.

### 1.2 Начальная инициализация проекта (Cursor-промпт)

```
Создай новый проект card-fighter:
- npx create-next-app@15 card-fighter --typescript --tailwind --app --src-dir no
- Установи зависимости: ws@^8.17.0 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb zod sonner lucide-react
- Установи dev-зависимости: @types/ws
- Инициализируй shadcn/ui: npx shadcn@latest init
- Добавь shadcn-компоненты: button card input skeleton avatar dropdown-menu
- Настрой tsconfig.json: strict: true, paths: { "@/*": ["./*"] }
```

---

## 2. СТРУКТУРА ПРОЕКТА

```
card-fighter/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── demo/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── me/route.ts
│   │   │   └── register/route.ts
│   │   ├── decks/
│   │   │   ├── route.ts             # GET (список) + POST (создать)
│   │   │   └── [id]/route.ts        # PUT (обновить) + DELETE
│   │   ├── game/
│   │   │   ├── route.ts             # POST: создать матч
│   │   │   └── [id]/route.ts        # GET: состояние + POST: ход
│   │   └── health/route.ts
│   ├── auth/page.tsx
│   ├── characters/page.tsx
│   ├── decks/page.tsx
│   ├── game/
│   │   ├── page.tsx
│   │   ├── ai/page.tsx
│   │   ├── multi/page.tsx
│   │   └── [id]/page.tsx
│   ├── profile/page.tsx
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                          # shadcn/ui примитивы (не трогать)
│   ├── auth-form.tsx
│   ├── home-page.tsx
│   ├── user-menu.tsx
│   ├── character-gallery.tsx
│   ├── deck-builder.tsx
│   ├── game-mode-select.tsx
│   ├── game-ai-lobby.tsx
│   ├── game-multi-lobby.tsx
│   ├── game-board.tsx
│   └── profile-page.tsx
├── lib/
│   ├── auth.ts
│   ├── data.ts                      # Статические данные персонажей
│   ├── db.ts                        # DynamoDB клиент
│   ├── models.ts                    # CRUD-операции
│   ├── schema.ts                    # Схемы таблиц
│   ├── validation.ts                # Zod-схемы
│   ├── mock-data.ts
│   ├── utils.ts
│   ├── game/
│   │   ├── types.ts
│   │   ├── engine.ts
│   │   ├── cards.ts
│   │   ├── effects.ts
│   │   ├── ai.ts
│   │   └── store.ts                 # In-memory хранилище матчей
│   └── ws/
│       ├── client.ts
│       ├── connection.ts
│       ├── matchmaking.ts
│       ├── lobby.ts
│       └── types.ts
├── server/
│   └── index.ts                     # Кастомный HTTP+WS сервер (порт 3001)
├── scripts/
│   └── migrate.ts
├── next.config.ts
├── docker-compose.yml
├── Dockerfile
└── Dockerfile.dev
```

---

## 3. АУТЕНТИФИКАЦИЯ

### 3.1 Поток входа

```
Пользователь → /auth → auth-form.tsx
  ├── Регистрация: POST /api/auth/register → { email, password, nickname }
  │   → hashPassword (PBKDF2, 100000 итераций, sha256)
  │   → Сохранить в DynamoDB (users)
  │   → createSession (HMAC-sha256, payload: { userId, email })
  │   → Set-Cookie: session=...; HttpOnly; SameSite=Lax; Path=/
  │   → Ответ 201 → window.location.href = "/"   ← ПОЛНЫЙ ПЕРЕХОД (не router.push)
  │
  ├── Вход: POST /api/auth/login → { email, password }
  │   → findUserByEmail → verifyPassword (PBKDF2)
  │   → createSession → Set-Cookie
  │   → Ответ 200 → window.location.href = "/"
  │
  └── Демо-вход: POST /api/auth/demo
      → createGuestUser (nickname = "Гость_" + random4)
      → createSession → Set-Cookie
      → Ответ 200 → window.location.href = "/"
```

### 3.2 Ключевое исправление auth-form.tsx

```typescript
// ❌ БЫЛО (race condition):
await fetch("/api/auth/login", ...);
router.push("/");
router.refresh();   // конфликтует с навигацией

// ✅ СТАЛО (полный переход, cookie точно закрепляется):
const res = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (res.ok) {
  window.location.href = "/";  // браузер перечитывает cookie
}
```

### 3.3 Проверка сессии (lib/auth.ts)

```typescript
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const check = pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
  return timingSafeEqual(Buffer.from(hash), Buffer.from(check));
}

export function createSession(payload: SessionPayload): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL });
  const sig = createHmac("sha256", AUTH_SECRET).update(data).digest("hex");
  return Buffer.from(`${data}.${sig}`).toString("base64url");
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    const data = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = createHmac("sha256", AUTH_SECRET).update(data).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(data) as SessionPayload & { exp: number };
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
```

### 3.4 Middleware (middleware.ts)

```typescript
// Создать в корне проекта
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPaths = ["/game", "/decks", "/characters", "/profile"];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));

  if (isProtected) {
    const session = request.cookies.get("session")?.value;
    const payload = session ? verifySession(session) : null;
    if (!payload) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

## 4. ИГРОВОЙ ДВИЖОК

### 4.1 Типы (lib/game/types.ts)

```typescript
export type GamePhase =
  | "energy_recovery"
  | "card_draw"
  | "ability"
  | "battle"
  | "end_turn";

export type MatchStatus = "waiting" | "in_progress" | "finished";

export type EffectType =
  | "block"
  | "distraction"
  | "invulnerability"
  | "strength_up"
  | "energy_steal"
  | "armor_ignore"
  | "heal"
  | "propaganda"      // Новый: снижает accuracy карт противника
  | "sanction";       // Новый: блокирует восстановление энергии на ход

export interface ActiveEffect {
  type: EffectType;
  value: number;
  duration: number;   // ходов
  source: string;     // cardId
}

export interface FormStats {
  number: 1 | 2 | 3;
  name: string;
  maxHp: number;
  armor: number;
  maxEnergy: number;
  strength: number;
  speed: number;
  charges: number;
}

export interface MatchPlayer {
  id: string;
  nickname: string;
  characterId: string;
  currentForm: 1 | 2 | 3;
  hp: number;
  maxHp: number;
  armor: number;
  energy: number;
  maxEnergy: number;
  strength: number;
  speed: number;
  charges: number;
  hand: AbilityCard[];
  deck: AbilityCard[];
  discardPile: AbilityCard[];
  activeEffects: ActiveEffect[];
  isAi: boolean;
}

export interface PlayedCard {
  playerId: string;
  playerNum: 1 | 2;
  card: AbilityCard;
}

export interface TurnRecord {
  turn: number;
  player1Cards: string[];
  player2Cards: string[];
  damageDealt: { to1: number; to2: number };
  events: string[];
}

export interface Match {
  id: string;
  player1: MatchPlayer;
  player2: MatchPlayer;
  currentTurn: number;
  currentPlayer: 1 | 2;
  phase: GamePhase;
  turnHistory: TurnRecord[];
  status: MatchStatus;
  winner: 1 | 2 | null;
  pendingActions: Record<1 | 2, string[] | null>;  // cardIds
  abilityPhaseCards: PlayedCard[];
  turnDeadline: string;  // ISO timestamp
  createdAt: string;
}
```

### 4.2 Характеристики форм (lib/game/types.ts)

```typescript
export const FORM_STATS: Record<string, FormStats[]> = {
  "donald-rumpf": [
    { number: 1, name: "Кандидат",    maxHp: 100, armor: 25, maxEnergy: 4, strength: 7,  speed: 5, charges: 3 },
    { number: 2, name: "Президент",   maxHp: 130, armor: 30, maxEnergy: 5, strength: 9,  speed: 6, charges: 4 },
    { number: 3, name: "Феникс MAGA", maxHp: 160, armor: 35, maxEnergy: 6, strength: 12, speed: 7, charges: 5 },
  ],
  "vladimir-pu": [
    { number: 1, name: "Премьер",  maxHp: 130, armor: 35, maxEnergy: 3, strength: 8,  speed: 3, charges: 4 },
    { number: 2, name: "Лидер",    maxHp: 160, armor: 40, maxEnergy: 4, strength: 10, speed: 4, charges: 5 },
    { number: 3, name: "Медведь",  maxHp: 200, armor: 45, maxEnergy: 5, strength: 13, speed: 5, charges: 6 },
  ],
  "jin-shi": [
    { number: 1, name: "Секретарь",        maxHp: 120, armor: 30, maxEnergy: 3, strength: 7,  speed: 4, charges: 3 },
    { number: 2, name: "Председатель",     maxHp: 155, armor: 38, maxEnergy: 4, strength: 10, speed: 4, charges: 4 },
    { number: 3, name: "Вечный Дракон",    maxHp: 195, armor: 48, maxEnergy: 5, strength: 14, speed: 4, charges: 6 },
  ],
  "vlado-zelenko": [
    { number: 1, name: "Комик",        maxHp: 90,  armor: 20, maxEnergy: 5, strength: 6,  speed: 8, charges: 3 },
    { number: 2, name: "Президент",    maxHp: 115, armor: 25, maxEnergy: 6, strength: 8,  speed: 9, charges: 4 },
    { number: 3, name: "Легенда ВСУ",  maxHp: 145, armor: 30, maxEnergy: 7, strength: 11, speed: 10, charges: 5 },
  ],
};
```

### 4.3 Пять фаз хода (lib/game/engine.ts)

```typescript
export async function processTurn(match: Match): Promise<Match> {
  // Фаза 1: Восстановление энергии
  match = applyEnergyRecovery(match);       // +2 энергии; пассивки на чётных ходах
  match.phase = "card_draw";

  // Фаза 2: Добор карт
  match = drawCards(match, 2);              // +2 карты каждому
  match.phase = "ability";

  // Фаза 3: Фаза способностей
  // (ожидание действий обоих игроков — обрабатывается через pendingActions)
  // После получения обоих действий:
  match = resolveAbilityPhase(match);       // сортировка по speed DESC
  match.phase = "battle";

  // Фаза 4: Битва
  match = resolveBattle(match);             // урон, броня, эффекты, трансформации
  match.phase = "end_turn";

  // Фаза 5: Конец хода
  match = tickEffects(match);               // duration-- для ActiveEffect
  match = checkWinner(match);              // hp ≤ 0 на форме 3 → победа
  match = resetTurn(match);                // сброс pendingActions, phase → energy_recovery
  match.currentTurn++;

  return match;
}

function applyFormTransformation(player: MatchPlayer): MatchPlayer {
  if (player.hp <= 0 && player.currentForm < 3) {
    const nextForm = FORM_STATS[player.characterId][player.currentForm]; // 0-indexed
    return {
      ...player,
      currentForm: (player.currentForm + 1) as 2 | 3,
      hp: Math.floor(nextForm.maxHp * 0.5),  // трансформация с 50% HP
      maxHp: nextForm.maxHp,
      armor: nextForm.armor,
      maxEnergy: nextForm.maxEnergy,
      strength: nextForm.strength,
      speed: nextForm.speed,
      charges: nextForm.charges,
    };
  }
  return player;
}
```

### 4.4 Пассивные способности

```typescript
// В applyEnergyRecovery, каждые 2 хода:
function applyPassiveAbility(player: MatchPlayer, turn: number): MatchPlayer {
  if (turn % 2 !== 0) return player;

  switch (player.characterId) {
    case "donald-rumpf":
      // Торговая сделка: +2 энергии
      return { ...player, energy: Math.min(player.energy + 2, player.maxEnergy) };

    case "vladimir-pu":
      // Вертикаль власти: -20% к следующему входящему урону (через ActiveEffect)
      return addEffect(player, { type: "block", value: 0.2, duration: 1, source: "passive-pu" });

    case "jin-shi":
      // Народный консенсус: +1 карта из сброса в руку
      return recycleFromDiscard(player, 1);

    case "vlado-zelenko":
      // Поддержка союзников: +3 к скорости следующей карты
      return addEffect(player, { type: "strength_up", value: 3, duration: 1, source: "passive-zelenko" });

    default:
      return player;
  }
}
```

### 4.5 ИИ-бот (lib/game/ai.ts)

```typescript
export function makeAiDecision(match: Match, playerNum: 1 | 2): string[] {
  const player = playerNum === 1 ? match.player1 : match.player2;
  const opponent = playerNum === 1 ? match.player2 : match.player1;

  const affordable = player.hand.filter(c => c.cost <= player.energy);
  if (affordable.length === 0) return [];

  // Приоритет: low HP → защита; high HP → атака
  const hpRatio = player.hp / player.maxHp;
  if (hpRatio < 0.3) {
    const defensive = affordable.filter(c =>
      c.effect.includes("блок") || c.effect.includes("броня") || c.effect.includes("лечит")
    );
    if (defensive.length > 0) return [defensive[0].id];
  }

  // Выбрать карту с максимальной ценностью (урон / стоимость)
  const scored = affordable.map(c => ({
    id: c.id,
    score: parseEffectValue(c.effect) / Math.max(c.cost, 1),
  }));
  scored.sort((a, b) => b.score - a.score);

  return [scored[0].id];
}
```

---

## 5. WEBSOCKET И МУЛЬТИПЛЕЕР

### 5.1 Разделение портов (исправленная архитектура)

```
Next.js (порт 3000)  ←→  Браузер
WS-сервер (порт 3001) ←→  Браузер

Переменные окружения:
NEXT_PUBLIC_WS_URL=ws://localhost:3001      # dev
NEXT_PUBLIC_WS_URL=wss://ws.domain.com     # production
```

> Это исключает конфликт HMR в dev-режиме. Next.js и WS работают как независимые процессы.

### 5.2 WS-сервер (server/index.ts)

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { handleMessage } from "./handlers";
import { connectionManager } from "../lib/ws/connection";

const PORT = parseInt(process.env.WS_PORT ?? "3001");
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket, req) => {
  const connectionId = connectionManager.register(ws);
  console.log(`[WS] connected: ${connectionId}`);

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(connectionId, message, ws);
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", payload: { error: "Invalid message" } }));
    }
  });

  ws.on("close", () => {
    connectionManager.unregister(connectionId);
  });
});

console.log(`[WS] server running on port ${PORT}`);
```

### 5.3 WS-протокол

**Клиент → Сервер:**

```typescript
type ClientMessage =
  | { type: "auth";              payload: { token: string } }
  | { type: "find_match";        payload: { nickname: string; characterId: string } }
  | { type: "cancel_matchmaking" }
  | { type: "create_lobby";      payload: { nickname: string; characterId: string } }
  | { type: "join_lobby";        payload: { code: string; nickname: string; characterId: string } }
  | { type: "leave_lobby";       payload: { code: string } }
  | { type: "play_cards";        payload: { matchId: string; cardIds: string[] } }
  | { type: "skip_turn";         payload: { matchId: string } };
```

**Сервер → Клиент:**

```typescript
type ServerMessage =
  | { type: "auth_ok";       payload: { userId: string; nickname: string } }
  | { type: "auth_error";    payload: { error: string } }
  | { type: "queue_joined";  payload: { position: number } }
  | { type: "lobby_created"; payload: { code: string } }
  | { type: "lobby_ready";   payload: { opponentNickname: string } }
  | { type: "game_started";  payload: { matchId: string; playerNum: 1 | 2; state: Match } }
  | { type: "game_state";    payload: { matchId: string; playerNum: 1 | 2; state: Match } }
  | { type: "game_over";     payload: { winner: 1 | 2; stats: TurnRecord[] } }
  | { type: "opponent_left"; payload: { matchId: string } }
  | { type: "error";         payload: { error: string } };
```

### 5.4 Матчмейкинг (lib/ws/matchmaking.ts)

```typescript
interface QueueEntry {
  connectionId: string;
  userId: string;
  nickname: string;
  characterId: string;
  joinedAt: number;
}

const queue = new Map<string, QueueEntry>();

export function joinQueue(entry: QueueEntry): void {
  queue.set(entry.userId, entry);
  tryMatchPlayers();
}

function tryMatchPlayers(): void {
  if (queue.size < 2) return;
  const [p1, p2] = [...queue.values()].slice(0, 2);
  queue.delete(p1.userId);
  queue.delete(p2.userId);

  const match = createMultiplayerMatch(
    p1.userId, p1.nickname, p1.characterId,
    p2.userId, p2.nickname, p2.characterId
  );
  notifyMatchStart(p1, p2, match);
}
```

### 5.5 Лобби (lib/ws/lobby.ts)

```typescript
// 6-символьный код: A-Z0-9 (без 0/O и 1/I для читаемости)
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

interface Lobby {
  code: string;
  host: LobbyPlayer;
  guest: LobbyPlayer | null;
  createdAt: number;
}

const lobbies = new Map<string, Lobby>();
const LOBBY_TTL = 10 * 60 * 1000; // 10 минут
```

### 5.6 Клиентский хелпер (lib/ws/client.ts)

```typescript
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export class GameWsClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, ((payload: unknown) => void)[]>();

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => {
        this.send({ type: "auth", payload: { token } });
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "auth_ok") resolve();
        if (msg.type === "auth_error") reject(new Error(msg.payload.error));
        this.emit(msg.type, msg.payload);
      };
      this.ws.onerror = reject;
    });
  }

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type: string, handler: (payload: unknown) => void): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(handler);
    return () => {
      const arr = this.listeners.get(type)!;
      arr.splice(arr.indexOf(handler), 1);
    };
  }

  private emit(type: string, payload: unknown): void {
    this.listeners.get(type)?.forEach(h => h(payload));
  }

  disconnect(): void { this.ws?.close(); }
}
```

---

## 6. БАЗА ДАННЫХ

### 6.1 Схема таблиц (lib/schema.ts)

```typescript
// Таблица: world-order-users
// PK: userId (S)
// GSI: email-index → email (S)
export interface UserRecord {
  userId: string;
  email: string;
  nickname: string;
  passwordHash: string;
  isGuest: boolean;
  rating: number;          // ELO, начало 1000
  wins: number;
  losses: number;
  level: number;
  xp: number;
  createdAt: string;
  updatedAt: string;
}

// Таблица: world-order-matches
// PK: matchId (S)
// GSI: status-createdAt-index → status + createdAt
export interface MatchRecord {
  matchId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: MatchStatus;
  characterP1: string;
  characterP2: string;
  turnsPlayed: number;
  startedAt: string;
  finishedAt: string | null;
}

// Таблица: world-order-decks
// PK: deckId (S)
// GSI: userId-index → userId (S)
export interface DeckRecord {
  deckId: string;
  userId: string;
  name: string;
  characterId: string;
  cardIds: string[];       // массив id карт, 20-30 штук
  isValid: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 DynamoDB клиент (lib/db.ts)

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ru-central1",
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = {
  USERS:   "world-order-users",
  MATCHES: "world-order-matches",
  DECKS:   "world-order-decks",
} as const;
```

### 6.3 Миграция (scripts/migrate.ts)

```typescript
// Запуск: docker compose exec app npx tsx scripts/migrate.ts
import { CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { client } from "../lib/db";

const tables = [
  {
    TableName: "world-order-users",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "email",  AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [{
      IndexName: "email-index",
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    }],
  },
  {
    TableName: "world-order-matches",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "matchId",   AttributeType: "S" },
      { AttributeName: "status",    AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "matchId", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [{
      IndexName: "status-createdAt-index",
      KeySchema: [
        { AttributeName: "status",    KeyType: "HASH" },
        { AttributeName: "createdAt", KeyType: "RANGE" },
      ],
      Projection: { ProjectionType: "ALL" },
    }],
  },
  {
    TableName: "world-order-decks",
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "deckId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
    ],
    KeySchema: [{ AttributeName: "deckId", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [{
      IndexName: "userId-index",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" },
    }],
  },
];

for (const table of tables) {
  await client.send(new CreateTableCommand(table));
  console.log(`✓ ${table.TableName}`);
}
```

---

## 7. ПЕРСОНАЖИ

### 7.1 Структуры данных (lib/data.ts)

```typescript
export interface AbilityCard {
  id: string;
  name: string;
  cost: number;          // 0–6 энергии
  speed: number;         // 0–3 (приоритет в фазе битвы)
  effect: string;        // машиночитаемое описание ("damage:30 armor_ignore")
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;   // человекочитаемое описание
  type: "passive" | "active" | "ultimate";
  flavorText?: string;   // цитата или комментарий
}

export interface Character {
  id: string;
  name: string;
  country: string;
  countryCode: string;   // "us" | "ru" | "cn" | "ua"
  countryAccent: "blue" | "red" | "crimson" | "gold";
  description: string;
  quote: string;
  stats: FormStats;      // Начальная форма
  forms: string[];       // Названия форм
  passiveAbility: string;
  passiveDescription: string;
  abilityCards: AbilityCard[];
}
```

---

### 7.2 Дональд Рампф (США) 🇺🇸

```
id: "donald-rumpf"
Прообраз: Дональд Трамп
Страна: США · Акцент: Синий
Стиль: Агрессия, медийный хаос, экономическое давление
Пассивка: Торговая сделка — каждый чётный ход +2 энергии
Формы: Кандидат → Президент → Феникс MAGA
Цитата: «Я сделаю мир снова великим. Поверьте мне, поверьте.»
```

**20 карт:**

| ID | Название | Стоимость | Скорость | Редкость | Тип | Эффект |
|----|----------|-----------|----------|----------|-----|--------|
| dr-tweet | Твит-шторм | 1 | 3 | common | active | Рассеивает внимание: -1 к скорости след. карты противника |
| dr-wall | Великая стена | 2 | 1 | common | active | Блокирует 30 ед. урона на этот ход |
| dr-tariff | Тариф на импорт | 2 | 2 | common | active | Наносит 20 ед. урона, блокирует +1 энергии врагу в след. ходу |
| dr-rally | Митинг MAGA | 1 | 2 | common | active | +1 энергии, вернуть 1 карту из сброса |
| dr-deal | Искусство сделки | 0 | 1 | common | passive | Следующий ход: стоимость карт -1 |
| dr-fake-news | Фейк-ньюс | 2 | 3 | common | active | Снижает броню противника на 10 до конца хода |
| dr-ban | Президентский бан | 3 | 1 | rare | active | Блокирует одну карту противника в руке (случайно) |
| dr-sanctions | Пакет санкций | 3 | 2 | rare | active | 25 ед. урона + блокировка восстановления энергии врага |
| dr-media | Медиашторм | 2 | 3 | rare | active | +2 к скорости следующей карты, +1 карта в руку |
| dr-golf | Игра в гольф | 0 | 0 | rare | passive | Восстанавливает 15 HP |
| dr-executive | Указ президента | 4 | 1 | epic | active | 40 ед. урона, игнорирует броню |
| dr-trade-war | Торговая война | 4 | 2 | epic | active | 30 ед. урона + steal 2 энергии у противника |
| dr-veto | Право вето | 3 | 1 | epic | active | Неуязвимость на 1 фазу (эффект invulnerability) |
| dr-fire | Вы уволены! | 3 | 3 | epic | active | Отменяет последнюю сыгранную карту противника |
| dr-maga-hat | Красная кепка | 2 | 2 | rare | active | +5 к силе на 2 хода |
| dr-twitter-ban | Бан Твиттера | 5 | 1 | legendary | active | 50 ед. урона + противник пропускает фазу способностей |
| dr-wall-2 | Мексиканская стена | 4 | 0 | rare | active | Блокирует 50 ед. урона, действует 2 хода |
| dr-nuclear | Большая кнопка | 6 | 0 | legendary | ultimate | 80 ед. урона, игнорирует броню и эффекты защиты |
| dr-maga-phoenix | Возрождение MAGA | 5 | 1 | legendary | ultimate | Восстанавливает 40 HP + +3 энергии немедленно |
| dr-impeach | Импичмент... снова? | 3 | 2 | epic | active | Снижает HP противника до 50% текущего значения (мин. 1) |

---

### 7.3 Владимир Пу (Россия) 🇷🇺

```
id: "vladimir-pu"
Прообраз: Владимир Путин
Страна: Россия · Акцент: Красный
Стиль: Контроль, дезинформация, жёсткая защита
Пассивка: Вертикаль власти — каждый чётный ход -20% входящего урона
Формы: Премьер → Лидер → Медведь
Цитата: «Россия не блефует. Россия никогда не блефует.»
```

**20 карт:**

| ID | Название | Стоимость | Скорость | Редкость | Тип | Эффект |
|----|----------|-----------|----------|----------|-----|--------|
| vp-hybrid | Гибридная война | 2 | 3 | common | active | Наносит 15 ед. урона + пропаганда на 1 ход |
| vp-gas | Газовый рычаг | 2 | 1 | common | active | Блокирует +1 энергии у противника на 2 хода |
| vp-judo | Дзюдо-бросок | 1 | 3 | common | active | 10 ед. урона, +2 к скорости в этом ходу |
| vp-bunker | Бункер | 2 | 0 | common | active | Блокирует 35 ед. урона на этот ход |
| vp-disinfo | Дезинформация | 1 | 2 | common | active | Снижает точность след. карты врага (50% chance miss) |
| vp-siloviki | Силовики | 3 | 1 | common | active | 20 ед. урона + +10 к броне на 1 ход |
| vp-pipeline | Трубопровод | 3 | 1 | rare | active | Восстанавливает 2 энергии + 10 HP |
| vp-oligarch | Олигарх | 2 | 2 | rare | active | Steal 1 карту из руки противника (случайно) |
| vp-nuke-hint | Намёк на ядерку | 4 | 0 | rare | active | Блокирует любую карту с уроном >30 в этом ходу |
| vp-tass | Официальная версия | 2 | 3 | rare | active | Отменяет один активный эффект у противника |
| vp-bear | Медвежья хватка | 4 | 1 | epic | active | 45 ед. урона |
| vp-nerve | Нервный агент | 5 | 2 | epic | active | 35 ед. урона + яд: -10 HP врагу в теч. 2 ходов |
| vp-fortress | Крепость | 4 | 0 | epic | active | Неуязвимость 1 ход + +15 HP |
| vp-special-op | Спецоперация | 5 | 1 | epic | active | 55 ед. урона, игнорирует броню |
| vp-fsb | Сигнал ФСБ | 3 | 3 | rare | active | Противник не может разыграть карты стоимостью >3 в след. ход |
| vp-sputnik | Спутник-5 | 3 | 2 | rare | active | Восстанавливает 25 HP |
| vp-cyber | Кибератака | 4 | 3 | epic | active | Сбрасывает 2 случайные карты из руки противника |
| vp-sovereign | Суверенная ядерка | 6 | 0 | legendary | ultimate | 90 ед. урона, игнорирует все защитные эффекты |
| vp-eternal | Вечный президент | 5 | 1 | legendary | ultimate | +50 HP, +2 энергии, +10 к броне навсегда (до трансформации) |
| vp-bearmode | Режим медведя | 5 | 2 | legendary | ultimate | Следующие 2 хода все карты противника стоят +2 энергии |

---

### 7.4 Джин Ши (Китай) 🇨🇳

```
id: "jin-shi"
Прообраз: Си Цзиньпин
Страна: Китай · Акцент: Crimson (тёмно-красный)
Стиль: Долгосрочная стратегия, экономическая экспансия, самовоспроизводство ресурсов
Пассивка: Народный консенсус — каждый чётный ход возвращает 1 случайную карту из сброса в руку
Формы: Секретарь → Председатель → Вечный Дракон
Цитата: «Сила Китая — это сила миллиарда голосов. И все они говорят то же, что и я.»
Флавор: Спокойный, расчётливый, предпочитает долгосрочное давление мгновенным ударам. 
         Специализируется на контроле ресурсов и накоплении.
```

**20 карт:**

| ID | Название | Стоимость | Скорость | Редкость | Тип | Эффект |
|----|----------|-----------|----------|----------|-----|--------|
| js-belt | Один пояс | 1 | 1 | common | active | +2 энергии следующий ход |
| js-road | Один путь | 1 | 1 | common | active | +1 карта в руку, +1 карта в след. ходу |
| js-factory | Мировая фабрика | 2 | 0 | common | active | Снижает стоимость след. карты на 2 |
| js-censor | Великий файервол | 2 | 1 | common | active | Блокирует все карты типа "информация" у врага (1 ход) |
| js-panda | Дипломатия панды | 1 | 2 | common | passive | Heal 10 HP + снизить силу следующей атаки врага на 5 |
| js-five-year | Пятилетний план | 0 | 0 | common | passive | На 5 ходов: каждый ход +1 доп. карта в руку |
| js-yuan | Курс юаня | 3 | 2 | rare | active | Steal 2 энергии у противника |
| js-social | Социальный рейтинг | 3 | 1 | rare | active | Противник пропускает разыгрывание 1 карты в след. ход |
| js-tech | Технологический шпионаж | 2 | 3 | rare | active | Копирует эффект последней карты противника |
| js-army | НОАК | 4 | 2 | rare | active | 30 ед. урона |
| js-xi-thought | Мысль Ши | 3 | 1 | rare | active | +3 энергии, следующая карта бесплатна |
| js-tariff-back | Контртарифы | 3 | 2 | rare | active | Отражает 50% урона следующей атаки врага |
| js-dragon | Пробуждение дракона | 5 | 1 | epic | active | 50 ед. урона |
| js-bri | Инициатива пояса | 4 | 0 | epic | active | +3 энергии + Heal 20 HP |
| js-propaganda | Пропаганда CCTV | 4 | 2 | epic | active | Все карты противника в руке теряют по 1 к скорости |
| js-censure | Внутренняя критика | 3 | 3 | epic | active | Сбрасывает 1 случайную карту врага |
| js-emperor | Новый Сын Неба | 5 | 1 | legendary | ultimate | Heal 60 HP + +4 энергии немедленно |
| js-eternal-rule | Пожизненный мандат | 6 | 0 | legendary | ultimate | 75 ед. урона + противник не восстанавливает энергию 2 хода |
| js-century | Век унижений прошёл | 5 | 2 | legendary | ultimate | Все активные эффекты врага отменяются + 40 ед. урона |
| js-dragon-fire | Огонь дракона | 6 | 1 | legendary | ultimate | 65 ед. урона, игнорирует броню + копирует один эффект врага |

---

### 7.5 Владо Зеленко (Украина) 🇺🇦

```
id: "vlado-zelenko"
Прообраз: Владимир Зеленский
Страна: Украина · Акцент: Gold (жёлто-синий)
Стиль: Высокая скорость, мобильность, медийная привлекательность, поддержка союзников
Пассивка: Поддержка союзников — каждый чётный ход +3 к скорости следующей карты
Формы: Комик → Президент → Легенда ВСУ
Цитата: «Мне нужны не такси — мне нужны боеприпасы.»
Флавор: Самый быстрый персонаж в игре. Слабее в защите, но превосходит всех 
         по скорости и медийному влиянию. Хорошо работает с комбо быстрых карт.
```

**20 карт:**

| ID | Название | Стоимость | Скорость | Редкость | Тип | Эффект |
|----|----------|-----------|----------|----------|-----|--------|
| vz-speech | Речь к Конгрессу | 1 | 3 | common | active | +2 к скорости следующей карты, нарратив: +1 карта |
| vz-green | Зелёная футболка | 0 | 2 | common | passive | Heal 8 HP — легендарная броня народного президента |
| vz-drone | FPV-дрон | 2 | 3 | common | active | 18 ед. урона, игнорирует броню |
| vz-javelin | Джавелин | 3 | 2 | common | active | 30 ед. урона |
| vz-comedian | Стенд-ап | 1 | 3 | common | active | Снижает скорость след. карты врага на 2 |
| vz-resilience | Мы не сдамся | 0 | 1 | common | passive | При HP <30% — получить +2 энергии |
| vz-nato | Зов в НАТО | 2 | 2 | rare | active | +15 HP + +1 к броне на 2 хода |
| vz-himars | HIMARS | 4 | 2 | rare | active | 35 ед. урона, точный удар — игнорирует блок |
| vz-selfie | Фронтовое селфи | 2 | 3 | rare | active | Копирует эффект следующей карты (сыграть как бонус) |
| vz-press | Брифинг для прессы | 2 | 3 | rare | active | Противник теряет 2 к скорости всех карт в этом ходу |
| vz-macro | Гарантии безопасности | 3 | 1 | rare | active | Неуязвимость на половину хода (block: 40) |
| vz-cluster | Кассетные боеприпасы | 4 | 2 | rare | active | 25 ед. урона × 2 (двойное применение, -5 каждый) |
| vz-counteroffensive | Контрнаступ | 5 | 2 | epic | active | 45 ед. урона + снизить броню врага на 15 |
| vz-bradley | Бредли | 4 | 2 | epic | active | 35 ед. урона + steal 1 энергии |
| vz-azov | Азовсталь | 4 | 1 | epic | active | Блокирует 55 ед. урона, действует 1 ход |
| vz-zelensky-on-air | В прямом эфире | 3 | 3 | epic | active | Обнуляет все активные эффекты врага |
| vz-slava | Слава Україні! | 5 | 3 | legendary | ultimate | +5 к скорости всех карт в руке на 2 хода + 20 ед. урона |
| vz-iron-resolve | Железная воля | 5 | 1 | legendary | ultimate | Heal 50 HP + следующий удар по тебе не убивает (остаётся 1 HP) |
| vz-trident | Трезубец | 6 | 1 | legendary | ultimate | 70 ед. урона, игнорирует все эффекты + +30 HP |
| vz-freedom | Воля к победе | 6 | 3 | legendary | ultimate | Все твои карты в этом ходу стоят 0 + скорость +3 ко всем |

---

## 8. API ЭНДПОИНТЫ

### 8.1 Аутентификация

| Метод | URL | Тело запроса | Ответ |
|-------|-----|-------------|-------|
| POST | `/api/auth/register` | `{ email, password, nickname }` | `{ user: UserPublic }` 201 |
| POST | `/api/auth/login` | `{ email, password }` | `{ user: UserPublic }` 200 |
| POST | `/api/auth/demo` | — | `{ user: UserPublic }` 200 |
| POST | `/api/auth/logout` | — | `{ ok: true }` 200 |
| GET | `/api/auth/me` | — | `{ user: UserPublic \| null }` |

```typescript
// Публичный профиль (без passwordHash)
interface UserPublic {
  userId: string;
  nickname: string;
  email: string;
  rating: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  isGuest: boolean;
}
```

### 8.2 Игра

| Метод | URL | Тело / Параметры | Ответ |
|-------|-----|-----------------|-------|
| POST | `/api/game` | `{ playerId, playerNickname, characterId, vsAi: bool }` | `{ match: Match }` 201 |
| GET | `/api/game/[id]` | — | `{ match: Match }` 200 |
| POST | `/api/game/[id]` | `{ playerId, cardIds: string[] }` | `{ match: Match }` 200 |

### 8.3 Колоды

| Метод | URL | Тело | Ответ |
|-------|-----|------|-------|
| GET | `/api/decks` | — | `{ decks: DeckRecord[] }` 200 |
| POST | `/api/decks` | `{ name, characterId, cardIds }` | `{ deck: DeckRecord }` 201 |
| PUT | `/api/decks/[id]` | `{ name?, cardIds? }` | `{ deck: DeckRecord }` 200 |
| DELETE | `/api/decks/[id]` | — | `{ ok: true }` 200 |

### 8.4 Health

| Метод | URL | Ответ |
|-------|-----|-------|
| GET | `/api/health` | `{ status: "ok", ts: number }` 200 |

---

## 9. КОНФИГУРАЦИЯ И ДЕПЛОЙ

### 9.1 Переменные окружения (.env.local / .env.docker)

```env
# Общие
NODE_ENV=production
AUTH_SECRET=<random-32-byte-hex>

# Next.js
PORT=3000
NEXT_PUBLIC_WS_URL=wss://ws.yourdomain.com

# WS-сервер
WS_PORT=3001

# AWS / Yandex DynamoDB
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=ru-central1
DYNAMODB_ENDPOINT=http://dynamodb-local:8000   # dev
# DYNAMODB_ENDPOINT не нужен для prod Yandex Cloud
```

### 9.2 docker-compose.yml (исправленный, раздельные серверы)

```yaml
version: "3.9"
services:
  dynamodb-local:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"
    command: "-jar DynamoDBLocal.jar -inMemory -sharedDb"
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:8000/shell/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  app-next:
    build:
      context: .
      target: runner
    command: node .next/standalone/server.js
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEXT_PUBLIC_WS_URL=ws://localhost:3001
    env_file: .env.docker
    depends_on:
      dynamodb-local:
        condition: service_healthy

  app-ws:
    build:
      context: .
      target: runner
    command: node dist/server/index.js
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WS_PORT=3001
    env_file: .env.docker
    depends_on:
      dynamodb-local:
        condition: service_healthy
      app-next:
        condition: service_started
```

### 9.3 next.config.ts (исправленный CSP)

```typescript
import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self'
    ws://localhost:3001
    wss://*.yourdomain.com
    https://*.yourdomain.com;
`.replace(/\n/g, " ").trim();

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 9.4 Команды разработки

```bash
# Первый запуск
npm install
npx shadcn@latest init
npx shadcn@latest add button card input skeleton avatar dropdown-menu

# Dev-режим (два терминала)
npm run dev          # Next.js на :3000
npm run dev:ws       # WS-сервер на :3001: npx tsx server/index.ts

# Или через concurrently:
npm run dev:all      # "concurrently \"npm run dev\" \"npm run dev:ws\""

# Сборка
npm run build
npm run start

# Типизация и линт
npm run typecheck    # tsc --noEmit
npm run lint         # eslint

# Миграция БД (с запущенным Docker)
docker compose up dynamodb-local -d
npx tsx scripts/migrate.ts

# Перезапуск контейнеров
docker compose up -d --force-recreate
docker compose ps
docker compose logs -f app-ws
```

### 9.5 package.json (ключевые скрипты)

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "dev:ws": "tsx watch server/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:ws\"",
    "build": "next build && tsc -p tsconfig.server.json",
    "start": "node .next/standalone/server.js",
    "start:ws": "node dist/server/index.js",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "db:migrate": "npx tsx scripts/migrate.ts",
    "db:seed": "npx tsx scripts/seed.ts"
  }
}
```

---

## 10. ИЗВЕСТНЫЕ ПРОБЛЕМЫ И ФИКСЫ

### 10.1 Race condition сессии после входа

**Симптом:** После логина редирект на `/`, но меню показывает "Войти".

**Причина:** `router.push()` + `router.refresh()` создают race condition — Next.js RSC-рефреш конфликтует с навигацией, cookie не успевает закрепиться.

**Фикс:**
```typescript
// auth-form.tsx
// ❌ Убрать:
router.push("/");
router.refresh();

// ✅ Заменить на:
window.location.href = "/";  // полный reload страницы
```

### 10.2 WebSocket HMR-конфликт в dev-режиме

**Симптом:** `WebSocket connection to '.../_next/webpack-hmr' failed`

**Причина:** Единый порт 8080 — кастомный сервер перехватывал upgrade-запросы HMR.

**Фикс:** Раздельные порты — Next.js на 3000, WS на 3001 (см. раздел 9.2). В dev-режиме запускать двумя командами или через `concurrently`.

### 10.3 CSP-ошибки браузерных расширений

**Симптом:** `Connecting to 'wss://mc.yandex.ru/solid.ws' violates CSP`

**Причина:** Расширения браузера пытаются подключиться к своим серверам.

**Статус:** Не влияет на работу приложения. Игнорировать.

### 10.4 Потеря матчей при перезапуске WS-сервера

**Причина:** `lib/game/store.ts` хранит матчи в `Map` (in-memory).

**Текущее поведение:** При перезапуске `app-ws` все активные матчи теряются.

**Приемлемо для MVP.** Для prod-решения: сериализовать состояние матча в DynamoDB после каждого хода (уже есть `MatchRecord`), десериализовать при реконнекте.

### 10.5 Колоды в localStorage → DynamoDB

**Фикс:** Раскомментировать или реализовать `/api/decks` (см. раздел 8.3), в `deck-builder.tsx` заменить:
```typescript
// ❌ localStorage.setItem("decks", JSON.stringify(decks))
// ✅
await fetch("/api/decks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, characterId, cardIds }),
});
```

---

## 11. ИНСТРУКЦИИ ДЛЯ CURSOR

### 11.1 Порядок реализации (рекомендуемый)

```
Этап 1 — Каркас (1-2 дня)
  □ Инициализация проекта с правильными версиями
  □ Настройка shadcn/ui, Tailwind, DynamoDB-клиента
  □ Миграция таблиц
  □ Аутентификация (register/login/logout/me + middleware)
  □ Главная страница (лендинг + меню)

Этап 2 — Движок (2-3 дня)
  □ lib/game/types.ts — все типы + FORM_STATS для 4 персонажей
  □ lib/data.ts — персонажи и карты
  □ lib/game/engine.ts — 5 фаз
  □ lib/game/effects.ts — эффекты
  □ lib/game/ai.ts — бот
  □ /api/game/route.ts + /api/game/[id]/route.ts

Этап 3 — UI (2 дня)
  □ character-gallery.tsx
  □ game-board.tsx (с ИИ)
  □ deck-builder.tsx → /api/decks
  □ profile-page.tsx

Этап 4 — Мультиплеер (2-3 дня)
  □ server/index.ts (WS на порту 3001)
  □ lib/ws/connection.ts
  □ lib/ws/matchmaking.ts
  □ lib/ws/lobby.ts
  □ game-multi-lobby.tsx
  □ Интеграция game-board.tsx с WS
```

### 11.2 Типичные Cursor-промпты

**Добавить нового персонажа:**
```
В lib/data.ts добавь персонажа jin-shi (Китай) по спецификации из ТЗ раздел 7.4.
В lib/game/types.ts добавь его FORM_STATS. Создай 20 карт AbilityCard с id, name,
cost, speed, effect, rarity, description. Добавь карты в mockCollection в lib/mock-data.ts.
```

**Создать WS-сервер:**
```
Создай server/index.ts — WebSocket-сервер на порту WS_PORT (default 3001).
Используй библиотеку ws. Импортируй connectionManager из lib/ws/connection.ts,
matchmaking из lib/ws/matchmaking.ts, lobby из lib/ws/lobby.ts.
Обрабатывай все типы ClientMessage из lib/ws/types.ts.
```

**Подключить колоды к БД:**
```
Создай app/api/decks/route.ts с GET (список колод авторизованного пользователя из DynamoDB)
и POST (создать колоду с валидацией zod: name string, characterId string, cardIds 20-30 штук).
В components/deck-builder.tsx замени все localStorage-вызовы на fetch к /api/decks.
```

**Исправить сессию:**
```
В components/auth-form.tsx найди все вызовы router.push("/") и router.refresh() после
успешного логина/регистрации/демо. Замени на window.location.href = "/".
Убедись, что нет других router.refresh() после auth-эндпоинтов.
```

### 11.3 Правила-запреты (не нарушать)

| Нельзя | Вместо этого |
|--------|-------------|
| Добавлять PostgreSQL/Redis | Только DynamoDB |
| Использовать MUI/Chakra/Ant Design | Только shadcn/ui + Tailwind |
| Добавлять emoji в компоненты | Только lucide-react иконки |
| Использовать `alert()` / `confirm()` | Только sonner (toast) |
| Удалять `/api/health/route.ts` | Обязателен для healthcheck |
| Трогать `bridge-provider.tsx`, `inspector-overlay.tsx` | Инфраструктура, не трогать |
| Запускать `next dev` в Docker | Только `npm run build && npm run start` |
| Хранить матчи в DynamoDB в реалтайме | In-memory store, только результат в БД |

### 11.4 Полезные проверки

```bash
# Проверить что cookie выставляется корректно
curl -c cookies.txt -X POST http://localhost:3000/api/auth/demo
curl -b cookies.txt http://localhost:3000/api/auth/me

# Проверить WS-подключение
wscat -c ws://localhost:3001
> {"type":"auth","payload":{"token":"<session-cookie-value>"}}

# Проверить здоровье
curl http://localhost:3000/api/health

# Проверить таблицы DynamoDB
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region ru-central1
```

---

*Документ актуален для стека: Next.js 15 + TypeScript 5 + WS 8 + DynamoDB (Yandex Cloud)*
*Версия 2.0 — обновлено с учётом архитектурных исправлений (раздельные порты, window.location, корректные версии)*
