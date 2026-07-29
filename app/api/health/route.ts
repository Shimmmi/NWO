import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { NextResponse } from "next/server";
import { dynamoClient, TABLE } from "@/lib/db";
import { isDegraded, kv } from "@/lib/redis/client";
import { K } from "@/lib/redis/keys";

// Здоровье считается на каждый запрос: статическая пререндеренная копия
// сообщала бы «ok» вечно, а на этот эндпоинт смотрит healthcheck компоуза.
export const dynamic = "force-dynamic";

/** Ждать ответа Dynamo дольше не имеет смысла: healthcheck компоуза сам с таймаутом. */
const DYNAMO_TIMEOUT_MS = 1500;

type CheckState = "ok" | "memory" | "error";

/**
 * Лёгкая проверка Dynamo: описание одной таблицы, без чтения данных.
 * Ошибка означает недоступность хранилища профилей и историю матчей, но не
 * ломает сами матчи — они живут в Redis, — поэтому статус не роняем.
 */
async function checkDynamo(): Promise<CheckState> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), DYNAMO_TIMEOUT_MS);
  try {
    await dynamoClient.send(
      new DescribeTableCommand({ TableName: TABLE.USERS }),
      { abortSignal: abort.signal },
    );
    return "ok";
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // Redis в режиме памяти — процесс жив, но состояние не переживёт рестарт
  // и не разделяется между репликами. Это именно degraded, а не ok.
  const redis: CheckState = isDegraded() ? "memory" : "ok";
  const [dynamodb, connections] = await Promise.all([
    checkDynamo(),
    readConnections(),
  ]);

  return NextResponse.json({
    status: redis === "ok" ? "ok" : "degraded",
    ts: Date.now(),
    checks: { redis, dynamodb },
    connections,
    uptimeSec: Math.floor(process.uptime()),
  });
}

/** Реестр сокетов живёт в другом модульном графе, поэтому счётчик берём из Redis. */
async function readConnections(): Promise<number> {
  try {
    return Number((await kv().get(K.gauge("conn.current"))) ?? 0) || 0;
  } catch {
    return 0;
  }
}
