import { NextResponse } from "next/server";
import { createMatch } from "@/lib/game/engine";
import { saveMatch } from "@/lib/game/store";
import { createGameSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const {
    playerId,
    playerNickname,
    characterId,
    vsAi,
    opponentCharacterId,
    relicId,
  } = parsed.data;

  const match = createMatch(
    playerId,
    playerNickname,
    characterId,
    vsAi,
    opponentCharacterId,
    relicId,
  );

  await saveMatch(match);

  return NextResponse.json({ match }, { status: 201 });
}
