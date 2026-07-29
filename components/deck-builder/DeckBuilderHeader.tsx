"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  Code2,
  Layers,
  Loader2,
  Pencil,
  Save,
} from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { getAllCharacters, getCharacterById } from "@/lib/data";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

type Props = {
  onShowCode: () => void;
  onShowMyDecks: () => void;
  showMyDecks: boolean;
};

function CharacterBadge({ characterId }: { characterId: string | null }) {
  const selectCharacter = useDeckBuilderStore((s) => s.selectCharacter);
  const characters = getAllCharacters();
  const character = characterId ? getCharacterById(characterId) : null;

  return (
    <select
      value={characterId ?? ""}
      onChange={(e) => {
        if (e.target.value) selectCharacter(e.target.value);
      }}
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 6,
        padding: "5px 10px",
        font: `600 13px ${TYPOGRAPHY.ui}`,
        color: COLORS.text_primary,
        maxWidth: 180,
      }}
    >
      <option value="" disabled>
        Персонаж…
      </option>
      {characters.map((c) => (
        <option key={c.id} value={c.id}>
          {character?.id === c.id ? `👤 ${c.name}` : c.name}
        </option>
      ))}
    </select>
  );
}

export function DeckBuilderHeader({
  onShowCode,
  onShowMyDecks,
  showMyDecks,
}: Props) {
  const currentDeck = useDeckBuilderStore((s) => s.currentDeck);
  const characterId = useDeckBuilderStore((s) => s.characterId);
  const savedDecks = useDeckBuilderStore((s) => s.savedDecks);
  const isSaving = useDeckBuilderStore((s) => s.isSaving);
  const lastSaved = useDeckBuilderStore((s) => s.lastSaved);
  const saveDeck = useDeckBuilderStore((s) => s.saveDeck);
  const renameDeck = useDeckBuilderStore((s) => s.renameDeck);
  const setDeckName = useDeckBuilderStore((s) => s.setDeckName);

  const [isRenamingDeck, setIsRenamingDeck] = useState(false);
  const [draftName, setDraftName] = useState(currentDeck.name);

  useEffect(() => {
    setDraftName(currentDeck.name);
  }, [currentDeck.name]);

  const tertiaryBtn: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    font: `500 13px ${TYPOGRAPHY.ui}`,
    color: COLORS.text_secondary,
    cursor: "pointer",
  };

  return (
    <header
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        background: COLORS.bg_surface,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      <Link
        href="/"
        style={{
          color: COLORS.text_secondary,
          display: "flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
          font: `500 13px ${TYPOGRAPHY.ui}`,
        }}
      >
        <ChevronLeft size={18} /> Назад
      </Link>

      <div
        style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }}
      />

      <CharacterBadge characterId={characterId} />

      <div
        style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }}
      />

      {isRenamingDeck ? (
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            if (currentDeck.id) {
              void renameDeck(currentDeck.id, draftName);
            } else {
              setDeckName(draftName.trim() || "Новая колода");
            }
            setIsRenamingDeck(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          autoFocus
          style={{
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${COLORS.gold}`,
            borderRadius: 6,
            padding: "4px 10px",
            font: `600 15px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_primary,
            width: 200,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsRenamingDeck(true)}
          style={{
            font: `600 15px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_primary,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {currentDeck.name}
          <Pencil size={13} color={COLORS.text_secondary} />
        </button>
      )}

      <button
        type="button"
        onClick={onShowMyDecks}
        style={{
          ...tertiaryBtn,
          background: showMyDecks ? "rgba(255,255,255,0.1)" : "transparent",
        }}
      >
        <Layers size={15} /> Мои колоды ({savedDecks.length})
      </button>

      <div style={{ flex: 1 }} />

      <UserMenu />

      <button type="button" onClick={onShowCode} style={tertiaryBtn}>
        <Code2 size={15} /> Код
      </button>

      <motion.button
        type="button"
        onClick={() => void saveDeck()}
        disabled={isSaving || !characterId}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: "6px 16px",
          background: isSaving ? COLORS.bg_surface : COLORS.gold,
          color: isSaving ? COLORS.text_secondary : "#1A0000",
          borderRadius: 8,
          font: `700 14px ${TYPOGRAPHY.ui}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          cursor: isSaving || !characterId ? "not-allowed" : "pointer",
          opacity: !characterId ? 0.5 : 1,
        }}
      >
        {isSaving ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Сохраняем
          </>
        ) : lastSaved ? (
          <>
            <Check size={15} /> Сохранено
          </>
        ) : (
          <>
            <Save size={15} /> Сохранить
          </>
        )}
      </motion.button>
    </header>
  );
}
