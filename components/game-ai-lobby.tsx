"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CharacterSelect } from "@/components/game/character-select";
import { RelicSelect } from "@/components/game/relic-select";
import { apiPath } from "@/lib/constants";
import { COLORS } from "@/lib/design/tokens";
import type { Match } from "@/lib/game/types";
import type { UserPublic } from "@/lib/schema";

type LobbyStep = "character" | "relic";

export function GameAiLobby() {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState<LobbyStep>("character");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    fetch(apiPath("/api/auth/me"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user: UserPublic | null }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoadingUser(false));
  }, []);

  const startGame = async (relicId: string) => {
    if (!user) {
      toast.error("Войдите, чтобы играть");
      return;
    }
    if (!selectedId) {
      toast.error("Выберите персонажа");
      return;
    }

    setStarting(true);
    try {
      const res = await fetch(apiPath("/api/game"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId: user.userId,
          playerNickname: user.nickname,
          characterId: selectedId,
          vsAi: true,
          relicId,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Не удалось создать матч");
        return;
      }

      const data = (await res.json()) as { match: Match };
      router.push(`/game/${data.match.id}?intro=1`);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="min-h-screen text-zinc-100"
      style={{ background: COLORS.bg_void }}
    >
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/game">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="font-display text-lg tracking-wide">
              Игра против ИИ
            </h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-8">
        {loadingUser ? (
          <Skeleton className="mx-auto h-8 w-48" />
        ) : !user ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="mb-4 text-zinc-400">
                Для игры необходимо войти в аккаунт
              </p>
              <Button asChild>
                <Link href="/auth">Войти</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            {step === "character" && (
              <CharacterSelect
                key="char"
                onSelect={(id) => {
                  setSelectedId(id);
                  setStep("relic");
                }}
              />
            )}
            {step === "relic" && (
              <RelicSelect
                key="relic"
                onSelect={(relicId) => {
                  if (!starting) void startGame(relicId);
                }}
              />
            )}
          </AnimatePresence>
        )}

        {starting && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70">
            <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
          </div>
        )}
      </main>
    </div>
  );
}
