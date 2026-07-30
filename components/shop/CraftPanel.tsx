"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getCharacterById, getCardById, getNeutralCards } from "@/lib/data";
import { apiPath } from "@/lib/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import {
  CRAFT_COST,
  CRAFT_NEXT,
  type CraftableFrom,
} from "@/lib/shop/craft";
import { useCollectionStore } from "@/lib/stores/collectionStore";

type CraftPool = "faction" | "neutral";

export function CraftPanel({ characterId }: { characterId: string | null }) {
  const ownedCounts = useCollectionStore((s) => s.ownedCounts);
  const load = useCollectionStore((s) => s.load);
  const [pool, setPool] = useState<CraftPool>("faction");
  const [fromRarity, setFromRarity] = useState<CraftableFrom>("common");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const character = characterId ? getCharacterById(characterId) : null;
  const poolCards = useMemo(() => {
    if (pool === "neutral") return getNeutralCards();
    return character?.abilityCards ?? [];
  }, [character, pool]);

  const dustPool = useMemo(() => {
    return poolCards.filter(
      (c) => c.rarity === fromRarity && (ownedCounts[c.id] ?? 0) > 0,
    );
  }, [poolCards, fromRarity, ownedCounts]);

  const targets = useMemo(() => {
    const next = CRAFT_NEXT[fromRarity];
    return poolCards.filter((c) => c.rarity === next);
  }, [poolCards, fromRarity]);

  const toggle = (cardId: string) => {
    setSelected((prev) => {
      const owned = ownedCounts[cardId] ?? 0;
      const used = prev.filter((id) => id === cardId).length;
      if (used < owned && prev.length < CRAFT_COST) {
        return [...prev, cardId];
      }
      const idx = prev.lastIndexOf(cardId);
      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      return prev;
    });
  };

  const craft = async () => {
    if (selected.length !== CRAFT_COST || !targetId) {
      toast.error("Выберите 4 карты пыли и цель");
      return;
    }
    const consumeMap = new Map<string, number>();
    for (const id of selected) {
      consumeMap.set(id, (consumeMap.get(id) ?? 0) + 1);
    }
    setBusy(true);
    try {
      const res = await fetch(apiPath("/api/craft"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromRarity,
          consume: [...consumeMap.entries()].map(([cardId, count]) => ({
            cardId,
            count,
          })),
          targetCardId: targetId,
        }),
      });
      if (!res.ok) {
        toast.error("Крафт не удался");
        return;
      }
      toast.success(`Скрафчено: ${getCardById(targetId)?.name ?? targetId}`);
      setSelected([]);
      setTargetId("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!characterId) {
    return (
      <p
        style={{
          padding: 24,
          color: COLORS.text_secondary,
          font: `400 14px ${TYPOGRAPHY.ui}`,
        }}
      >
        Сначала выберите персонажа
      </p>
    );
  }

  return (
    <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
      <p
        style={{
          font: `400 13px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_secondary,
          marginBottom: 12,
        }}
      >
        4 карты одной редкости → 1 карта следующей (один пул: фракция или
        нейтралы)
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(
          [
            { id: "faction" as const, label: "Фракция" },
            { id: "neutral" as const, label: "Нейтралы" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setPool(opt.id);
              setSelected([]);
              setTargetId("");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border:
                pool === opt.id
                  ? `1px solid ${COLORS.neutral_green}`
                  : "1px solid rgba(255,255,255,0.1)",
              background:
                pool === opt.id ? `${COLORS.neutral_green}33` : "transparent",
              color: COLORS.text_primary,
              font: `600 12px ${TYPOGRAPHY.ui}`,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["common", "rare", "epic"] as CraftableFrom[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setFromRarity(r);
              setSelected([]);
              setTargetId("");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border:
                fromRarity === r
                  ? `1px solid ${COLORS.gold}`
                  : "1px solid rgba(255,255,255,0.1)",
              background: fromRarity === r ? `${COLORS.gold}22` : "transparent",
              color: COLORS.text_primary,
              font: `600 12px ${TYPOGRAPHY.ui}`,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {r} → {CRAFT_NEXT[r]}
          </button>
        ))}
      </div>

      <p style={{ font: `600 12px ${TYPOGRAPHY.ui}`, color: COLORS.gold }}>
        Пыль ({selected.length}/{CRAFT_COST})
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          margin: "8px 0 16px",
        }}
      >
        {dustPool.map((c) => {
          const used = selected.filter((id) => id === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border:
                  used > 0
                    ? `1px solid ${COLORS.gold}`
                    : "1px solid rgba(255,255,255,0.12)",
                background: COLORS.bg_card,
                color: COLORS.text_primary,
                font: `500 11px ${TYPOGRAPHY.ui}`,
                cursor: "pointer",
              }}
            >
              {c.name} ×{ownedCounts[c.id] ?? 0}
              {used > 0 ? ` (−${used})` : ""}
            </button>
          );
        })}
        {dustPool.length === 0 && (
          <span style={{ color: COLORS.text_secondary, fontSize: 12 }}>
            Нет карт этой редкости
          </span>
        )}
      </div>

      <p style={{ font: `600 12px ${TYPOGRAPHY.ui}`, color: COLORS.gold }}>
        Цель ({CRAFT_NEXT[fromRarity]})
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          margin: "8px 0 16px",
        }}
      >
        {targets.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTargetId(c.id)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border:
                targetId === c.id
                  ? `1px solid ${COLORS.gold_glow}`
                  : "1px solid rgba(255,255,255,0.12)",
              background:
                targetId === c.id ? `${COLORS.gold}33` : COLORS.bg_card,
              color: COLORS.text_primary,
              font: `500 11px ${TYPOGRAPHY.ui}`,
              cursor: "pointer",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || selected.length !== CRAFT_COST || !targetId}
        onClick={() => void craft()}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "none",
          cursor:
            busy || selected.length !== CRAFT_COST || !targetId
              ? "not-allowed"
              : "pointer",
          font: `700 13px ${TYPOGRAPHY.ui}`,
          color: COLORS.bg_void,
          background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.gold_glow})`,
          opacity:
            busy || selected.length !== CRAFT_COST || !targetId ? 0.5 : 1,
        }}
      >
        Скрафтить
      </button>
    </div>
  );
}
