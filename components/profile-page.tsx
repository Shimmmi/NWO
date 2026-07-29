"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiPath } from "@/lib/constants";
import type { UserPublic } from "@/lib/schema";

function StatBlock({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

export function ProfilePage() {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiPath("/api/auth/me"), { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as { user: UserPublic | null };
        setUser(data.user);
      })
      .catch(() => {
        toast.error("Не удалось загрузить профиль");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const winRate =
    user && user.wins + user.losses > 0
      ? Math.round((user.wins / (user.wins + user.losses)) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft />
              </Link>
            </Button>
            <h1 className="text-lg font-bold">Профиль</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>
        ) : !user ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="mb-4 text-zinc-400">
                Войдите, чтобы просмотреть профиль
              </p>
              <Button asChild>
                <Link href="/auth">Войти</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-xl font-bold">
                    {user.nickname.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle>{user.nickname}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">
                    Уровень {user.level}
                  </span>
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs">
                    {user.xp} XP
                  </span>
                  {user.isGuest && (
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      Гостевой аккаунт
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-zinc-400" />
                <h2 className="text-sm font-medium text-zinc-400">Статистика</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBlock label="Рейтинг" value={user.rating} />
                <StatBlock label="Побед" value={user.wins} />
                <StatBlock label="Поражений" value={user.losses} />
                <StatBlock label="Win rate" value={`${winRate}%`} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" asChild>
                <Link href="/game">Играть</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/decks">Колоды</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
