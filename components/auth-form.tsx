"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath, BASE_PATH } from "@/lib/constants";

type AuthMode = "login" | "register";

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = () => {
    // Только внутренние пути: открытый редирект на чужой домен недопустим.
    const next = searchParams.get("next");
    const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    window.location.href = BASE_PATH + target;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? apiPath("/api/auth/login")
          : apiPath("/api/auth/register");

      const body =
        mode === "login"
          ? { email, password }
          : { email, password, nickname };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Ошибка авторизации");
        return;
      }

      toast.success(mode === "login" ? "Добро пожаловать!" : "Аккаунт создан");
      handleSuccess();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath("/api/auth/demo"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error("Не удалось создать гостевой аккаунт");
        return;
      }
      toast.success("Гостевой вход выполнен");
      handleSuccess();
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>WORLD ORDER</CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Войдите в аккаунт"
              : "Создайте новый аккаунт"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <label htmlFor="nickname" className="text-sm text-zinc-400">
                  Никнейм
                </label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Player"
                  required
                  minLength={2}
                  maxLength={32}
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-zinc-400">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-zinc-400">
                Пароль
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                minLength={mode === "register" ? 6 : 1}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>

          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={handleDemo}
            >
              {loading && <Loader2 className="animate-spin" />}
              Демо-вход
            </Button>

            <p className="text-center text-sm text-zinc-400">
              {mode === "login" ? (
                <>
                  Нет аккаунта?{" "}
                  <button
                    type="button"
                    className="text-zinc-100 underline-offset-4 hover:underline"
                    onClick={() => setMode("register")}
                  >
                    Регистрация
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{" "}
                  <button
                    type="button"
                    className="text-zinc-100 underline-offset-4 hover:underline"
                    onClick={() => setMode("login")}
                  >
                    Войти
                  </button>
                </>
              )}
            </p>

            <p className="text-center">
              <Link
                href="/"
                className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
              >
                На главную
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
