import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { validateCraft, type CraftRequest } from "@/lib/shop/craft";
import {
  decrementCardOrThrow,
  incrementCard,
  ownedCountsMap,
  writeLedger,
} from "@/lib/shop/models";

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CraftRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body?.fromRarity ||
    !Array.isArray(body.consume) ||
    !body.targetCardId
  ) {
    return NextResponse.json({ error: "craft_invalid" }, { status: 422 });
  }

  const owned = await ownedCountsMap(session.userId);
  const validated = validateCraft(body, owned);
  if (!validated.ok) {
    const status =
      validated.error === "insufficient" ? 409 : 422;
    return NextResponse.json(
      { error: "craft_invalid", detail: validated.error },
      { status },
    );
  }

  try {
    for (const line of validated.result.consumed) {
      await decrementCardOrThrow(session.userId, line.cardId, line.count);
    }
    await incrementCard(
      session.userId,
      validated.result.gained.cardId,
      validated.result.gained.count,
    );
    await writeLedger(session.userId, "craft", 0, {
      ...validated.result,
    });
  } catch {
    return NextResponse.json({ error: "craft_insufficient" }, { status: 409 });
  }

  const items = [...(await ownedCountsMap(session.userId)).entries()].map(
    ([cardId, count]) => ({ cardId, count }),
  );

  return NextResponse.json({
    craftResult: validated.result,
    collectionPatch: items,
  });
}
