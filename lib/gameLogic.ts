/**
 * Shared game logic used by both the MatchRoom Durable Object (production)
 * and the local-dev Vite WebSocket plugin.
 *
 * Extracting these pure functions avoids duplicating game rules in two places
 * and ensures the local dev experience matches production behavior.
 */

import type { Fighter, FighterType, TriviaQuestion, GameItem } from './types';

// ---- Type Chart & Multiplier ----

export const TYPE_CHART: Record<FighterType, { strong: FighterType; weak: FighterType }> = {
  Growth: { strong: 'Data', weak: 'Engineering' },
  Data: { strong: 'Design', weak: 'Growth' },
  Design: { strong: 'Product', weak: 'Data' },
  Product: { strong: 'Engineering', weak: 'Design' },
  Engineering: { strong: 'Growth', weak: 'Product' },
};

/**
 * Return the type-effectiveness multiplier for an attack.
 *
 * - 1.5 if the attack type is strong against the defender
 * - 0.67 if weak
 * - 1.0 otherwise
 */
export function getTypeMultiplier(attackType: string, defenderType: string): number {
  const chart = TYPE_CHART[attackType as FighterType];
  if (!chart) return 1.0;
  if (chart.strong === defenderType) return 1.5;
  if (chart.weak === defenderType) return 0.67;
  return 1.0;
}

// ---- Damage Calculation ----

/** Minimal stats shape accepted by calculateDamage. */
interface CombatantStats {
  atk: number;
  def: number;
}

/** Minimal player shape accepted by calculateDamage. */
export interface Combatant {
  fighter: { stats: CombatantStats; type: string };
  modifiedStats?: CombatantStats | null;
}

/** Return effective ATK/DEF stats, preferring item-modified values. */
export function getEffectiveStats(player: Combatant): CombatantStats {
  if (player.modifiedStats) {
    return player.modifiedStats;
  }
  return { atk: player.fighter.stats.atk, def: player.fighter.stats.def };
}

/**
 * Calculate the damage dealt by a move.
 *
 * Returns 0 when the trivia answer was wrong (`correct === false`).
 */
export function calculateDamage(
  move: { power: number; type: string },
  correct: boolean,
  attacker: Combatant,
  defender: Combatant,
  options?: { nullifyType?: boolean; doubleDamage?: boolean },
): number {
  if (!correct) return 0;
  const atkStats = getEffectiveStats(attacker);
  const defStats = getEffectiveStats(defender);
  const baseDamage = move.power * (atkStats.atk / defStats.def);
  const typeMult = options?.nullifyType ? 1.0 : getTypeMultiplier(move.type, defender.fighter.type);
  let damage = Math.round(baseDamage * typeMult);
  if (options?.doubleDamage) {
    damage *= 2;
  }
  return damage;
}

// ---- Self-Damage Calculation ----

/** The fraction of move power dealt as self-damage on a wrong answer. */
const SELF_DAMAGE_FRACTION = 0.5;

/**
 * Calculate the self-damage (recoil) a player takes for answering incorrectly.
 *
 * Returns 0 when the answer was correct.
 */
export function calculateSelfDamage(movePower: number, correct: boolean): number {
  if (correct) return 0;
  return Math.round(movePower * SELF_DAMAGE_FRACTION);
}

// ---- Pre-Match Item Stat Modifications ----

/**
 * Result of applying a pre-match item's stat modifications to a fighter.
 * Returns null if no stat changes were made (no item, or item doesn't modify stats).
 */
export function applyItemStats(
  fighter: Fighter,
  item: GameItem | null | undefined,
): { atk: number; def: number } | null {
  if (!item) return null;
  if (item.timing !== 'pre_match') return null;

  switch (item.effect) {
    case 'atk_boost_def_penalty': {
      const atkMult = 1 + (item.atkBoost || 0.30);
      const defMult = 1 - (item.defPenalty || 0.15);
      return {
        atk: Math.round(fighter.stats.atk * atkMult),
        def: Math.round(fighter.stats.def * defMult),
      };
    }
    case 'def_boost': {
      const defMult = 1 + (item.defBoost || 0.30);
      return {
        atk: fighter.stats.atk,
        def: Math.round(fighter.stats.def * defMult),
      };
    }
    default:
      return null;
  }
}

// ---- Trivia Selection ----

/**
 * Pick a random trivia question for a fighter, avoiding recently-used ones.
 *
 * Mutates `usedIndices` to track which questions have been shown.
 *
 * When `allFighters` is provided and the fighter's own pool is exhausted,
 * instead of resetting the same fighter's pool, a question is drawn from
 * a different fighter that still has unused questions. This ensures the
 * player never sees the same question twice in a match (with 5-9 questions
 * per fighter x 15 fighters = 75-135 total questions). If ALL fighters are
 * exhausted, every pool is reset.
 *
 * When `allFighters` is omitted, falls back to the original behavior of
 * resetting the same fighter's pool.
 */
export function getRandomTrivia(
  fighter: Fighter,
  usedIndices: Record<string, number[]>,
  allFighters?: Fighter[],
): TriviaQuestion {
  const fighterId = fighter.id || fighter.name;
  if (!usedIndices[fighterId]) usedIndices[fighterId] = [];

  const used = usedIndices[fighterId];
  const allIndices = fighter.trivia.map((_, i) => i);
  let available = allIndices.filter(i => !used.includes(i));

  // Primary fighter still has unused questions — pick from them
  if (available.length > 0) {
    const idx = available[Math.floor(Math.random() * available.length)];
    usedIndices[fighterId].push(idx);
    return fighter.trivia[idx];
  }

  // Pool exhausted — cross-fighter fallback (if allFighters provided)
  if (allFighters && allFighters.length > 0) {
    // Collect all fighters that have unused questions (excluding the primary fighter)
    const fallbackCandidates: { fighter: Fighter; available: number[] }[] = [];
    for (const f of allFighters) {
      const fId = f.id || f.name;
      if (fId === fighterId) continue; // skip the primary fighter
      if (!usedIndices[fId]) usedIndices[fId] = [];
      const fAll = f.trivia.map((_, i) => i);
      const fAvail = fAll.filter(i => !usedIndices[fId].includes(i));
      if (fAvail.length > 0) {
        fallbackCandidates.push({ fighter: f, available: fAvail });
      }
    }

    if (fallbackCandidates.length > 0) {
      // Pick a random fallback fighter, then a random unused question from it
      const fallback = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
      const fallbackId = fallback.fighter.id || fallback.fighter.name;
      const idx = fallback.available[Math.floor(Math.random() * fallback.available.length)];
      usedIndices[fallbackId].push(idx);
      return fallback.fighter.trivia[idx];
    }

    // ALL fighters exhausted — reset everything
    for (const f of allFighters) {
      const fId = f.id || f.name;
      usedIndices[fId] = [];
    }
  } else {
    // No allFighters provided — legacy behavior: reset same fighter's pool
    usedIndices[fighterId] = [];
  }

  // Pick from the (now-reset) primary fighter
  available = fighter.trivia.map((_, i) => i);
  const idx = available[Math.floor(Math.random() * available.length)];
  if (!usedIndices[fighterId]) usedIndices[fighterId] = [];
  usedIndices[fighterId].push(idx);
  return fighter.trivia[idx];
}
