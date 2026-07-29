"use client";

import Link from "next/link";
import { ArrowLeft, Shield, Zap } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllCharacters } from "@/lib/data";
import { CharacterPortrait } from "@/components/game/character-portrait";
import { AbilityCardView } from "@/components/game/ability-card-view";
import { cn } from "@/lib/utils";

const accentBorder: Record<string, string> = {
  blue: "border-blue-500/60",
  red: "border-red-500/60",
  crimson: "border-red-800/60",
  gold: "border-yellow-500/60",
};

const accentBg: Record<string, string> = {
  blue: "bg-blue-500/10",
  red: "bg-red-500/10",
  crimson: "bg-red-900/10",
  gold: "bg-yellow-500/10",
};

export function CharacterGallery() {
  const characters = getAllCharacters();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-lg font-bold">Персонажи</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="w-full px-4 py-8 md:px-8">
        <p className="mb-8 text-zinc-400">
          Четыре лидера с уникальными пассивными способностями и колодами из 20
          карт.
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {characters.map((character) => (
            <Card
              key={character.id}
              className={cn(
                "flex min-h-[520px] flex-col border-2",
                accentBorder[character.countryAccent],
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{character.name}</CardTitle>
                    <CardDescription>{character.country}</CardDescription>
                  </div>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium uppercase",
                      accentBg[character.countryAccent],
                    )}
                  >
                    {character.countryCode}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-4">
                <CharacterPortrait
                  characterId={character.id}
                  currentForm={1}
                  size="md"
                  className="mx-auto"
                />

                <p className="flex-1 text-sm text-zinc-300">{character.description}</p>
                <blockquote className="border-l-2 border-zinc-700 pl-4 text-sm italic text-zinc-400">
                  {character.quote}
                </blockquote>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2">
                    <Shield className="h-4 w-4 text-zinc-400" />
                    <span>
                      HP {character.stats.maxHp} / ARM {character.stats.armor}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2">
                    <Zap className="h-4 w-4 text-zinc-400" />
                    <span>
                      EN {character.stats.maxEnergy} / SPD {character.stats.speed}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Пассив: {character.passiveAbility}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {character.passiveDescription}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Уникальные способности
                  </p>
                  <ul className="space-y-1 text-xs text-zinc-400">
                    {character.uniqueAbilities.map((a) => (
                      <li key={a.id}>
                        <span className="text-zinc-200">{a.name}</span> ({a.chargeCost}⚡) — {a.description}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Формы
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {character.forms.map((form) => (
                      <span
                        key={form}
                        className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                      >
                        {form}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-zinc-500">
                  {character.abilityCards.length} карт в колоде
                </p>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Примеры карт
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {character.abilityCards
                      .filter((c) => c.rarity === "legendary" || c.rarity === "epic")
                      .slice(0, 3)
                      .map((card) => (
                        <AbilityCardView key={card.id} card={card} variant="compact" />
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
