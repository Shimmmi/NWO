import Link from "next/link";
import { ArrowLeft, Bot, Users } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const modes = [
  {
    href: "/game/ai",
    title: "Против ИИ",
    description:
      "Сразитесь с компьютерным противником. Идеально для тренировки и изучения механик.",
    icon: Bot,
  },
  {
    href: "/game/multi",
    title: "Мультиплеер",
    description:
      "Найдите соперника в очереди или создайте лобби с кодом для друга.",
    icon: Users,
  },
];

export function GameModeSelect() {
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
            <h1 className="text-lg font-bold">Выбор режима</h1>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <p className="mb-8 text-center text-zinc-400">
          Выберите, как вы хотите играть в WORLD ORDER.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {modes.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="group block">
              <Card className="h-full transition-colors group-hover:border-zinc-600">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800">
                    <Icon className="h-6 w-6 text-zinc-300" />
                  </div>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100">
                    Начать
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
