import type {
  AbilityCard,
  ActiveEffect,
  CombatEvent,
  Match,
  MatchPlayer,
  PlayedCard,
} from "@/lib/game/types";
import { getPlayerMaxHand } from "@/lib/game/types";
import {
  getEffectNumber,
  hasEffect,
  inferCardCategory,
  parseEffectTags,
} from "@/lib/game/cards";
import { BALANCE } from "@/lib/game/balance";
import { applyRelic } from "@/lib/game/relics";

export interface DamageResult {
  player: MatchPlayer;
  damageDealt: number;
  missed?: boolean;
  isCrit?: boolean;
  armorAbsorbed?: number;
  isBlocked?: boolean;
  rawDamage?: number;
}

export function addEffect(
  player: MatchPlayer,
  effect: ActiveEffect,
): MatchPlayer {
  return {
    ...player,
    activeEffects: [...player.activeEffects, effect],
  };
}

export function getEffectiveCardCost(
  player: MatchPlayer,
  card: AbilityCard,
): number {
  let cost = card.cost;
  const costReduce = player.activeEffects
    .filter((e) => e.type === "cost_reduce")
    .reduce((sum, e) => sum + e.value, 0);
  cost = Math.max(0, cost - costReduce);
  if (player.activeEffects.some((e) => e.source === "free-cards")) {
    return 0;
  }
  return cost;
}

export function getSanctionPenalty(player: MatchPlayer): number {
  return player.activeEffects
    .filter((e) => e.type === "sanction")
    .reduce((sum, e) => sum + e.value, 0);
}

export function applyCardCost(
  player: MatchPlayer,
  card: AbilityCard,
): MatchPlayer {
  const cost = getEffectiveCardCost(player, card);
  return {
    ...player,
    energy: Math.max(0, player.energy - cost),
  };
}

export function applyHeal(player: MatchPlayer, amount: number): MatchPlayer {
  return {
    ...player,
    hp: Math.min(player.maxHp, Math.max(0, player.hp + amount)),
  };
}

function getPlayerBlock(player: MatchPlayer): number {
  return player.activeEffects
    .filter((e) => e.type === "block" && e.value >= 1)
    .reduce((sum, e) => sum + e.value, 0);
}

function hasInvulnerability(player: MatchPlayer): boolean {
  return player.activeEffects.some((e) => e.type === "invulnerability");
}

function hasDamageBlockThreshold(player: MatchPlayer): number | null {
  const block = player.activeEffects.find((e) => e.type === "damage_block");
  return block ? block.value : null;
}

function hasPropaganda(player: MatchPlayer): boolean {
  return player.activeEffects.some((e) => e.type === "propaganda");
}

function getStrengthBonus(player: MatchPlayer): number {
  return player.activeEffects
    .filter(
      (e) =>
        e.type === "strength_up" &&
        !e.source.includes("zelenko") &&
        !e.source.startsWith("speed-"),
    )
    .reduce((sum, e) => sum + e.value, 0);
}

function getStrengthPenalty(player: MatchPlayer): number {
  return player.activeEffects
    .filter((e) => e.type === "strength_down")
    .reduce((sum, e) => sum + e.value, 0);
}

export function removeCardsFromHand(
  player: MatchPlayer,
  cardIds: string[],
): MatchPlayer {
  const idSet = new Set(cardIds);
  const played = player.hand.filter((c) => idSet.has(c.id));
  const hand = player.hand.filter((c) => !idSet.has(c.id));
  return {
    ...player,
    hand,
    discardPile: [...player.discardPile, ...played],
  };
}

function drawCards(player: MatchPlayer, count: number): MatchPlayer {
  let deck = [...player.deck];
  let discard = [...player.discardPile];
  const hand = [...player.hand];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle([...discard]);
      discard = [];
    }
    const card = deck.shift();
    if (card) hand.push(card);
  }

  return { ...player, deck, discardPile: discard, hand };
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function recycleFromDiscard(
  player: MatchPlayer,
  count: number,
): MatchPlayer {
  if (player.discardPile.length === 0) return player;
  const discard = [...player.discardPile];
  const hand = [...player.hand];
  for (let i = 0; i < count && discard.length > 0; i++) {
    const idx = Math.floor(Math.random() * discard.length);
    const [card] = discard.splice(idx, 1);
    hand.push(card);
  }
  return { ...player, discardPile: discard, hand };
}

export function applyDamage(
  target: MatchPlayer,
  rawDamage: number,
  options: {
    ignoreArmor?: boolean;
    ignoreDefense?: boolean;
    attackerStrength?: number;
    checkPropaganda?: boolean;
    canCrit?: boolean;
    tempDamageBonus?: number;
  } = {},
): DamageResult {
  if (rawDamage <= 0) {
    return { player: target, damageDealt: 0, rawDamage: 0 };
  }

  if (options.checkPropaganda !== false && hasPropaganda(target)) {
    if (Math.random() < 0.5) {
      return {
        player: target,
        damageDealt: 0,
        missed: true,
        rawDamage,
      };
    }
  }

  const damageBlockThreshold = hasDamageBlockThreshold(target);
  if (damageBlockThreshold !== null && rawDamage > damageBlockThreshold) {
    return {
      player: target,
      damageDealt: 0,
      missed: true,
      rawDamage,
    };
  }

  if (!options.ignoreDefense && hasInvulnerability(target)) {
    return {
      player: target,
      damageDealt: 0,
      isBlocked: true,
      rawDamage,
    };
  }

  let damage = Math.floor(
    (rawDamage + (options.attackerStrength ?? 0) + (options.tempDamageBonus ?? 0)) *
      BALANCE.BASE_DAMAGE_MULTIPLIER,
  );

  let isCrit = false;
  if (options.canCrit !== false && Math.random() < BALANCE.CRIT_CHANCE) {
    damage = Math.floor(damage * BALANCE.CRIT_MULTIPLIER);
    isCrit = true;
  }

  const blockPercent = target.activeEffects
    .filter((e) => e.type === "block" && e.value > 0 && e.value < 1)
    .reduce((max, e) => Math.max(max, e.value), 0);
  if (blockPercent > 0) {
    damage = Math.floor(damage * (1 - blockPercent));
  }

  const flatBlock = getPlayerBlock(target);
  if (!options.ignoreDefense && flatBlock > 0) {
    damage = Math.max(0, damage - flatBlock);
  }

  let armorAbsorbed = 0;
  if (!options.ignoreArmor) {
    const effectiveArmor = Math.floor(
      target.armor * BALANCE.BASE_ARMOR_MULTIPLIER,
    );
    const maxAbsorb = Math.floor(damage * BALANCE.ARMOR_CAP_RATIO);
    armorAbsorbed = Math.min(effectiveArmor, maxAbsorb);
    damage = Math.max(1, damage - armorAbsorbed);
  }

  const finalDamage = Math.max(0, damage);
  let hp = target.hp - finalDamage;

  if (
    hp <= 0 &&
    target.activeEffects.some((e) => e.source.includes("survive"))
  ) {
    hp = 1;
  }

  return {
    player: { ...target, hp },
    damageDealt: finalDamage,
    isCrit,
    armorAbsorbed,
    isBlocked: finalDamage === 0 && rawDamage > 0,
    rawDamage,
  };
}

function applyEffectTag(
  attacker: MatchPlayer,
  defender: MatchPlayer,
  card: AbilityCard,
  tags: Record<string, number | boolean>,
  context: {
    lastOpponentCard?: AbilityCard;
    nextOpponentCard?: AbilityCard;
  } = {},
): { attacker: MatchPlayer; defender: MatchPlayer; events: string[] } {
  const events: string[] = [];
  let a = attacker;
  let d = defender;
  const strengthBonus = getStrengthBonus(a) - getStrengthPenalty(a);

  if (hasEffect(card.effect, "copy_last") && context.lastOpponentCard) {
    const copyTags = parseEffectTags(context.lastOpponentCard.effect);
    const copyResult = applyEffectTag(
      a,
      d,
      context.lastOpponentCard,
      copyTags,
      context,
    );
    a = copyResult.attacker;
    d = copyResult.defender;
    events.push(`${card.name}: копия «${context.lastOpponentCard.name}»`);
    events.push(...copyResult.events);
    return { attacker: a, defender: d, events };
  }

  if (hasEffect(card.effect, "copy_next") && context.nextOpponentCard) {
    const copyTags = parseEffectTags(context.nextOpponentCard.effect);
    const copyResult = applyEffectTag(
      a,
      d,
      context.nextOpponentCard,
      copyTags,
      context,
    );
    a = copyResult.attacker;
    d = copyResult.defender;
    events.push(`${card.name}: копия «${context.nextOpponentCard.name}»`);
    events.push(...copyResult.events);
    return { attacker: a, defender: d, events };
  }

  if (typeof tags.damage === "number" && tags.damage > 0) {
    const hits = typeof tags.hits === "number" ? tags.hits : 1;
    const perHit =
      hits > 1
        ? Math.max(0, tags.damage + strengthBonus - 5)
        : tags.damage + strengthBonus;
    const tempBonus = a.tempDamageBonus ?? 0;

    for (let i = 0; i < hits; i++) {
      const result = applyDamage(d, perHit, {
        ignoreArmor: hasEffect(card.effect, "armor_ignore"),
        ignoreDefense: hasEffect(card.effect, "ignore_defense"),
        tempDamageBonus: tempBonus,
      });
      d = result.player;
      if (result.missed) {
        events.push(
          `${card.name}: промах${hits > 1 ? ` (удар ${i + 1})` : ""}`,
        );
      } else if (result.isCrit) {
        events.push(
          `${card.name}: КРИТ ${result.damageDealt} урона${hits > 1 ? ` (удар ${i + 1})` : ""}`,
        );
      } else {
        events.push(
          `${card.name}: ${result.damageDealt} урона${hits > 1 ? ` (удар ${i + 1})` : ""}`,
        );
      }
    }
    if (tempBonus > 0) {
      a = { ...a, tempDamageBonus: 0 };
    }
  }

  if (typeof tags.reflect === "number" && tags.reflect > 0) {
    const result = applyDamage(a, tags.reflect, { checkPropaganda: false });
    a = result.player;
    events.push(`${card.name}: отражено ${result.damageDealt} урона`);
  }

  if (typeof tags.heal === "number" && tags.heal > 0) {
    a = applyHeal(a, tags.heal);
    events.push(`${card.name}: +${tags.heal} HP`);
  }

  if (typeof tags.block === "number" && tags.block > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    if (tags.block >= 999) {
      a = addEffect(a, {
        type: "damage_block",
        value: 30,
        duration,
        source: card.id,
      });
      events.push(`${card.name}: блок урона >30`);
    } else {
      a = addEffect(a, {
        type: "block",
        value: tags.block,
        duration,
        source: card.id,
      });
      events.push(`${card.name}: блок ${tags.block}`);
    }
  }

  if (typeof tags.energy === "number" && tags.energy > 0) {
    a = {
      ...a,
      energy: Math.min(a.maxEnergy, a.energy + tags.energy),
    };
    events.push(`${card.name}: +${tags.energy} энергии`);
  }

  if (typeof tags.energy_steal === "number" && tags.energy_steal > 0) {
    const stolen = Math.min(tags.energy_steal, d.energy);
    a = { ...a, energy: Math.min(a.maxEnergy, a.energy + stolen) };
    d = { ...d, energy: Math.max(0, d.energy - stolen) };
    events.push(`${card.name}: украдено ${stolen} энергии`);
  }

  if (typeof tags.strength_up === "number" && tags.strength_up > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    a = addEffect(a, {
      type: "strength_up",
      value: tags.strength_up,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: +${tags.strength_up} к силе`);
  }

  if (typeof tags.strength_down === "number" && tags.strength_down > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    d = addEffect(d, {
      type: "strength_down",
      value: tags.strength_down,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: -${tags.strength_down} к силе противника`);
  }

  if (typeof tags.distraction === "number" && tags.distraction > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    d = addEffect(d, {
      type: "distraction",
      value: tags.distraction,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: отвлечение -${tags.distraction} скорости`);
  }

  if (typeof tags.propaganda === "number" && tags.propaganda > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    d = addEffect(d, {
      type: "propaganda",
      value: tags.propaganda,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: пропаганда (50% промах)`);
  }

  if (typeof tags.sanction === "number" && tags.sanction > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    d = addEffect(d, {
      type: "sanction",
      value: tags.sanction,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: санкции (+${tags.sanction} к стоимости карт)`);
  }

  if (hasEffect(card.effect, "invulnerability")) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    a = addEffect(a, {
      type: "invulnerability",
      value: 1,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: неуязвимость`);
  }

  if (typeof tags.armor_reduce === "number" && tags.armor_reduce > 0) {
    d = { ...d, armor: Math.max(0, d.armor - tags.armor_reduce) };
    events.push(`${card.name}: -${tags.armor_reduce} брони у противника`);
  }

  if (typeof tags.armor_up === "number" && tags.armor_up > 0) {
    a = { ...a, armor: a.armor + tags.armor_up };
    events.push(`${card.name}: +${tags.armor_up} брони`);
  }

  if (typeof tags.draw === "number" && tags.draw > 0) {
    a = drawCards(a, tags.draw);
    events.push(`${card.name}: +${tags.draw} карт`);
  }

  if (typeof tags.draw_discard === "number" && tags.draw_discard > 0) {
    a = recycleFromDiscard(a, tags.draw_discard);
    events.push(`${card.name}: возврат ${tags.draw_discard} карт из сброса`);
  }

  if (typeof tags.draw_next === "number" && tags.draw_next > 0) {
    a = addEffect(a, {
      type: "draw_next",
      value: tags.draw_next,
      duration: 1,
      source: card.id,
    });
    events.push(`${card.name}: +${tags.draw_next} карта в след. ходу`);
  }

  if (typeof tags.discard_hand === "number" && tags.discard_hand > 0) {
    const hand = [...d.hand];
    const toDiscard: AbilityCard[] = [];
    for (let i = 0; i < tags.discard_hand && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      toDiscard.push(hand.splice(idx, 1)[0]);
    }
    d = {
      ...d,
      hand,
      discardPile: [...d.discardPile, ...toDiscard],
    };
    events.push(`${card.name}: сброшено ${toDiscard.length} карт противника`);
  }

  if (hasEffect(card.effect, "block_hand") && d.hand.length > 0) {
    const idx = Math.floor(Math.random() * d.hand.length);
    const blocked = d.hand[idx];
    d = addEffect(d, {
      type: "block_hand",
      value: 1,
      duration: 1,
      source: `blocked-${blocked.id}`,
    });
    events.push(`${card.name}: заблокирована «${blocked.name}»`);
  }

  if (hasEffect(card.effect, "hp_percent")) {
    const pct = getEffectNumber(card.effect, "hp_percent", 50);
    const newHp = Math.max(1, Math.floor(d.hp * (pct / 100)));
    d = { ...d, hp: newHp };
    events.push(`${card.name}: HP противника → ${pct}%`);
  }

  if (hasEffect(card.effect, "hp_threshold")) {
    const threshold = getEffectNumber(card.effect, "hp_threshold", 30);
    if (a.hp / a.maxHp < threshold / 100) {
      a = { ...a, energy: Math.min(a.maxEnergy, a.energy + 2) };
      events.push(`${card.name}: +2 энергии (HP < ${threshold}%)`);
    }
  }

  if (typeof tags.poison === "number" && tags.poison > 0) {
    const duration = getEffectNumber(card.effect, "duration", 2);
    d = addEffect(d, {
      type: "distraction",
      value: tags.poison,
      duration,
      source: `poison-${card.id}`,
    });
    events.push(`${card.name}: яд ${tags.poison} HP/ход`);
  }

  if (hasEffect(card.effect, "clear_effects")) {
    d = { ...d, activeEffects: [] };
    events.push(`${card.name}: эффекты противника сняты`);
  }

  if (typeof tags.speed_down === "number" && tags.speed_down > 0) {
    d = addEffect(d, {
      type: "distraction",
      value: tags.speed_down,
      duration: getEffectNumber(card.effect, "duration", 1),
      source: card.id,
    });
    events.push(`${card.name}: -${tags.speed_down} скорости противнику`);
  }

  if (typeof tags.speed_up === "number" && tags.speed_up > 0) {
    a = addEffect(a, {
      type: "strength_up",
      value: tags.speed_up,
      duration: getEffectNumber(card.effect, "duration", 1),
      source: `speed-${card.id}`,
    });
    events.push(`${card.name}: +${tags.speed_up} к скорости`);
  }

  if (hasEffect(card.effect, "steal_card") && d.hand.length > 0) {
    const idx = Math.floor(Math.random() * d.hand.length);
    const stolen = d.hand[idx];
    const hand = d.hand.filter((_, i) => i !== idx);
    a = { ...a, hand: [...a.hand, stolen] };
    d = { ...d, hand };
    events.push(`${card.name}: украдена «${stolen.name}»`);
  }

  if (hasEffect(card.effect, "survive_lethal")) {
    a = addEffect(a, {
      type: "invulnerability",
      value: 1,
      duration: 1,
      source: "survive-lethal",
    });
    events.push(`${card.name}: следующий удар не смертелен`);
  }

  if (hasEffect(card.effect, "free_cards")) {
    a = addEffect(a, {
      type: "cost_reduce",
      value: 99,
      duration: 1,
      source: "free-cards",
    });
    a = addEffect(a, {
      type: "strength_up",
      value: 3,
      duration: 1,
      source: "speed-free-cards",
    });
    events.push(`${card.name}: все карты бесплатны, +3 скорости`);
  }

  if (typeof tags.cost_reduce === "number" && tags.cost_reduce > 0) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    a = addEffect(a, {
      type: "cost_reduce",
      value: tags.cost_reduce,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: -${tags.cost_reduce} к стоимости карт`);
  }

  if (hasEffect(card.effect, "skip_ability")) {
    const duration = getEffectNumber(card.effect, "duration", 1);
    d = addEffect(d, {
      type: "skip_ability",
      value: 1,
      duration,
      source: card.id,
    });
    events.push(`${card.name}: противник пропустит фазу способностей`);
  }

  return { attacker: a, defender: d, events };
}

export function applyCardEffects(
  match: Match,
  played: PlayedCard,
  context: {
    lastOpponentCard?: AbilityCard;
    nextOpponentCard?: AbilityCard;
  } = {},
): { match: Match; events: string[]; combatEvent: CombatEvent; success: boolean } {
  const events: string[] = [];
  const attackerNum = played.playerNum;
  const defenderNum = attackerNum === 1 ? 2 : 1;

  let attacker = attackerNum === 1 ? match.player1 : match.player2;
  let defender = defenderNum === 1 ? match.player1 : match.player2;
  const attackerName = attacker.nickname;

  const effectiveCost = getEffectiveCardCost(attacker, played.card);
  const sanctionPenalty = getSanctionPenalty(attacker);
  const totalCost = effectiveCost + sanctionPenalty;

  if (attacker.energy < totalCost) {
    events.push(
      `${played.card.name}: недостаточно энергии (нужно ${totalCost})`,
    );
    return {
      match,
      events,
      success: false,
      combatEvent: {
        turn: match.currentTurn,
        playerNum: attackerNum,
        playerName: attackerName,
        cardId: played.card.id,
        cardName: played.card.name,
        effects: ["Недостаточно энергии"],
        rarity: played.card.rarity,
      },
    };
  }

  if (sanctionPenalty > 0) {
    attacker = {
      ...attacker,
      energy: Math.max(0, attacker.energy - sanctionPenalty),
    };
    events.push(`Санкции: -${sanctionPenalty} энергии`);
  }

  attacker = applyCardCost(attacker, played.card);
  attacker = applyRelic(attacker, attacker.relicId, {
    type: "card_played",
    card: played.card,
  });
  const tags = parseEffectTags(played.card.effect);
  const result = applyEffectTag(attacker, defender, played.card, tags, context);
  attacker = result.attacker;
  defender = result.defender;
  events.push(...result.events);

  if (defender.hp !== (defenderNum === 1 ? match.player1.hp : match.player2.hp)) {
    const prevHp = defenderNum === 1 ? match.player1.hp : match.player2.hp;
    defender = applyRelic(defender, defender.relicId, {
      type: "hp_changed",
      prevHp,
    });
  }

  const updated =
    attackerNum === 1
      ? { ...match, player1: attacker, player2: defender }
      : { ...match, player1: defender, player2: attacker };

  const effectLabels = result.events.map((e) =>
    e.replace(`${played.card.name}: `, ""),
  );

  return {
    match: updated,
    events,
    success: true,
      combatEvent: {
        turn: match.currentTurn,
        playerNum: attackerNum,
        playerName: attackerName,
        cardId: played.card.id,
        cardName: played.card.name,
        effects: effectLabels.length > 0 ? effectLabels : ["Эффект применён"],
        rarity: played.card.rarity,
        category: inferCardCategory(played.card),
      },
  };
}

export function tickEffects(player: MatchPlayer): MatchPlayer {
  let updated = { ...player };

  for (const effect of player.activeEffects) {
    if (effect.source.startsWith("poison-")) {
      updated = applyHeal(updated, -effect.value);
    }
  }

  const drawNext = player.activeEffects.find((e) => e.type === "draw_next");
  if (drawNext) {
    updated = drawCards(updated, drawNext.value);
  }

  const activeEffects = player.activeEffects
    .map((e) => ({ ...e, duration: e.duration - 1 }))
    .filter((e) => e.duration > 0);

  return { ...updated, activeEffects };
}

export function scoreCard(
  card: AbilityCard,
  player: MatchPlayer,
  opponent: MatchPlayer,
): number {
  const tags = parseEffectTags(card.effect);
  let score = 0;

  if (typeof tags.damage === "number") score += tags.damage * 1.5;
  if (typeof tags.heal === "number") {
    const hpNeed = 1 - player.hp / player.maxHp;
    score += tags.heal * (1 + hpNeed);
  }
  if (typeof tags.block === "number") {
    const hpRatio = player.hp / player.maxHp;
    score += tags.block * (hpRatio < 0.5 ? 1.5 : 0.5);
  }
  if (typeof tags.energy === "number") score += tags.energy * 3;
  if (typeof tags.energy_steal === "number") score += tags.energy_steal * 4;

  score += card.speed * 2;
  score -= getEffectiveCardCost(player, card) * 2;

  if (opponent.hp / opponent.maxHp < 0.3 && typeof tags.damage === "number") {
    score += 10;
  }

  return score / Math.max(getEffectiveCardCost(player, card), 1);
}

export function recycleFromDiscardForPassive(
  player: MatchPlayer,
  count: number,
): MatchPlayer {
  return recycleFromDiscard(player, count);
}

export function drawCardsForPlayer(
  player: MatchPlayer,
  count: number,
): MatchPlayer {
  return drawCards(player, count);
}

export function drawToMaxHand(player: MatchPlayer): MatchPlayer {
  const maxHand = getPlayerMaxHand(player);
  const toDraw = Math.max(0, maxHand - player.hand.length);
  if (toDraw === 0) return player;

  let updated = player;
  let shortage = 0;

  for (let i = 0; i < toDraw; i++) {
    if (updated.deck.length === 0 && updated.discardPile.length === 0) {
      shortage++;
      continue;
    }
    updated = drawCards(updated, 1);
  }

  if (shortage > 0) {
    updated = {
      ...updated,
      hp: Math.max(0, updated.hp - shortage * 2),
    };
  }

  return updated;
}

export function discardRemainingHand(player: MatchPlayer): MatchPlayer {
  if (player.hand.length === 0) return player;
  return {
    ...player,
    hand: [],
    discardPile: [...player.discardPile, ...player.hand],
  };
}

export function takeCardFromHand(
  player: MatchPlayer,
  cardId: string,
): { player: MatchPlayer; card: AbilityCard | null } {
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) return { player, card: null };
  return {
    player: {
      ...player,
      hand: player.hand.filter((c) => c.id !== cardId),
    },
    card: { ...card },
  };
}

export function removePlayedCardsFromHand(
  player: MatchPlayer,
  cardIds: string[],
): MatchPlayer {
  return removeCardsFromHand(player, cardIds);
}

export function applyPassiveBlock(player: MatchPlayer): MatchPlayer {
  return addEffect(player, {
    type: "block",
    value: 0.2,
    duration: 1,
    source: "passive-pu",
  });
}

export function applyPassiveSpeedBoost(player: MatchPlayer): MatchPlayer {
  return addEffect(player, {
    type: "strength_up",
    value: 3,
    duration: 1,
    source: "passive-zelenko",
  });
}

export function hasSanction(player: MatchPlayer): boolean {
  return player.activeEffects.some((e) => e.type === "sanction");
}

export function hasSkipAbility(player: MatchPlayer): boolean {
  return player.activeEffects.some((e) => e.type === "skip_ability");
}

export function getEffectiveCardSpeed(
  player: MatchPlayer,
  card: AbilityCard,
): number {
  const speedBonus = player.activeEffects
    .filter(
      (e) =>
        e.source.startsWith("speed-") ||
        e.source === "passive-zelenko" ||
        e.source === "speed-free-cards",
    )
    .reduce((sum, e) => sum + e.value, 0);
  const distraction = player.activeEffects
    .filter((e) => e.type === "distraction")
    .reduce((sum, e) => sum + e.value, 0);
  return Math.max(0, card.speed + speedBonus - distraction);
}

export function getTotalSpeed(
  player: MatchPlayer,
  card: AbilityCard,
): number {
  return getEffectiveCardSpeed(player, card) + player.speed;
}

export function applyAbilityEffects(
  match: Match,
  playerNum: 1 | 2,
  ability: { id: string; name: string; effect: string },
): { match: Match; events: string[]; success: boolean } {
  const attackerNum = playerNum;
  const defenderNum = attackerNum === 1 ? 2 : 1;
  let attacker = attackerNum === 1 ? match.player1 : match.player2;
  let defender = defenderNum === 1 ? match.player1 : match.player2;

  const syntheticCard: AbilityCard = {
    id: ability.id,
    name: ability.name,
    cost: 0,
    speed: 0,
    effect: ability.effect,
    rarity: "rare",
    description: ability.name,
    type: "active",
  };

  const tags = parseEffectTags(ability.effect);
  const result = applyEffectTag(attacker, defender, syntheticCard, tags);
  attacker = result.attacker;
  defender = result.defender;

  const updated =
    attackerNum === 1
      ? { ...match, player1: attacker, player2: defender }
      : { ...match, player1: defender, player2: attacker };

  return {
    match: updated,
    events: result.events,
    success: true,
  };
}

export function isCardBlockedInHand(
  player: MatchPlayer,
  cardId: string,
): boolean {
  return player.activeEffects.some(
    (e) => e.type === "block_hand" && e.source === `blocked-${cardId}`,
  );
}

export function validateCardSelection(
  player: MatchPlayer,
  cardIds: string[],
): string[] {
  const valid: string[] = [];
  let remainingEnergy = player.energy;

  for (const cardId of cardIds) {
    const card = player.hand.find((c) => c.id === cardId);
    if (!card || isCardBlockedInHand(player, cardId)) continue;
    const cost =
      getEffectiveCardCost(player, card) + getSanctionPenalty(player);
    if (cost <= remainingEnergy) {
      valid.push(cardId);
      remainingEnergy -= cost;
    }
  }

  return valid;
}
