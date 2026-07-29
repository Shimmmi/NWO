"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Plus, Trash2 } from "lucide-react";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { getCharacterById } from "@/lib/data";
import { DECK_RULES } from "@/lib/game/deckRules";
import type { Deck } from "@/lib/game/deckTypes";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

function DeckListItem({
  deck,
  isActive,
  onLoad,
  onDelete,
  onDuplicate,
}: {
  deck: Deck;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const total = deck.entries.reduce((s, e) => s + e.count, 0);
  const charName = getCharacterById(deck.characterId)?.name ?? deck.characterId;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <button
        type="button"
        onClick={onLoad}
        style={{
          flex: 1,
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            font: `600 13px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_primary,
          }}
        >
          {deck.name}
        </div>
        <div
          style={{
            font: `400 11px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
            marginTop: 2,
          }}
        >
          {charName} · {total}/{DECK_RULES.MAX_CARDS}
          {!deck.isValid && " · невалидна"}
        </div>
      </button>
      <button
        type="button"
        title="Дублировать"
        onClick={onDuplicate}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLORS.text_secondary,
          padding: 4,
        }}
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        title="Удалить"
        onClick={onDelete}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLORS.text_secondary,
          padding: 4,
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function MyDecksDropdown({ onClose }: { onClose: () => void }) {
  const savedDecks = useDeckBuilderStore((s) => s.savedDecks);
  const currentDeckId = useDeckBuilderStore((s) => s.currentDeck.id);
  const createNewDeck = useDeckBuilderStore((s) => s.createNewDeck);
  const loadDeck = useDeckBuilderStore((s) => s.loadDeck);
  const deleteDeck = useDeckBuilderStore((s) => s.deleteDeck);
  const duplicateDeck = useDeckBuilderStore((s) => s.duplicateDeck);
  const [search, setSearch] = useState("");

  const filtered = savedDecks.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 999 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        style={{
          position: "absolute",
          top: 56,
          left: 160,
          width: 340,
          background: COLORS.bg_surface,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <input
            placeholder="Найти колоду..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 10px",
              font: `400 13px ${TYPOGRAPHY.ui}`,
              color: COLORS.text_primary,
              outline: "none",
            }}
          />
        </div>

        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          <button
            type="button"
            onClick={() => {
              createNewDeck("Новая колода");
              onClose();
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: COLORS.gold,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "none",
              border: "none",
              borderBottomWidth: 1,
              borderBottomStyle: "solid",
              borderBottomColor: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              font: `600 13px ${TYPOGRAPHY.ui}`,
            }}
          >
            <Plus size={16} /> Создать новую колоду
          </button>

          {filtered.map((deck) => (
            <DeckListItem
              key={deck.id}
              deck={deck}
              isActive={currentDeckId === deck.id}
              onLoad={() => {
                void loadDeck(deck.id);
                onClose();
              }}
              onDelete={() => void deleteDeck(deck.id)}
              onDuplicate={() => {
                void duplicateDeck(deck.id);
                onClose();
              }}
            />
          ))}

          {filtered.length === 0 && search && (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: COLORS.text_secondary,
                font: `400 13px ${TYPOGRAPHY.ui}`,
              }}
            >
              Колод с таким названием нет
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
