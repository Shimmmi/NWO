import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { findUserByIdSafe } from "@/lib/models";
import { normalizeUser } from "@/lib/schema";
import { openPack, ShopError } from "@/lib/shop/service";

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { packInstanceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.packInstanceId) {
    return NextResponse.json({ error: "pack_not_found" }, { status: 404 });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

  try {
    const openResult = await openPack(
      session.userId,
      body.packInstanceId,
      idempotencyKey,
    );
    const user = await findUserByIdSafe(session.userId);
    return NextResponse.json({
      openResult,
      credits: user ? normalizeUser(user).credits : 0,
    });
  } catch (err) {
    if (err instanceof ShopError) {
      const status =
        err.code === "pack_not_found"
          ? 404
          : err.code === "pack_already_opened"
            ? 409
            : 400;
      return NextResponse.json({ error: err.code }, { status });
    }
    throw err;
  }
}
