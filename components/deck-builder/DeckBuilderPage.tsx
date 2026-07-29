"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CollectionPanel } from "@/components/deck-builder/CollectionPanel";
import { DeckListPanel } from "@/components/deck-builder/DeckListPanel";
import { StatsPanel } from "@/components/deck-builder/StatsPanel";
import { DeckBuilderHeader } from "@/components/deck-builder/DeckBuilderHeader";
import { CardPreviewPortal } from "@/components/deck-builder/CardPreviewPortal";
import { DeckCodeModal } from "@/components/deck-builder/DeckCodeModal";
import { MyDecksDropdown } from "@/components/deck-builder/MyDecksDropdown";
import { COLORS } from "@/lib/design/tokens";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";
import { useDeckBuilderShortcuts } from "@/hooks/useDeckBuilderShortcuts";

type Props = {
  deckId?: string;
};

export function DeckBuilderPage({ deckId }: Props) {
  const loadDeck = useDeckBuilderStore((s) => s.loadDeck);
  const loadSavedDecks = useDeckBuilderStore((s) => s.loadSavedDecks);
  const saveDeck = useDeckBuilderStore((s) => s.saveDeck);
  const setPreviewCard = useDeckBuilderStore((s) => s.setPreviewCard);
  const currentDeckId = useDeckBuilderStore((s) => s.currentDeck.id);
  const entries = useDeckBuilderStore((s) => s.currentDeck.entries);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showMyDecks, setShowMyDecks] = useState(false);

  useEffect(() => {
    void loadSavedDecks();
  }, [loadSavedDecks]);

  useEffect(() => {
    if (deckId && deckId !== "new") {
      void loadDeck(deckId);
    }
  }, [deckId, loadDeck]);

  // Autosave 1.5s after entry changes (existing decks only)
  useEffect(() => {
    if (!currentDeckId) return;
    const t = setTimeout(() => {
      void saveDeck();
    }, 1500);
    return () => clearTimeout(t);
  }, [entries, currentDeckId, saveDeck]);

  const shortcuts = useMemo(
    () => ({
      "ctrl+s": () => {
        void saveDeck();
      },
      Escape: () => setPreviewCard(null),
    }),
    [saveDeck, setPreviewCard],
  );
  useDeckBuilderShortcuts(shortcuts);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: COLORS.bg_void,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <DeckBuilderHeader
        onShowCode={() => setShowCodeModal(true)}
        onShowMyDecks={() => setShowMyDecks((s) => !s)}
        showMyDecks={showMyDecks}
      />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 280px 280px",
          gap: 0,
          overflow: "hidden",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <CollectionPanel />
        <DeckListPanel />
        <StatsPanel />
      </div>

      <CardPreviewPortal />

      <AnimatePresence>
        {showCodeModal && (
          <DeckCodeModal onClose={() => setShowCodeModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMyDecks && (
          <MyDecksDropdown onClose={() => setShowMyDecks(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
