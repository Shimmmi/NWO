import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { buyBooster, ShopError } from "@/lib/shop/service";

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { skuId?: string; open?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.skuId || typeof body.skuId !== "string") {
    return NextResponse.json({ error: "unknown_sku" }, { status: 422 });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  try {
    const result = await buyBooster({
      userId: session.userId,
      skuId: body.skuId,
      open: body.open !== false,
      idempotencyKey,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ShopError) {
      const status =
        err.code === "insufficient_credits"
          ? 402
          : err.code === "unknown_sku"
            ? 422
            : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }
}
