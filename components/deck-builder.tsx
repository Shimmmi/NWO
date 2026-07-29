"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiPath } from "@/lib/constants";
import { getAllCharacters, getCharacterById } from "@/lib/data";
import type { AbilityCard } from "@/lib/game/types";
import { AbilityCardView } from "@/components/game/ability-card-view";
import type { DeckRecord } from "@/lib/schema";
import { cn } from "@/lib/utils";

const MIN_CARDS = 20;
const MAX_CARDS = 30;

export function DeckBuilder() {
  const characters = getAllCharacters();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [characterId, setCharacterId] = useState(characters[0]?.id ?? "");
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const character = getCharacterById(characterId);
  const availableCards = character?.abilityCards ?? [];

  const loadDecks = useCallback(async () => {
    try {
      const res = await fetch(apiPath("/api/decks"), { credentials: "include" });
      if (!res.ok) {
        toast.error("Не удалось загрузить колоды");
        return;
      }
      const data = (await res.json()) as { decks: DeckRecord[] };
      setDecks(data.decks);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const resetEditor = (charId?: string) => {
    const cid = charId ?? characters[0]?.id ?? "";
    setSelectedDeckId(null);
    setName("");
    setCharacterId(cid);
    const cards = getCharacterById(cid)?.abilityCards ?? [];
    setSelectedCardIds(cards.slice(0, MIN_CARDS).map((c) => c.id));
  };

  const selectDeck = (deck: DeckRecord) => {
    setSelectedDeckId(deck.deckId);
    setName(deck.name);
    setCharacterId(deck.characterId);
    setSelectedCardIds([...deck.cardIds]);
  };

  const toggleCard = (cardId: string) => {
    setSelectedCardIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= MAX_CARDS) {
        toast.error(`Максимум ${MAX_CARDS} карт`);
        return prev;
      }
      return [...prev, cardId];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Введите название колоды");
      return;
    }
    if (selectedCardIds.length < MIN_CARDS || selectedCardIds.length > MAX_CARDS) {
      toast.error(`Колода должна содержать ${MIN_CARDS}–${MAX_CARDS} карт`);
      return;
    }

    setSaving(true);
    try {
      if (selectedDeckId) {
        const res = await fetch(apiPath(`/api/decks/${selectedDeckId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: name.trim(), cardIds: selectedCardIds }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(data.error ?? "Не удалось обновить колоду");
          return;
        }
        toast.success("Колода обновлена");
      } else {
        const res = await fetch(apiPath("/api/decks"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            characterId,
            cardIds: selectedCardIds,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(data.error ?? "Не удалось создать колоду");
          return;
        }
        toast.success("Колода создана");
      }
      await loadDecks();
      resetEditor(characterId);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deckId: string) => {
    try {
      const res = await fetch(apiPath(`/api/decks/${deckId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Не удалось удалить колоду");
        return;
      }
      toast.success("Колода удалена");
      if (selectedDeckId === deckId) resetEditor();
      await loadDecks();
    } catch {
      toast.error("Ошибка сети");
    }
  };

  const handleCharacterChange = (newCharId: string) => {
    setCharacterId(newCharId);
    const cards = getCharacterById(newCharId)?.abilityCards ?? [];
    setSelectedCardIds(cards.slice(0, MIN_CARDS).map((c) => c.id));
  };

  const cardCountValid =
    selectedCardIds.length >= MIN_CARDS && selectedCardIds.length <= MAX_CARDS;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-lg font-bold">Колоды</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">Мои колоды</h2>
            <Button variant="ghost" size="sm" onClick={() => resetEditor()}>
              <Plus />
              Новая
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : decks.length === 0 ? (
            <p className="text-sm text-zinc-500">Колод пока нет</p>
          ) : (
            <ul className="space-y-2">
              {decks.map((deck) => (
                <li key={deck.deckId}>
                  <button
                    type="button"
                    onClick={() => selectDeck(deck)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      selectedDeckId === deck.deckId
                        ? "border-zinc-500 bg-zinc-800"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700",
                    )}
                  >
                    <p className="font-medium">{deck.name}</p>
                    <p className="text-xs text-zinc-500">
                      {deck.cardIds.length} карт
                      {!deck.isValid && " · невалидна"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedDeckId ? "Редактирование" : "Новая колода"}
              </CardTitle>
              <CardDescription>
                Выберите {MIN_CARDS}–{MAX_CARDS} карт для персонажа
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="deck-name" className="text-sm text-zinc-400">
                    Название
                  </label>
                  <Input
                    id="deck-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Моя колода"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="character" className="text-sm text-zinc-400">
                    Персонаж
                  </label>
                  <select
                    id="character"
                    value={characterId}
                    onChange={(e) => handleCharacterChange(e.target.value)}
                    disabled={!!selectedDeckId}
                    className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  >
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-sm",
                    cardCountValid ? "text-zinc-400" : "text-red-400",
                  )}
                >
                  Выбрано: {selectedCardIds.length} / {MAX_CARDS}
                </p>
                <div className="flex gap-2">
                  {selectedDeckId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(selectedDeckId)}
                    >
                      <Trash2 />
                      Удалить
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !cardCountValid}
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Сохранить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableCards.map((card) => {
              const selected = selectedCardIds.includes(card.id);
              return (
                <AbilityCardView
                  key={card.id}
                  card={card}
                  variant="editor"
                  selected={selected}
                  onClick={() => toggleCard(card.id)}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
