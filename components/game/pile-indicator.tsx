"use client";

import Image from "next/image";
import { getCardBackUrl } from "@/lib/game/art";
import { cn } from "@/lib/utils";

interface PileIndicatorProps {
  count: number;
  label: string;
  className?: string;
  onClick?: () => void;
}

export function PileIndicator({ count, label, className, onClick }: PileIndicatorProps) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1",
        onClick && "cursor-pointer hover:opacity-80",
        className,
      )}
    >
      <div className="relative h-16 w-12">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-md border border-zinc-600 shadow"
            style={{
              top: i * 2,
              left: i * 2,
              width: 48,
              height: 64,
              zIndex: 3 - i,
              opacity: count > 0 ? 1 - i * 0.15 : 0.3,
            }}
          >
            <Image
              src={getCardBackUrl()}
              alt=""
              width={48}
              height={64}
              className="h-full w-full rounded-md object-cover"
              unoptimized
            />
          </div>
        ))}
        {count === 0 && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-zinc-900/80 text-xs text-zinc-500">
            0
          </div>
        )}
      </div>
      <span className="text-xs text-zinc-400">
        {label}: {count}
      </span>
    </Wrapper>
  );
}
