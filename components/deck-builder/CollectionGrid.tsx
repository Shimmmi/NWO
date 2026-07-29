"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DECK_RARITY_CONFIG } from "@/components/deck-builder/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { getCardArtUrl, getCardFallbackUrl } from "@/lib/game/art";
import type { FilteredCard } from "@/lib/game/deckTypes";
import type { AbilityCard } from "@/lib/game/types";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

function CopyDots({
  current,
  max,
  color,
}: {
  current: number;
  max: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            background: i < current ? color : "rgba(255,255,255,0.15)",
            scale: i < current && i === current - 1 ? [1, 1.4, 1] : 1,
          }}
          transition={{ duration: 0.25 }}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            boxShadow: i < current ? `0 0 4px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function CollectionCardItem({
  card,
  countInDeck,
  maxCopies,
  canAdd,
}: {
  card: AbilityCard;
  countInDeck: number;
  maxCopies: number;
  canAdd: boolean;
}) {
  const addCard = useDeckBuilderStore((s) => s.addCard);
  const setPreviewCard = useDeckBuilderStore((s) => s.setPreviewCard);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [imgSrc, setImgSrc] = useState(getCardArtUrl(card.id, card.rarity));
  const rarity = DECK_RARITY_CONFIG[card.rarity];
  const ref = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const result = addCard(card);
    if (!result.success && result.reason) {
      setAddResult(result.reason);
      setTimeout(() => setAddResult(null), 1800);
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      whileHover={{ scale: canAdd ? 1.04 : 1, zIndex: 10 }}
      onMouseEnter={() => setPreviewCard(card)}
      onMouseLeave={() => setPreviewCard(null)}
      onClick={canAdd ? handleAdd : undefined}
      data-card-id={card.id}
      style={{
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
        background: COLORS.bg_card,
        border:
          countInDeck > 0
            ? `1.5px solid ${rarity.color}`
            : "1px solid rgba(255,255,255,0.08)",
        cursor: canAdd ? "pointer" : "not-allowed",
        opacity: canAdd ? 1 : 0.5,
        boxShadow: countInDeck > 0 ? `0 0 10px ${rarity.color}44` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <div style={{ height: 80, overflow: "hidden", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={card.name}
          onError={() => setImgSrc(getCardFallbackUrl(card.rarity))}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {!canAdd && countInDeck === maxCopies && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                font: `700 11px ${TYPOGRAPHY.ui}`,
                color: "#FFD700",
              }}
            >
              МАХ
            </span>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 5,
            left: 5,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "radial-gradient(circle, #FFD700, #B8860B)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `700 12px ${TYPOGRAPHY.ui}`,
            color: "#1A0000",
            border: "1.5px solid rgba(255,255,255,0.3)",
          }}
        >
          {card.cost}
        </div>
      </div>

      <div style={{ padding: "5px 7px 6px" }}>
        <div
          style={{
            font: `600 10px ${TYPOGRAPHY.display}`,
            color: COLORS.text_primary,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.name}
        </div>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <CopyDots
            current={countInDeck}
            max={maxCopies}
            color={rarity.color}
          />
          <span
            style={{
              font: `500 11px ${TYPOGRAPHY.ui}`,
              color: rarity.color,
              letterSpacing: "0.5px",
            }}
          >
            {card.rarity.slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: rarity.color,
          opacity: countInDeck > 0 ? 1 : 0.4,
        }}
      />

      <AnimatePresence>
        {addResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(200,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
              textAlign: "center",
              font: `600 10px ${TYPOGRAPHY.ui}`,
              color: "#fff",
              borderRadius: 10,
              zIndex: 20,
            }}
          >
            {addResult}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CollectionGrid({ cards }: { cards: FilteredCard[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 10,
      }}
    >
      <AnimatePresence mode="popLayout">
        {cards.map(({ card, countInDeck, maxCopies, canAdd }) => (
          <CollectionCardItem
            key={card.id}
            card={card}
            countInDeck={countInDeck}
            maxCopies={maxCopies}
            canAdd={canAdd}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
