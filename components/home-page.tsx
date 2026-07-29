import Link from "next/link";
import { BookOpen, Layers, Swords } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sections = [
  {
    href: "/game",
    title: "Играть",
    description: "Сражайтесь с ИИ или другими игроками в карточном поединке.",
    icon: Swords,
  },
  {
    href: "/characters",
    title: "Персонажи",
    description: "Изучите лидеров, их способности и уникальные колоды.",
    icon: BookOpen,
  },
  {
    href: "/decks",
    title: "Колоды",
    description: "Собирайте и сохраняйте колоды из 20–30 карт.",
    icon: Layers,
  },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            WORLD ORDER
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16">
        <section className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            WORLD ORDER
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-400">
            Карточный файтер о глобальной политике. Выберите лидера, соберите
            колоду и докажите превосходство на мировой арене.
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/game">Начать игру</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="group block">
              <Card className="h-full transition-colors group-hover:border-zinc-600">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                    <Icon className="h-5 w-5 text-zinc-300" />
                  </div>
                  <CardTitle className="text-xl">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100">
                    Перейти
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
