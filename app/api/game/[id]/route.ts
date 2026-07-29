import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  activateAbility,
  passAbilityPhase,
  passTurn,
  playCard,
  submitCard,
} from "@/lib/game/engine";
import { getMatch, saveMatch } from "@/lib/game/store";
import { toPlayerView } from "@/lib/game/view";
import { gameActionSchema, playTurnSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  const session = await getSessionPayload();
  if (!session) {
    return NextResponse.json({ error: "Auth required" }, { status: 401 });
  }

  const match = await getMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const playerNum =
    match.player1.id === session.userId
      ? 1
      : match.player2.id === session.userId
        ? 2
        : null;

  if (!playerNum) {
    return NextResponse.json(
      { error: "Not a player in this match" },
      { status: 403 },
    );
  }

  return NextResponse.json({ view: toPlayerView(match, playerNum) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const match = await getMatch(id);

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status === "finished") {
    return NextResponse.json({ error: "Match is finished" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionParsed = gameActionSchema.safeParse(body);
  if (actionParsed.success) {
    const { playerId, action } = actionParsed.data;

    let playerNum: 1 | 2 | null = null;
    if (match.player1.id === playerId) playerNum = 1;
    else if (match.player2.id === playerId) playerNum = 2;

    if (!playerNum) {
      return NextResponse.json(
        { error: "Not a player in this match" },
        { status: 403 },
      );
    }

    let updated = match;
    switch (action) {
      case "play":
      case "submit_card":
        updated = submitCard(match, playerNum, actionParsed.data.cardId);
        break;
      case "pass":
        updated = passTurn(match, playerNum);
        break;
      case "use_ability":
        updated = activateAbility(match, playerNum, actionParsed.data.abilityId);
        break;
      case "pass_ability":
        updated = passAbilityPhase(match, playerNum);
        break;
    }

    await saveMatch(updated);

    return NextResponse.json({ view: toPlayerView(updated, playerNum) });
  }

  const legacyParsed = playTurnSchema.safeParse(body);
  if (legacyParsed.success) {
    const { playerId, cardIds } = legacyParsed.data;

    let playerNum: 1 | 2 | null = null;
    if (match.player1.id === playerId) playerNum = 1;
    else if (match.player2.id === playerId) playerNum = 2;

    if (!playerNum) {
      return NextResponse.json(
        { error: "Not a player in this match" },
        { status: 403 },
      );
    }

    let updated = match;
    for (const cardId of cardIds) {
      updated = playCard(updated, playerNum, cardId);
    }
    updated = passTurn(updated, playerNum);

    await saveMatch(updated);

    return NextResponse.json({ view: toPlayerView(updated, playerNum) });
  }

  return NextResponse.json(
    { error: "Invalid request body" },
    { status: 400 },
  );
}
