import { getCardById } from "@/lib/data";
import type { Deck, DeckEntry } from "@/lib/game/deckTypes";

function toBase64Url(json: string): string {
  if (typeof btoa === "function") {
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeDeck(
  deck: Pick<Deck, "characterId" | "name" | "entries">,
): string {
  const payload = {
    v: 1,
    c: deck.characterId,
    n: deck.name,
    cards: deck.entries.map((e) => `${e.card.id}:${e.count}`).join(","),
  };
  return "WO1_" + toBase64Url(JSON.stringify(payload));
}

export function decodeDeck(
  code: string,
): Omit<Deck, "id" | "userId" | "isValid" | "createdAt" | "updatedAt"> | null {
  try {
    if (!code.startsWith("WO1_")) return null;
    const payload = JSON.parse(fromBase64Url(code.slice(4))) as {
      v: number;
      c: string;
      n: string;
      cards: string;
    };

    if (!payload.c || typeof payload.cards !== "string") return null;

    const entries: DeckEntry[] = payload.cards
      .split(",")
      .filter(Boolean)
      .map((part) => {
        const [cardId, countStr] = part.split(":");
        const card = getCardById(cardId);
        if (!card) return null;
        const count = parseInt(countStr, 10);
        if (!Number.isFinite(count) || count < 1) return null;
        return { card, count };
      })
      .filter((e): e is DeckEntry => e !== null);

    if (entries.length === 0) return null;

    return {
      name: payload.n || "Импортированная колода",
      characterId: payload.c,
      entries,
    };
  } catch {
    return null;
  }
}
