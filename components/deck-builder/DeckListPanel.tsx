"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Minus,
  Plus,
  Swords,
  Trash2,
} from "lucide-react";
import { DECK_RARITY_CONFIG } from "@/components/deck-builder/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { groupDeckEntriesByCost } from "@/lib/game/deckHelpers";
import { DECK_RULES } from "@/lib/game/deckRules";
import type { CostGroup, DeckEntry } from "@/lib/game/deckTypes";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

function IconButton({
  icon,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      style={{
        width: 20,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.04)",
        color: disabled ? COLORS.text_secondary : COLORS.text_primary,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon}
    </button>
  );
}

function DeckCardRow({ entry }: { entry: DeckEntry }) {
  const addCard = useDeckBuilderStore((s) => s.addCard);
  const removeCard = useDeckBuilderStore((s) => s.removeCard);
  const setPreviewCard = useDeckBuilderStore((s) => s.setPreviewCard);
  const { card, count } = entry;
  const rarity = DECK_RARITY_CONFIG[card.rarity];
  const maxCopies = DECK_RULES.MAX_COPIES[card.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      onMouseEnter={() => setPreviewCard(card)}
      onMouseLeave={() => setPreviewCard(null)}
      data-deck-row={card.id}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 14px",
        gap: 8,
        borderLeft: `2px solid ${rarity.color}`,
        marginBottom: 1,
        background: "transparent",
        transition: "background 0.15s",
      }}
      whileHover={{ background: "rgba(255,255,255,0.04)" }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "radial-gradient(circle, #FFD700, #886600)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: `700 12px ${TYPOGRAPHY.ui}`,
          color: "#1A0000",
          flexShrink: 0,
        }}
      >
        {card.cost}
      </div>

      <span
        style={{
          flex: 1,
          font: `500 13px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_primary,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {card.name}
      </span>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <IconButton
          icon={<Minus size={11} />}
          onClick={() => removeCard(card.id)}
        />
        <span
          style={{
            font: `700 13px ${TYPOGRAPHY.ui}`,
            color: count >= maxCopies ? COLORS.gold : COLORS.text_primary,
            width: 24,
            textAlign: "center",
          }}
        >
          ×{count}
        </span>
        <IconButton
          icon={<Plus size={11} />}
          onClick={() => addCard(card)}
          disabled={count >= maxCopies}
        />
      </div>
    </motion.div>
  );
}

function CostGroupBlock({ group }: { group: CostGroup }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          padding: "4px 14px",
          font: `600 11px ${TYPOGRAPHY.ui}`,
          color: COLORS.text_secondary,
          letterSpacing: "0.5px",
        }}
      >
        Стоимость {group.cost}
      </div>
      {group.entries.map((entry) => (
        <DeckCardRow key={entry.card.id} entry={entry} />
      ))}
    </div>
  );
}

function EmptyDeckState() {
  return (
    <div
      style={{
        padding: 24,
        textAlign: "center",
        color: COLORS.text_secondary,
        font: `400 13px ${TYPOGRAPHY.ui}`,
      }}
    >
      Кликните по картам слева, чтобы добавить их в колоду
    </div>
  );
}

export function DeckListPanel() {
  const router = useRouter();
  const entries = useDeckBuilderStore((s) => s.currentDeck.entries);
  const currentDeckId = useDeckBuilderStore((s) => s.currentDeck.id);
  const clearDeck = useDeckBuilderStore((s) => s.clearDeck);
  const getValidation = useDeckBuilderStore((s) => s.getValidation);
  const validation = getValidation();
  const total = validation.totalCards;
  const progressPct = (total / DECK_RULES.MAX_CARDS) * 100;

  const groupedByCost = useMemo(
    () => groupDeckEntriesByCost(entries),
    [entries],
  );

  const needMore = Math.max(0, DECK_RULES.MIN_CARDS - total);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        background: COLORS.bg_surface,
      }}
    >
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              font: `700 22px ${TYPOGRAPHY.ui}`,
              color: COLORS.text_primary,
            }}
          >
            <span
              style={{
                color:
                  total >= DECK_RULES.MIN_CARDS
                    ? COLORS.gold
                    : COLORS.red_hot,
              }}
            >
              {total}
            </span>
            <span
              style={{
                color: COLORS.text_secondary,
                font: `400 16px ${TYPOGRAPHY.ui}`,
              }}
            >
              /{DECK_RULES.MAX_CARDS}
            </span>
          </span>
          <span
            style={{
              font: `500 12px ${TYPOGRAPHY.ui}`,
              color: validation.isValid ? "#44FF88" : COLORS.text_secondary,
            }}
          >
            {validation.isValid
              ? "✓ Колода готова"
              : needMore > 0
                ? `Нужно ещё ${needMore}`
                : "Исправь ошибки"}
          </span>
        </div>

        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${Math.min(progressPct, 100)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            style={{
              height: "100%",
              background:
                total >= DECK_RULES.MAX_CARDS
                  ? COLORS.red_hot
                  : total >= DECK_RULES.MIN_CARDS
                    ? `linear-gradient(90deg, #44BB88, ${COLORS.gold})`
                    : `linear-gradient(90deg, ${COLORS.gold}88, ${COLORS.gold})`,
              borderRadius: 3,
            }}
          />
        </div>

        <AnimatePresence>
          {validation.errors.map((err, i) => (
            <motion.div
              key={`${err.type}-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginTop: 6,
                padding: "4px 8px",
                background: "rgba(200,0,0,0.15)",
                border: "1px solid rgba(200,0,0,0.4)",
                borderRadius: 6,
                font: `500 12px ${TYPOGRAPHY.ui}`,
                color: "#FF8888",
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              {err.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div
        id="deck-list-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
      >
        {entries.length === 0 ? (
          <EmptyDeckState />
        ) : (
          <AnimatePresence initial={false}>
            {groupedByCost.map((group) => (
              <CostGroupBlock key={group.cost} group={group} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {validation.warnings.slice(0, 2).map((warn, i) => (
          <div
            key={i}
            style={{
              font: `400 11px ${TYPOGRAPHY.ui}`,
              color: "#FFB74D",
              display: "flex",
              gap: 5,
              alignItems: "flex-start",
            }}
          >
            <AlertTriangle
              size={12}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>{warn.suggestion}</span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => clearDeck()}
          disabled={entries.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 0",
            color: COLORS.text_secondary,
            font: `500 12px ${TYPOGRAPHY.ui}`,
            background: "none",
            border: "none",
            cursor: entries.length === 0 ? "not-allowed" : "pointer",
            opacity: entries.length === 0 ? 0.4 : 1,
          }}
        >
          <Trash2 size={13} /> Очистить деку
        </button>

        <motion.button
          type="button"
          disabled={!validation.isValid || !currentDeckId}
          whileHover={validation.isValid ? { scale: 1.02 } : {}}
          whileTap={validation.isValid ? { scale: 0.98 } : {}}
          onClick={() => {
            if (currentDeckId) {
              router.push(`/game/ai?deckId=${currentDeckId}`);
            }
          }}
          style={{
            height: 42,
            background: validation.isValid
              ? `linear-gradient(135deg, ${COLORS.gold}, #CC8800)`
              : "rgba(255,255,255,0.05)",
            color: validation.isValid ? "#1A0000" : COLORS.text_secondary,
            borderRadius: 10,
            font: `700 15px ${TYPOGRAPHY.ui}`,
            letterSpacing: "1px",
            cursor:
              validation.isValid && currentDeckId ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: validation.isValid
              ? `1px solid ${COLORS.gold}`
              : "1px solid rgba(255,255,255,0.08)",
            boxShadow: validation.isValid
              ? `0 0 20px ${COLORS.gold}44`
              : "none",
            opacity: validation.isValid && !currentDeckId ? 0.7 : 1,
          }}
        >
          <Swords size={16} />{" "}
          {validation.isValid
            ? currentDeckId
              ? "В БОЙ!"
              : "Сохрани колоду"
            : "Заполни колоду"}
        </motion.button>
      </div>
    </div>
  );
}
