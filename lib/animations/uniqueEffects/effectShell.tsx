"use client";

import type { CSSProperties, ReactNode } from "react";

export function EffectShell({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type EffectProps = {
  color?: string;
  secondary?: string;
  targetPlayer?: 1 | 2;
};
