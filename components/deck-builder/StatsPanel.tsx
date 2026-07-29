"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { DECK_RARITY_CONFIG } from "@/components/deck-builder/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { DECK_RULES } from "@/lib/game/deckRules";
import type { AbilityCard } from "@/lib/game/types";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        font: `600 12px ${TYPOGRAPHY.ui}`,
        color: COLORS.text_secondary,
        letterSpacing: "1px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function StatBlock({
  label,
  value,
  max,
}: {
  label: string;
  value: number | string;
  max?: number;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          font: `400 10px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_secondary,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `700 16px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_primary,
        }}
      >
        {value}
        {max !== undefined && (
          <span
            style={{
              font: `400 12px ${TYPOGRAPHY.ui}`,
              color: COLORS.text_secondary,
            }}
          >
            /{max}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatsPanel() {
  const entries = useDeckBuilderStore((s) => s.currentDeck.entries);
  const getValidation = useDeckBuilderStore((s) => s.getValidation);
  const validation = getValidation();

  const allCards = useMemo(
    () => entries.flatMap((e) => Array(e.count).fill(e.card) as AbilityCard[]),
    [entries],
  );

  const curveCounts = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    allCards.forEach((c) => {
      const cost = Math.min(6, Math.max(0, c.cost));
      counts[cost]++;
    });
    return counts;
  }, [allCards]);

  const maxCurve = Math.max(...curveCounts, 1);

  const rarityCounts = useMemo(() => {
    const r = { common: 0, rare: 0, epic: 0, legendary: 0 };
    allCards.forEach((c) => {
      r[c.rarity]++;
    });
    return r;
  }, [allCards]);

  const avgCost =
    allCards.length > 0
      ? (allCards.reduce((s, c) => s + c.cost, 0) / allCards.length).toFixed(1)
      : "—";

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "14px 16px",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.text_secondary,
          font: `400 13px ${TYPOGRAPHY.ui}`,
          textAlign: "center",
        }}
      >
        Начни добавлять карты —
        <br />
        здесь появится кривая энергии
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
        padding: "14px 16px",
        gap: 20,
        scrollbarWidth: "thin",
      }}
    >
      <div>
        <SectionLabel>Кривая энергии</SectionLabel>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 5,
            height: 100,
            marginTop: 10,
          }}
        >
          {curveCounts.map((count, cost) => (
            <div
              key={cost}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <motion.div
                animate={{
                  height: count > 0 ? `${(count / maxCurve) * 80}px` : 4,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{
                  width: "100%",
                  borderRadius: "3px 3px 0 0",
                  background:
                    cost <= 2
                      ? "linear-gradient(0deg, #44BB88, #66DDAA)"
                      : cost <= 4
                        ? `linear-gradient(0deg, ${COLORS.gold}AA, ${COLORS.gold})`
                        : "linear-gradient(0deg, #CC4400, #FF6622)",
                  minHeight: 4,
                  position: "relative",
                }}
              >
                {count > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -18,
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      font: `700 11px ${TYPOGRAPHY.ui}`,
                      color: COLORS.text_primary,
                    }}
                  >
                    {count}
                  </span>
                )}
              </motion.div>
              <span
                style={{
                  font: `500 11px ${TYPOGRAPHY.ui}`,
                  color: COLORS.text_secondary,
                }}
              >
                {cost}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            textAlign: "center",
            font: `400 11px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
            marginTop: 4,
          }}
        >
          Средняя стоимость:{" "}
          <span style={{ color: COLORS.gold }}>{avgCost}</span>
        </div>
      </div>

      <div>
        <SectionLabel>Редкость</SectionLabel>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {(["legendary", "epic", "rare", "common"] as const).map((rarity) => {
            const count = rarityCounts[rarity];
            const max =
              count > 0 ? Math.max(...Object.values(rarityCounts)) : 1;
            return (
              <div
                key={rarity}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    width: 70,
                    font: `500 11px ${TYPOGRAPHY.ui}`,
                    color: DECK_RARITY_CONFIG[rarity].color,
                  }}
                >
                  {DECK_RARITY_CONFIG[rarity].label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{
                      width: `${(count / Math.max(max, 1)) * 100}%`,
                    }}
                    style={{
                      height: "100%",
                      background: DECK_RARITY_CONFIG[rarity].color,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span
                  style={{
                    width: 20,
                    textAlign: "right",
                    font: `600 12px ${TYPOGRAPHY.ui}`,
                    color:
                      count > 0
                        ? COLORS.text_primary
                        : COLORS.text_secondary,
                  }}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Статистика</SectionLabel>
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <StatBlock
            label="Всего карт"
            value={validation.totalCards}
            max={DECK_RULES.MAX_CARDS}
          />
          <StatBlock label="Уникальных" value={entries.length} />
          <StatBlock
            label="Атакующих"
            value={allCards.filter((c) => c.type === "active").length}
          />
          <StatBlock
            label="Защитных"
            value={
              allCards.filter(
                (c) =>
                  c.effect.includes("block") || c.effect.includes("heal"),
              ).length
            }
          />
        </div>
      </div>

      {validation.warnings.length > 0 && (
        <div>
          <SectionLabel>Рекомендации</SectionLabel>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {validation.warnings.slice(0, 3).map((warn, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 10px",
                  background: "rgba(255,183,77,0.08)",
                  border: "1px solid rgba(255,183,77,0.25)",
                  borderRadius: 8,
                  font: `400 12px ${TYPOGRAPHY.ui}`,
                  color: "#FFB74D",
                  lineHeight: 1.45,
                }}
              >
                {warn.suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
