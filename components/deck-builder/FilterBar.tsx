"use client";

import { Search, X } from "lucide-react";
import {
  DECK_RARITY_CONFIG,
} from "@/components/deck-builder/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import type { DeckFilters, DeckSortOption } from "@/lib/game/deckTypes";
import type { AbilityCard } from "@/lib/game/types";

type Props = {
  filters: DeckFilters;
  sortBy: DeckSortOption;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onFilterChange: <K extends keyof DeckFilters>(
    key: K,
    value: DeckFilters[K],
  ) => void;
  onSortChange: (sort: DeckSortOption) => void;
  onReset: () => void;
  totalShown: number;
  totalAvailable: number;
};

function RarityPill({
  rarity,
  active,
  onClick,
}: {
  rarity: AbilityCard["rarity"] | "all";
  active: boolean;
  onClick: () => void;
}) {
  const color =
    rarity === "all" ? COLORS.gold : DECK_RARITY_CONFIG[rarity].color;
  const label =
    rarity === "all" ? "Все" : rarity.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : COLORS.text_secondary,
        font: `600 12px ${TYPOGRAPHY.ui}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function CostRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ font: `500 11px ${TYPOGRAPHY.ui}`, color: COLORS.text_secondary }}>
        Стоимость
      </span>
      {[0, 1, 2, 3, 4, 5, 6].map((c) => {
        const active = c >= min && c <= max;
        return (
          <button
            key={c}
            type="button"
            onClick={() => {
              if (c < min) onChange(c, max);
              else if (c > max) onChange(min, c);
              else if (c === min && c === max) onChange(0, 6);
              else if (c === min) onChange(c + 1, max);
              else if (c === max) onChange(min, c - 1);
              else onChange(c, c);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: `1px solid ${active ? COLORS.gold : "rgba(255,255,255,0.15)"}`,
              background: active ? `${COLORS.gold}33` : "transparent",
              color: active ? COLORS.gold : COLORS.text_secondary,
              font: `700 11px ${TYPOGRAPHY.ui}`,
              cursor: "pointer",
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "none",
        border: "none",
        cursor: "pointer",
        font: `500 12px ${TYPOGRAPHY.ui}`,
        color: checked ? COLORS.gold : COLORS.text_secondary,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${checked ? COLORS.gold : "rgba(255,255,255,0.25)"}`,
          background: checked ? COLORS.gold : "transparent",
        }}
      />
      {label}
    </button>
  );
}

export function FilterBar({
  filters,
  sortBy,
  searchValue,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onReset,
  totalShown,
  totalAvailable,
}: Props) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.rarity !== "all" ||
    filters.type !== "all" ||
    filters.pool !== "all" ||
    filters.costMin !== 0 ||
    filters.costMax !== 6 ||
    filters.showOnlyInDeck ||
    filters.showOnlyAvailable;

  const selectStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "4px 8px",
    font: `500 12px ${TYPOGRAPHY.ui}`,
    color: COLORS.text_primary,
  };

  return (
    <div
      style={{
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: COLORS.bg_surface,
      }}
    >
      <div style={{ position: "relative" }}>
        <Search
          size={15}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: COLORS.text_secondary,
          }}
        />
        <input
          placeholder="Найти карту..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: "100%",
            paddingLeft: 32,
            paddingRight: 10,
            height: 34,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            font: `400 14px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_primary,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["all", "common", "rare", "epic", "legendary"] as const).map((r) => (
          <RarityPill
            key={r}
            rarity={r}
            active={filters.rarity === r}
            onClick={() => onFilterChange("rarity", r)}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={filters.type}
          onChange={(e) =>
            onFilterChange("type", e.target.value as DeckFilters["type"])
          }
          style={selectStyle}
        >
          <option value="all">Все типы</option>
          <option value="active">Активные</option>
          <option value="passive">Пассивные</option>
          <option value="ultimate">Ультимейты</option>
        </select>

        <select
          value={filters.pool}
          onChange={(e) =>
            onFilterChange("pool", e.target.value as DeckFilters["pool"])
          }
          style={selectStyle}
        >
          <option value="all">Все пулы</option>
          <option value="faction">Фракция</option>
          <option value="neutral">Нейтралы</option>
        </select>

        <CostRangeSlider
          min={filters.costMin}
          max={filters.costMax}
          onChange={(min, max) => {
            onFilterChange("costMin", min);
            onFilterChange("costMax", max);
          }}
        />

        <div style={{ flex: 1 }} />

        <span
          style={{
            font: `400 12px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
          }}
        >
          {totalShown}/{totalAvailable}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            style={{
              color: COLORS.text_secondary,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              font: `500 12px ${TYPOGRAPHY.ui}`,
            }}
          >
            <X size={13} /> Сбросить
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Toggle
          label="Только в деке"
          checked={filters.showOnlyInDeck}
          onChange={(v) => onFilterChange("showOnlyInDeck", v)}
        />
        <Toggle
          label="Можно добавить"
          checked={filters.showOnlyAvailable}
          onChange={(v) => onFilterChange("showOnlyAvailable", v)}
        />
        <div style={{ flex: 1 }} />
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as DeckSortOption)}
          style={selectStyle}
        >
          <option value="cost_asc">Стоимость ↑</option>
          <option value="cost_desc">Стоимость ↓</option>
          <option value="name_asc">Имя</option>
          <option value="rarity_desc">Редкость</option>
          <option value="in_deck_first">В деке сначала</option>
        </select>
      </div>
    </div>
  );
}
