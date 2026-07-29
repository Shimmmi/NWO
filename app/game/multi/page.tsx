import { MultiplayerLobby } from "@/components/lobby/multiplayer-lobby";

export default function GameMultiPage() {
  // Сессионная кука здесь не читается намеренно: сокет авторизуется одноразовым
  // тикетом, а httpOnly-кука не должна попадать в разметку (ЧАСТЬ 5.4 ТЗ).
  return <MultiplayerLobby />;
}
