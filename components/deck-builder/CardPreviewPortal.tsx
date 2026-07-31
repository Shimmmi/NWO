"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import {
  DECK_RARITY_CONFIG,
  TYPE_COLOR,
  TYPE_LABEL,
} from "@/components/deck-builder/constants";
import { COLORS, TYPOGRAPHY } from "@/lib/design/tokens";
import { getCardArtUrl, getCardFallbackUrl } from "@/lib/game/art";
import type { AbilityCard } from "@/lib/game/types";
import { useDeckBuilderStore } from "@/lib/stores/deckBuilderStore";

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        border: `1px solid ${color}66`,
        background: `${color}18`,
        font: `600 11px ${TYPOGRAPHY.ui}`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function RotatingCardArt({
  url,
  rarityColor,
}: {
  url: string;
  rarityColor: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = Math.sin(t * 0.7) * 0.25;
    meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.08;
  });

  return (
    <>
      <mesh ref={meshRef}>
        {/* Portrait 2:3 plane — fills the preview canvas */}
        <planeGeometry args={[1.6, 2.4]} />
        <meshBasicMaterial map={texture} transparent />
      </mesh>
      <pointLight color={rarityColor} intensity={2} distance={3} />
    </>
  );
}

function CardArtFallback({
  card,
  rarityColor,
}: {
  card: AbilityCard;
  rarityColor: string;
}) {
  const [src, setSrc] = useState(getCardArtUrl(card.id, card.rarity));
  return (
    <motion.div
      animate={{ rotateY: [-8, 8, -8], rotateX: [2, -2, 2] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        boxShadow: `0 0 24px ${rarityColor}33`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={card.name}
        onError={() => setSrc(getCardFallbackUrl(card.rarity))}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </motion.div>
  );
}

function Gem({
  value,
  side,
  icon,
}: {
  value: number;
  side: "left" | "right";
  icon?: "cost" | "speed";
}) {
  const isCost = icon !== "speed";
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        [side]: 10,
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: isCost
          ? "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)"
          : "radial-gradient(circle at 35% 35%, #7DD3FC, #0369A1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        font: `900 18px ${TYPOGRAPHY.ui}`,
        color: isCost ? "#1A0000" : "#F0F9FF",
        boxShadow: isCost
          ? "0 0 14px rgba(255,215,0,0.65)"
          : "0 0 14px rgba(56,189,248,0.55)",
        border: "2px solid rgba(255,255,255,0.3)",
        zIndex: 2,
      }}
      aria-label={isCost ? `Стоимость ${value}` : `Скорость ${value}`}
    >
      {isCost ? (
        value
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Gauge size={12} strokeWidth={2.5} />
          {value}
        </span>
      )}
    </div>
  );
}

function CardPreview3D({ card }: { card: AbilityCard }) {
  const rarity = DECK_RARITY_CONFIG[card.rarity];
  const artUrl = getCardArtUrl(card.id, card.rarity);
  const [use3d, setUse3d] = useState(true);

  return (
    <div
      style={{
        width: 280,
        height: 420,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: `0 24px 60px rgba(0,0,0,0.8), 0 0 30px ${rarity.color}44`,
        border: `2px solid ${rarity.color}`,
        background: COLORS.bg_card,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Art fills ≥85% of preview body */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          height: "85%",
          position: "relative",
          background: "#0a0a12",
        }}
      >
        {use3d ? (
          <Suspense
            fallback={<CardArtFallback card={card} rarityColor={rarity.color} />}
          >
            <Canvas
              camera={{ position: [0, 0, 3.2], fov: 42 }}
              style={{ width: "100%", height: "100%" }}
              onError={() => setUse3d(false)}
            >
              <ambientLight intensity={0.65} />
              <pointLight
                position={[2, 2, 2]}
                intensity={1.5}
                color={rarity.color}
              />
              <RotatingCardArt url={artUrl} rarityColor={rarity.color} />
            </Canvas>
          </Suspense>
        ) : (
          <CardArtFallback card={card} rarityColor={rarity.color} />
        )}
        <Gem value={card.cost} side="left" icon="cost" />
        <Gem value={card.speed} side="right" icon="speed" />
      </div>

      <div style={{ padding: "8px 12px 10px", flexShrink: 0 }}>
        <div
          style={{
            font: `700 14px ${TYPOGRAPHY.display}`,
            color: COLORS.text_primary,
            textShadow: `0 0 10px ${rarity.color}66`,
            marginBottom: 6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.name}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <Tag color={rarity.color} label={rarity.label} />
          <Tag color={TYPE_COLOR[card.type]} label={TYPE_LABEL[card.type]} />
        </div>
        <div
          style={{
            font: `400 12px ${TYPOGRAPHY.body}`,
            color: COLORS.text_secondary,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {card.description}
        </div>
      </div>
    </div>
  );
}

export function CardPreviewPortal() {
  const previewCard = useDeckBuilderStore((s) => s.previewCard);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handler = (e: MouseEvent) =>
      setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  if (!mounted) return null;

  const previewWidth = 280;
  const previewHeight = 420;
  const margin = 16;
  const x =
    mousePos.x + 20 + previewWidth > window.innerWidth
      ? mousePos.x - previewWidth - 20
      : mousePos.x + 20;
  const y = Math.min(
    Math.max(margin, mousePos.y - 60),
    window.innerHeight - previewHeight - margin,
  );

  return createPortal(
    <AnimatePresence>
      {previewCard && (
        <motion.div
          key={previewCard.id}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          style={{
            position: "fixed",
            left: x,
            top: y,
            width: previewWidth,
            zIndex: 99999,
            pointerEvents: "none",
            transformOrigin: "top left",
          }}
        >
          <CardPreview3D card={previewCard} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
