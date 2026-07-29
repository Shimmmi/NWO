import { NextResponse } from "next/server";
import { kv } from "@/lib/redis/client";
import { snapshot } from "@/lib/redis/metrics-store";
import { queueSize } from "@/lib/redis/queue-store";

// Метрики считаются на каждый запрос, кеширование здесь бессмысленно.
export const dynamic = "force-dynamic";

/**
 * Локальные адреса. Всё, что пришло снаружи, получит 404 — именно 404, а не 403,
 * чтобы наружу не утекал факт существования эндпоинта.
 */
function isLocalAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  return (
    addr === "localhost" ||
    addr === "::1" ||
    addr === "127.0.0.1" ||
    /^127\./.test(addr)
  );
}

/**
 * Настоящего remote address в route handler-ах Next нет, поэтому опираемся на то,
 * что подставляет nginx: X-Forwarded-For (цепочка, первый элемент — клиент) и
 * X-Real-IP ($remote_addr). Запрос из интернета всегда принесёт хотя бы один
 * из этих заголовков с публичным адресом.
 *
 * Отсутствие обоих означает прямое обращение на 127.0.0.1:3000 в обход nginx —
 * порт опубликован только на loopback, так что это либо healthcheck, либо
 * curl с самого хоста.
 */
function isLocalRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  const candidates = [
    ...(forwarded?.split(",") ?? []),
    ...(realIp ? [realIp] : []),
  ].filter((ip) => ip.trim() !== "" && ip.trim().toLowerCase() !== "unknown");

  if (candidates.length === 0) return true;
  return candidates.every(isLocalAddress);
}

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const store = kv();

  // Счётчики пишет сокет-сервер, а читает этот роут: они в разных модульных
  // графах одного процесса, поэтому единственный общий канал — Redis.
  try {
    const [live, redisKeys] = await Promise.all([
      queueSize().then(snapshot),
      store.dbsize(),
    ]);

    return NextResponse.json({
      ...live,
      redis: {
        // kv() сам подменяет бэкенд на память, когда соединение не готово.
        status: store.backend() === "redis" ? "ready" : "memory",
        keys: redisKeys,
      },
    });
  } catch {
    // Метрики не повод отдавать 500: мониторинг увидит статус хранилища.
    return NextResponse.json(
      { error: "metrics_unavailable", redis: { status: "error", keys: 0 } },
      { status: 503 },
    );
  }
}
