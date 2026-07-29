"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/deck-builder/FilterBar";
import { CollectionGrid } from "@/components/deck-builder/CollectionGrid";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { getAllCharacters } from "@/lib/data";
import {
  filterAndSortCards,
  getCharacterCards,
} from "@/lib/game/deckHelpers";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";
import { useDebounce } from "@/hooks/useDebounce";

function CharacterSelectPrompt() {
  const selectCharacter = useDeckBuilderStore((s) => s.selectCharacter);
  const characters = getAllCharacters();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 16,
        padding: 32,
        textAlign: "center",
      }}
    >
      <p
        style={{
          font: `600 18px ${TYPOGRAPHY.display}`,
          color: COLORS.text_primary,
        }}
      >
        Выберите персонажа
      </p>
      <p style={{ font: `400 14px ${TYPOGRAPHY.ui}`, color: COLORS.text_secondary }}>
        Колода собирается из карт одного героя
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {characters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectCharacter(c.id)}
            style={{
              padding: "10px 18px",
              background: COLORS.bg_card,
              border: `1px solid ${COLORS.gold}55`,
              borderRadius: 10,
              font: `600 14px ${TYPOGRAPHY.ui}`,
              color: COLORS.text_primary,
              cursor: "pointer",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyFilterResult({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        color: COLORS.text_secondary,
        font: `400 14px ${TYPOGRAPHY.ui}`,
      }}
    >
      <p>Ничего не найдено</p>
      <button
        type="button"
        onClick={onReset}
        style={{
          marginTop: 12,
          color: COLORS.gold,
          background: "none",
          border: "none",
          cursor: "pointer",
          font: `600 13px ${TYPOGRAPHY.ui}`,
        }}
      >
        Сбросить фильтры
      </button>
    </div>
  );
}

export function CollectionPanel() {
  const characterId = useDeckBuilderStore((s) => s.characterId);
  const filters = useDeckBuilderStore((s) => s.filters);
  const sortBy = useDeckBuilderStore((s) => s.sortBy);
  const entries = useDeckBuilderStore((s) => s.currentDeck.entries);
  const setFilter = useDeckBuilderStore((s) => s.setFilter);
  const setSortBy = useDeckBuilderStore((s) => s.setSortBy);
  const resetFilters = useDeckBuilderStore((s) => s.resetFilters);

  const [inputSearch, setInputSearch] = useState("");
  const debouncedSearch = useDebounce(inputSearch, 80);

  useEffect(() => {
    setFilter("search", debouncedSearch);
  }, [debouncedSearch, setFilter]);

  const allCards = useMemo(
    () => getCharacterCards(characterId),
    [characterId],
  );

  const filteredCards = useMemo(
    () => filterAndSortCards(allCards, filters, sortBy, entries),
    [allCards, filters, sortBy, entries],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <FilterBar
        filters={filters}
        sortBy={sortBy}
        searchValue={inputSearch}
        onSearchChange={setInputSearch}
        onFilterChange={setFilter}
        onSortChange={setSortBy}
        onReset={resetFilters}
        totalShown={filteredCards.length}
        totalAvailable={allCards.length}
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          scrollbarWidth: "thin",
          scrollbarColor: `${COLORS.gold}44 transparent`,
        }}
      >
        {characterId === null ? (
          <CharacterSelectPrompt />
        ) : filteredCards.length === 0 ? (
          <EmptyFilterResult onReset={resetFilters} />
        ) : (
          <CollectionGrid cards={filteredCards} />
        )}
      </div>
    </div>
  );
}
