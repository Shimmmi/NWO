import { Suspense } from "react";
import { GameBoard } from "@/components/game-board";
import { Skeleton } from "@/components/ui/skeleton";

export default async function GameMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Сессионная кука здесь не читается намеренно: сокет авторизуется
  // одноразовым тикетом, а httpOnly-кука не должна попадать в разметку.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <Skeleton className="h-[80vh] w-full max-w-6xl rounded-xl" />
        </div>
      }
    >
      <GameBoard matchId={id} />
    </Suspense>
  );
}
