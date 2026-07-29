"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/design/tokens";

export interface BattleResultStats {
  totalTurns: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  cardsPlayed: number;
  totalHealed: number;
  maxDamageInOneTurn: number;
}

interface BattleResultProps {
  winner: 1 | 2 | null;
  playerNum: 1 | 2;
  stats: BattleResultStats;
  onContinue?: () => void;
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <div
        className="font-ui text-2xl font-bold tabular-nums"
        style={{ color: color ?? COLORS.text_primary }}
      >
        {value}
      </div>
      <div
        className="font-body text-xs"
        style={{ color: COLORS.text_secondary }}
      >
        {label}
      </div>
    </div>
  );
}

export function BattleResult({
  winner,
  playerNum,
  stats,
  onContinue,
}: BattleResultProps) {
  const router = useRouter();
  const isWin = winner === playerNum;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[200] flex flex-col items-center justify-center gap-6"
      style={{
        background: isWin
          ? "radial-gradient(ellipse at center, rgba(212,175,55,0.3), rgba(0,0,0,0.95))"
          : "radial-gradient(ellipse at center, rgba(200,0,0,0.22), rgba(0,0,0,0.95))",
      }}
    >
      {isWin && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                left: `${(i * 37) % 100}%`,
                background: i % 2 === 0 ? COLORS.gold : COLORS.red_hot,
              }}
              initial={{ y: -20, opacity: 1 }}
              animate={{ y: "110vh", opacity: 0 }}
              transition={{
                duration: 2.5 + (i % 5) * 0.3,
                delay: (i % 8) * 0.12,
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", delay: 0.25 }}
        className="font-display text-center text-6xl tracking-[0.2em] md:text-7xl"
        style={{
          color: isWin ? COLORS.gold : "#CC2200",
          textShadow: `0 0 60px ${isWin ? COLORS.gold_glow : COLORS.red_glow}`,
        }}
      >
        {isWin ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="grid grid-cols-3 gap-x-8 gap-y-4 rounded-2xl px-10 py-6 text-center"
        style={{
          background: COLORS.bg_glass,
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <StatItem label="Ходов" value={stats.totalTurns} />
        <StatItem
          label="Нанесено урона"
          value={stats.totalDamageDealt}
          color={COLORS.red_hot}
        />
        <StatItem
          label="Получено урона"
          value={stats.totalDamageTaken}
          color={COLORS.text_secondary}
        />
        <StatItem label="Карт сыграно" value={stats.cardsPlayed} />
        <StatItem
          label="Исцелено"
          value={stats.totalHealed}
          color={COLORS.text_heal}
        />
        <StatItem
          label="Макс. урон за ход"
          value={stats.maxDamageInOneTurn}
          color={COLORS.gold}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="flex gap-4"
      >
        <Button
          variant="outline"
          onClick={() => router.push("/game/ai")}
          className="font-ui min-w-[140px]"
        >
          Реванш
        </Button>
        <Button
          onClick={() => (onContinue ? onContinue() : router.push("/"))}
          className="font-ui min-w-[160px]"
          style={{
            background: `linear-gradient(135deg, ${COLORS.gold}, #B8860B)`,
            color: "#1A0000",
          }}
        >
          В главное меню
        </Button>
      </motion.div>
    </motion.div>
  );
}
