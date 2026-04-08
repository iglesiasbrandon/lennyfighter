import { describe, it, expect } from 'vitest';
import {
  TYPE_CHART,
  getTypeMultiplier,
  calculateDamage,
  getRandomTrivia,
  getEffectiveStats,
} from './gameLogic';
import type { Fighter, TriviaQuestion } from './types';
import type { Combatant } from './gameLogic';

// ---- Helpers ----

function makeCombatant(
  type: string,
  atk: number,
  def: number,
  modifiedStats?: { atk: number; def: number } | null,
): Combatant {
  return {
    fighter: { stats: { atk, def }, type },
    modifiedStats: modifiedStats ?? null,
  };
}

function makeFighter(triviaCount: number): Fighter {
  const trivia: TriviaQuestion[] = Array.from({ length: triviaCount }, (_, i) => ({
    question: `Question ${i}`,
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
  }));

  return {
    id: 'test-fighter',
    name: 'Test Fighter',
    title: 'Tester',
    type: 'Growth',
    stats: { hp: 100, atk: 50, def: 50, spd: 50 },
    moves: [],
    trivia,
    avatar: '',
  };
}

// ---- TYPE_CHART ----

describe('TYPE_CHART', () => {
  it('has exactly 5 entries', () => {
    expect(Object.keys(TYPE_CHART)).toHaveLength(5);
  });

  it('each type has strong and weak fields', () => {
    for (const [type, relations] of Object.entries(TYPE_CHART)) {
      expect(relations).toHaveProperty('strong');
      expect(relations).toHaveProperty('weak');
      expect(typeof relations.strong).toBe('string');
      expect(typeof relations.weak).toBe('string');
    }
  });

  it('no type is strong against itself', () => {
    for (const [type, relations] of Object.entries(TYPE_CHART)) {
      expect(relations.strong).not.toBe(type);
    }
  });
});

// ---- getTypeMultiplier ----

describe('getTypeMultiplier', () => {
  it.each([
    ['Growth', 'Data'],
    ['Data', 'Design'],
    ['Design', 'Product'],
    ['Product', 'Engineering'],
    ['Engineering', 'Growth'],
  ])('%s vs %s returns 1.5 (strong)', (atk, def) => {
    expect(getTypeMultiplier(atk, def)).toBe(1.5);
  });

  it('returns 0.67 for weak matchup (Growth vs Engineering)', () => {
    expect(getTypeMultiplier('Growth', 'Engineering')).toBe(0.67);
  });

  it('returns 1.0 for same type (Growth vs Growth)', () => {
    expect(getTypeMultiplier('Growth', 'Growth')).toBe(1.0);
  });

  it('returns 1.0 for neutral matchup (Growth vs Design)', () => {
    expect(getTypeMultiplier('Growth', 'Design')).toBe(1.0);
  });

  it('returns 1.0 for unknown attack type', () => {
    expect(getTypeMultiplier('Fake', 'Growth')).toBe(1.0);
  });
});

// ---- getEffectiveStats ----

describe('getEffectiveStats', () => {
  it('returns base stats when modifiedStats is null', () => {
    const player = makeCombatant('Growth', 100, 80, null);
    expect(getEffectiveStats(player)).toEqual({ atk: 100, def: 80 });
  });

  it('returns modifiedStats when present', () => {
    const player = makeCombatant('Growth', 100, 80, { atk: 130, def: 60 });
    expect(getEffectiveStats(player)).toEqual({ atk: 130, def: 60 });
  });
});

// ---- calculateDamage ----

describe('calculateDamage', () => {
  const move = { power: 50, type: 'Growth' };

  it('returns 0 when answer is wrong', () => {
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Growth', 100, 80);
    expect(calculateDamage(move, false, attacker, defender)).toBe(0);
  });

  it('calculates neutral damage correctly', () => {
    // move power=50, atk=100, def=80, neutral type => Math.round(50 * 100/80 * 1.0) = 63
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Growth', 100, 80); // same type = neutral
    expect(calculateDamage(move, true, attacker, defender)).toBe(63);
  });

  it('applies strong type multiplier (1.5)', () => {
    // Growth is strong vs Data => Math.round(50 * 100/80 * 1.5) = Math.round(93.75) = 94
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Data', 100, 80);
    expect(calculateDamage(move, true, attacker, defender)).toBe(94);
  });

  it('applies weak type multiplier (0.67)', () => {
    // Growth is weak vs Engineering => Math.round(50 * 100/80 * 0.67) = Math.round(41.875) = 42
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Engineering', 100, 80);
    expect(calculateDamage(move, true, attacker, defender)).toBe(42);
  });

  it('nullifyType forces multiplier to 1.0', () => {
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Data', 100, 80); // would be 1.5 normally
    const withType = calculateDamage(move, true, attacker, defender);
    const withoutType = calculateDamage(move, true, attacker, defender, { nullifyType: true });
    expect(withType).toBe(94);
    expect(withoutType).toBe(63); // neutral
  });

  it('doubleDamage doubles the final result', () => {
    const attacker = makeCombatant('Growth', 100, 80);
    const defender = makeCombatant('Growth', 100, 80);
    const normal = calculateDamage(move, true, attacker, defender);
    const doubled = calculateDamage(move, true, attacker, defender, { doubleDamage: true });
    expect(doubled).toBe(normal * 2);
  });

  it('uses modifiedStats when present', () => {
    const attacker = makeCombatant('Growth', 100, 80, { atk: 200, def: 80 });
    const defender = makeCombatant('Growth', 100, 80);
    // power=50, atk=200, def=80, neutral => Math.round(50 * 200/80) = Math.round(125) = 125
    expect(calculateDamage(move, true, attacker, defender)).toBe(125);
  });

  it('result is always an integer', () => {
    // Use values that produce a fractional base: power=33, atk=77, def=50
    const attacker = makeCombatant('Growth', 77, 50);
    const defender = makeCombatant('Growth', 50, 50);
    const m = { power: 33, type: 'Growth' };
    const result = calculateDamage(m, true, attacker, defender);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ---- getRandomTrivia ----

describe('getRandomTrivia', () => {
  it('returns a valid TriviaQuestion', () => {
    const fighter = makeFighter(3);
    const used: Record<string, number[]> = {};
    const trivia = getRandomTrivia(fighter, used);
    expect(trivia).toHaveProperty('question');
    expect(trivia).toHaveProperty('options');
    expect(trivia).toHaveProperty('answer');
  });

  it('mutates usedIndices', () => {
    const fighter = makeFighter(3);
    const used: Record<string, number[]> = {};
    getRandomTrivia(fighter, used);
    expect(used['test-fighter']).toHaveLength(1);
  });

  it('does not repeat until all questions are used', () => {
    const fighter = makeFighter(3);
    const used: Record<string, number[]> = {};
    const questions = new Set<string>();
    for (let i = 0; i < 3; i++) {
      questions.add(getRandomTrivia(fighter, used).question);
    }
    expect(questions.size).toBe(3);
  });

  it('resets pool when exhausted (legacy mode without allFighters)', () => {
    const fighter = makeFighter(2);
    const used: Record<string, number[]> = {};
    getRandomTrivia(fighter, used);
    getRandomTrivia(fighter, used);
    // Pool is now exhausted; next call should reset
    expect(used['test-fighter']).toHaveLength(2);
    getRandomTrivia(fighter, used);
    // After reset, usedIndices should have exactly 1 entry (the newly picked one)
    expect(used['test-fighter']).toHaveLength(1);
  });

  it('falls back to a different fighter when primary pool is exhausted and allFighters is provided', () => {
    const primary: Fighter = {
      id: 'primary',
      name: 'Primary',
      title: 'P',
      type: 'Growth',
      stats: { hp: 100, atk: 50, def: 50, spd: 50 },
      moves: [],
      trivia: [{ question: 'PQ1', options: ['A', 'B', 'C', 'D'], answer: 'A' }],
      avatar: '',
    };
    const fallback: Fighter = {
      id: 'fallback',
      name: 'Fallback',
      title: 'F',
      type: 'Data',
      stats: { hp: 100, atk: 50, def: 50, spd: 50 },
      moves: [],
      trivia: [
        { question: 'FQ1', options: ['A', 'B', 'C', 'D'], answer: 'A' },
        { question: 'FQ2', options: ['A', 'B', 'C', 'D'], answer: 'B' },
      ],
      avatar: '',
    };
    const allFighters = [primary, fallback];
    const used: Record<string, number[]> = {};

    // Exhaust primary's pool
    const q1 = getRandomTrivia(primary, used, allFighters);
    expect(q1.question).toBe('PQ1');

    // Next call should fall back to the fallback fighter
    const q2 = getRandomTrivia(primary, used, allFighters);
    expect(['FQ1', 'FQ2']).toContain(q2.question);
    // Primary pool should NOT have been reset
    expect(used['primary']).toHaveLength(1);
    // Fallback should have one used index
    expect(used['fallback']).toHaveLength(1);
  });

  it('resets all pools when every fighter is exhausted', () => {
    const f1: Fighter = {
      id: 'f1', name: 'F1', title: 'F', type: 'Growth',
      stats: { hp: 100, atk: 50, def: 50, spd: 50 }, moves: [],
      trivia: [{ question: 'Q1', options: ['A', 'B', 'C', 'D'], answer: 'A' }],
      avatar: '',
    };
    const f2: Fighter = {
      id: 'f2', name: 'F2', title: 'F', type: 'Data',
      stats: { hp: 100, atk: 50, def: 50, spd: 50 }, moves: [],
      trivia: [{ question: 'Q2', options: ['A', 'B', 'C', 'D'], answer: 'B' }],
      avatar: '',
    };
    const allFighters = [f1, f2];
    const used: Record<string, number[]> = {};

    // Exhaust both fighters
    getRandomTrivia(f1, used, allFighters); // uses f1's Q1
    getRandomTrivia(f1, used, allFighters); // falls back to f2's Q2

    // Both are now exhausted; next call should reset all pools
    const q3 = getRandomTrivia(f1, used, allFighters);
    expect(['Q1', 'Q2']).toContain(q3.question);
    // At least one pool was reset
    const totalUsed = (used['f1']?.length || 0) + (used['f2']?.length || 0);
    expect(totalUsed).toBe(1); // only the one just picked
  });
});
