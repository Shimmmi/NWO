"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import { Zap } from "lucide-react";
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
        <planeGeometry args={[2.4, 1.6]} />
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
      }}
    >
      <div style={{ height: 200, position: "relative", background: "#0a0a12" }}>
        {use3d ? (
          <Suspense
            fallback={<CardArtFallback card={card} rarityColor={rarity.color} />}
          >
            <Canvas
              camera={{ position: [0, 0, 2.5] }}
              style={{ width: "100%", height: "100%" }}
              onCreated={() => {
                /* texture load errors handled below via timeout fallback */
              }}
              onError={() => setUse3d(false)}
            >
              <ambientLight intensity={0.6} />
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
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #FFE566, #CC8800)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `900 22px ${TYPOGRAPHY.ui}`,
            color: "#1A0000",
            boxShadow: "0 0 16px rgba(255,215,0,0.7)",
            border: "2px solid rgba(255,255,255,0.3)",
            zIndex: 2,
          }}
        >
          {card.cost}
        </div>
      </div>

      <div style={{ padding: "12px 16px 14px" }}>
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${rarity.color}, transparent)`,
            marginBottom: 10,
          }}
        />
        <div
          style={{
            font: `700 16px ${TYPOGRAPHY.display}`,
            color: COLORS.text_primary,
            textShadow: `0 0 10px ${rarity.color}66`,
            marginBottom: 8,
          }}
        >
          {card.name}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <Tag color={rarity.color} label={rarity.label} />
          <Tag color={TYPE_COLOR[card.type]} label={TYPE_LABEL[card.type]} />
        </div>
        <div
          style={{
            font: `400 13px ${TYPOGRAPHY.body}`,
            color: COLORS.text_secondary,
            lineHeight: 1.55,
          }}
        >
          {card.description}
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: `600 12px ${TYPOGRAPHY.ui}`,
            color: COLORS.text_secondary,
          }}
        >
          <Zap size={13} color="#FFD700" />
          <span>
            Скорость: <span style={{ color: "#FFD700" }}>{card.speed}</span>
          </span>
        </div>
        {card.flavorText && (
          <div
            style={{
              marginTop: 10,
              font: `italic 400 12px ${TYPOGRAPHY.body}`,
              color: COLORS.text_secondary,
              opacity: 0.7,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 8,
            }}
          >
            &ldquo;{card.flavorText}&rdquo;
          </div>
        )}
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
