import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getCharacterById } from "@/lib/data";
import {
  deleteDeckSafe,
  getDeckByIdSafe,
  updateDeckSafe,
} from "@/lib/models";
import { updateDeckSchema } from "@/lib/validation";

function validateDeckCards(characterId: string, cardIds: string[]): boolean {
  const character = getCharacterById(characterId);
  if (!character) return false;
  const validIds = new Set(character.abilityCards.map((c) => c.id));
  return (
    cardIds.length >= 20 &&
    cardIds.length <= 30 &&
    cardIds.every((id) => validIds.has(id))
  );
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getDeckByIdSafe(id);
  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (existing.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const cardIds = parsed.data.cardIds ?? existing.cardIds;
  const isValid = validateDeckCards(existing.characterId, cardIds);

  const deck = await updateDeckSafe(id, {
    ...parsed.data,
    isValid,
  });

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getDeckByIdSafe(id);
  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  if (existing.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteDeckSafe(id);
  return NextResponse.json({ ok: true });
}
