import { redirect } from "next/navigation";
import { JoinFlow } from "@/components/lobby/join-flow";
import { getSessionPayload } from "@/lib/auth";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSessionPayload();

  // Назначение сохраняется: после входа игрок обязан вернуться в лобби,
  // а не на главную (ЧАСТЬ 7.4 ТЗ).
  if (!session) {
    redirect(`/auth?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  return <JoinFlow code={code.toUpperCase()} />;
}
