/**
 * Слепой A/B для 3D-лобби (ЧАСТЬ 14.3 ТЗ).
 *
 * Два варианта отличаются композицией камеры и подачей поиска, а не цветом
 * кнопки. Переключение: `?variant=a|b` или localStorage `nwo.lobbyVariant`.
 */

export type LobbyVariant = "a" | "b";

export interface LobbyVariantConfig {
  id: LobbyVariant;
  label: string;
  soloCamera: [number, number, number];
  duoCamera: [number, number, number];
  fov: number;
  /** Смещение портала поиска по X — у B он уходит в сторону. */
  portalOffsetX: number;
  /** CTA-панель idle: внизу или по центру экрана. */
  ctaPlacement: "bottom" | "center";
  /** VersusReveal: классический горизонтальный VS или диагональный. */
  versusLayout: "horizontal" | "diagonal";
}

export const LOBBY_VARIANTS: Record<LobbyVariant, LobbyVariantConfig> = {
  a: {
    id: "a",
    label: "Классика",
    soloCamera: [0, 1.6, 7.5],
    duoCamera: [0, 1.5, 8.4],
    fov: 50,
    portalOffsetX: 0,
    ctaPlacement: "bottom",
    versusLayout: "horizontal",
  },
  b: {
    id: "b",
    label: "Близкий план",
    soloCamera: [0.8, 1.15, 5.6],
    duoCamera: [0, 1.2, 7.0],
    fov: 42,
    portalOffsetX: -1.8,
    ctaPlacement: "center",
    versusLayout: "diagonal",
  },
};

export function isLobbyVariant(value: string | null | undefined): value is LobbyVariant {
  return value === "a" || value === "b";
}

/** Читает вариант из URL, иначе из localStorage, иначе «a». */
export function resolveLobbyVariant(): LobbyVariant {
  if (typeof window === "undefined") return "a";

  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  if (isLobbyVariant(fromUrl)) {
    try {
      window.localStorage.setItem("nwo.lobbyVariant", fromUrl);
    } catch {
      /* private mode */
    }
    return fromUrl;
  }

  try {
    const stored = window.localStorage.getItem("nwo.lobbyVariant");
    if (isLobbyVariant(stored)) return stored;
  } catch {
    /* private mode */
  }

  return "a";
}
