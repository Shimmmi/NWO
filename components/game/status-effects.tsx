"use client";

import { motion } from "framer-motion";
import type { ActiveEffect, EffectType } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export const EFFECT_ICONS: Record<
  EffectType,
  { icon: string; color: string; label: string }
> = {
  block: { icon: "🛡️", color: "#4A90D9", label: "Блок" },
  distraction: { icon: "😵", color: "#E74C3C", label: "Помехи" },
  invulnerability: { icon: "✨", color: "#F1C40F", label: "Неуязв." },
  strength_up: { icon: "⬆️", color: "#E74C3C", label: "Сила" },
  strength_down: { icon: "⬇️", color: "#95A5A6", label: "Ослабление" },
  energy_steal: { icon: "⚡", color: "#9B59B6", label: "Кража ⚡" },
  armor_ignore: { icon: "🔥", color: "#E67E22", label: "Пробой" },
  heal: { icon: "💚", color: "#2ECC71", label: "Лечение" },
  propaganda: { icon: "📺", color: "#E74C3C", label: "Пропаганда" },
  sanction: { icon: "🚫", color: "#E74C3C", label: "Санкции" },
  cost_reduce: { icon: "💸", color: "#F1C40F", label: "Скидка" },
  skip_ability: { icon: "⏭️", color: "#8A9BA8", label: "Пропуск" },
  draw_next: { icon: "🃏", color: "#4A90D9", label: "Добор" },
  block_hand: { icon: "🔒", color: "#E67E22", label: "Блок руки" },
  damage_block: { icon: "🧱", color: "#3498DB", label: "Щит урона" },
};

interface StatusEffectsProps {
  effects: ActiveEffect[];
  className?: string;
}

export function StatusEffects({ effects, className }: StatusEffectsProps) {
  if (effects.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1 font-ui", className)}>
      {effects.map((effect, i) => {
        const config = EFFECT_ICONS[effect.type];
        return (
          <motion.div
            key={`${effect.type}-${effect.source}-${i}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            title={`${config.label}: ${effect.value} (ещё ${effect.duration} ход.)`}
            className="flex cursor-help items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              background: `${config.color}22`,
              border: `1px solid ${config.color}88`,
              color: config.color,
            }}
          >
            <span className="text-xs leading-none" aria-hidden>
              {config.icon}
            </span>
            <span>{effect.duration}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
