import type { Match } from "@/lib/game/types";
import { getCharacterById } from "@/lib/data";
import { parseEffectValue } from "@/lib/game/cards";
import type { AIDifficulty } from "@/lib/game/balance";
import {
  getEffectiveCardCost,
  hasSkipAbility,
  scoreCard,
  validateCardSelection,
} from "@/lib/game/effects";

export function makeAiAbilityDecision(
  match: Match,
  playerNum: 1 | 2,
  difficulty: AIDifficulty = "normal",
): string | "pass" {
  const player = playerNum === 1 ? match.player1 : match.player2;
  if (hasSkipAbility(player)) return "pass";

  const character = getCharacterById(player.characterId);
  if (!character) return "pass";

  const opponent = playerNum === 1 ? match.player2 : match.player1;
  const affordable = character.uniqueAbilities.filter(
    (a) => player.charges >= a.chargeCost,
  );
  if (affordable.length === 0) return "pass";

  if (difficulty === "easy") {
    if (Math.random() < 0.55) return "pass";
    return affordable[Math.floor(Math.random() * affordable.length)].id;
  }

  const scored = affordable.map((a) => ({
    id: a.id,
    score: parseEffectValue(a.effect) / a.chargeCost,
  }));
  scored.sort((a, b) => b.score - a.score);

  if (opponent.hp / opponent.maxHp < 0.4 && scored[0].score > 5) {
    return scored[0].id;
  }

  if (player.hp / player.maxHp < 0.35) {
    const healAbility = affordable.find((a) => a.effect.includes("heal"));
    if (healAbility) return healAbility.id;
  }

  if (difficulty === "hard") {
    if (Math.random() < 0.15) return "pass";
    return scored[0].id;
  }

  if (Math.random() < 0.35) return "pass";
  return scored[0].id;
}

export function makeAiBattleDecision(
  match: Match,
  playerNum: 1 | 2,
  difficulty: AIDifficulty = "normal",
): string | "pass" {
  const player = playerNum === 1 ? match.player1 : match.player2;
  const opponent = playerNum === 1 ? match.player2 : match.player1;

  const affordable = player.hand.filter(
    (c) => getEffectiveCardCost(player, c) <= player.energy,
  );
  if (affordable.length === 0) return "pass";

  if (difficulty === "easy") {
    const pick = affordable[Math.floor(Math.random() * affordable.length)];
    const ids = validateCardSelection(player, [pick.id]);
    return ids.length > 0 ? ids[0] : "pass";
  }

  const playerHpRatio = player.hp / player.maxHp;
  const opponentHpRatio = opponent.hp / opponent.maxHp;

  const scored = affordable.map((card) => {
    let score = scoreCard(card, player, opponent);
    const eff = card.effect;

    const dmgMatch = eff.match(/damage:(\d+)/);
    if (dmgMatch) score += parseInt(dmgMatch[1], 10) * 0.8;

    const blockMatch = eff.match(/block:(\d+)/);
    if (blockMatch) {
      score += parseInt(blockMatch[1], 10) * (playerHpRatio < 0.4 ? 1.5 : 0.5);
    }

    if (eff.includes("heal")) score += playerHpRatio < 0.3 ? 40 : 10;
    score += card.cost * 3;

    if (card.type === "ultimate" && opponentHpRatio < 0.4) score += 30;

    if (difficulty === "hard") {
      if (
        opponent.activeEffects.some((e) => e.type === "block") &&
        eff.includes("armor_ignore")
      ) {
        score += 25;
      }
      if (player.energy <= 2) score -= card.cost * 5;
      if (opponentHpRatio < 0.25 && dmgMatch) score += 35;
    }

    return { id: card.id, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (difficulty === "normal" && Math.random() < 0.1 && affordable.length > 1) {
    return "pass";
  }

  const ids = validateCardSelection(player, [scored[0].id]);
  return ids.length > 0 ? ids[0] : "pass";
}

/** Multi-card selection for hard AI (ability-style batch). */
export function makeAiDecision(
  match: Match,
  playerNum: 1 | 2,
  difficulty: AIDifficulty = "normal",
): string[] {
  const player = playerNum === 1 ? match.player1 : match.player2;
  const opponent = playerNum === 1 ? match.player2 : match.player1;

  if (difficulty === "easy") {
    const affordable = player.hand.filter(
      (c) => getEffectiveCardCost(player, c) <= player.energy,
    );
    return affordable.length > 0
      ? [affordable[Math.floor(Math.random() * affordable.length)].id]
      : [];
  }

  const decision = makeAiBattleDecision(match, playerNum, difficulty);
  if (decision === "pass") return [];

  const selected = [decision];
  if (difficulty === "hard") {
    const first = player.hand.find((c) => c.id === decision);
    if (first) {
      const remainingEnergy =
        player.energy - getEffectiveCardCost(player, first);
      const second = player.hand
        .filter(
          (c) =>
            c.id !== decision && getEffectiveCardCost(player, c) <= remainingEnergy,
        )
        .map((c) => ({ id: c.id, score: scoreCard(c, player, opponent) }))
        .sort((a, b) => b.score - a.score)[0];
      if (second) selected.push(second.id);
    }
  }

  return validateCardSelection(player, selected);
}
