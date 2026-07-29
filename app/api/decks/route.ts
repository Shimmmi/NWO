import { NextResponse } from "next/server";
import { generateId, getSessionPayload } from "@/lib/auth";
import { getCharacterById } from "@/lib/data";
import { createDeckSafe, listDecksByUserSafe } from "@/lib/models";
import type { DeckRecord } from "@/lib/schema";
import { createDeckSchema } from "@/lib/validation";

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

export async function GET() {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decks = await listDecksByUserSafe(session.userId);
  return NextResponse.json({ decks });
}

export async function POST(request: Request) {
  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { name, characterId, cardIds } = parsed.data;

  if (!getCharacterById(characterId)) {
    return NextResponse.json({ error: "Unknown character" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const deck: DeckRecord = {
    deckId: generateId("deck"),
    userId: session.userId,
    name,
    characterId,
    cardIds,
    isValid: validateDeckCards(characterId, cardIds),
    createdAt: now,
    updatedAt: now,
  };

  await createDeckSafe(deck);
  return NextResponse.json({ deck }, { status: 201 });
}
