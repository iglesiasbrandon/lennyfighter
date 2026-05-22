import { describe, it, expect } from 'vitest';
import {
  seedBracket,
  applyResultToBracket,
  roundCount,
  isValidBracketSize,
  opponentOf,
  BRACKET_SIZES,
} from './bracket';
import type { BracketMatch } from './types';

// ---- Helpers ----

function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${i + 1}`);
}

/** Play out an entire bracket: always advance the lexicographically-first slot. */
function playToChampion(matches: BracketMatch[]): string {
  let champion: string | null = null;
  let guard = 0;
  while (!champion && guard++ < 100) {
    const ready = matches.find(m => m.status === 'ready' && m.p1 && m.p2 && !m.winner);
    if (!ready) break;
    const res = applyResultToBracket(matches, ready.matchId, ready.p1!);
    if (res.champion) champion = res.champion;
  }
  return champion!;
}

// ---- BRACKET_SIZES / validation ----

describe('bracket sizes', () => {
  it('exposes 4, 8, 16', () => {
    expect(BRACKET_SIZES).toEqual([4, 8, 16]);
  });

  it('isValidBracketSize accepts only powers of two in range', () => {
    expect(isValidBracketSize(4)).toBe(true);
    expect(isValidBracketSize(8)).toBe(true);
    expect(isValidBracketSize(16)).toBe(true);
    expect(isValidBracketSize(2)).toBe(false);
    expect(isValidBracketSize(6)).toBe(false);
    expect(isValidBracketSize(32)).toBe(false);
  });

  it('roundCount is log2', () => {
    expect(roundCount(4)).toBe(2);
    expect(roundCount(8)).toBe(3);
    expect(roundCount(16)).toBe(4);
  });
});

// ---- seedBracket ----

describe('seedBracket', () => {
  for (const size of [4, 8, 16]) {
    it(`builds N-1 matches for ${size} players`, () => {
      const m = seedBracket(players(size), 'ABCD');
      expect(m).toHaveLength(size - 1);
    });

    it(`fills every round-0 slot for ${size} players`, () => {
      const m = seedBracket(players(size), 'ABCD');
      const r0 = m.filter(x => x.round === 0);
      expect(r0).toHaveLength(size / 2);
      for (const match of r0) {
        expect(match.p1).not.toBeNull();
        expect(match.p2).not.toBeNull();
        expect(match.status).toBe('ready');
      }
    });

    it(`includes every player exactly once in round 0 for ${size}`, () => {
      const m = seedBracket(players(size), 'ABCD');
      const seeded = m
        .filter(x => x.round === 0)
        .flatMap(x => [x.p1, x.p2])
        .sort();
      expect(seeded).toEqual(players(size).sort());
    });
  }

  it('later-round matches start empty and pending', () => {
    const m = seedBracket(players(8), 'ABCD');
    for (const match of m.filter(x => x.round > 0)) {
      expect(match.p1).toBeNull();
      expect(match.p2).toBeNull();
      expect(match.status).toBe('pending');
    }
  });

  it('generates unique match ids', () => {
    const m = seedBracket(players(16), 'ABCD');
    const ids = new Set(m.map(x => x.matchId));
    expect(ids.size).toBe(m.length);
  });

  it('wires advancement: the final has no parent', () => {
    const m = seedBracket(players(8), 'ABCD');
    const finals = m.filter(x => x.advancesTo === null);
    expect(finals).toHaveLength(1);
    expect(finals[0].round).toBe(roundCount(8) - 1);
  });

  it('round-0 match i advances to round-1 match floor(i/2)', () => {
    const m = seedBracket(players(8), 'ABCD');
    const r1Start = m.findIndex(x => x.round === 1);
    expect(m[0].advancesTo).toBe(r1Start + 0);
    expect(m[1].advancesTo).toBe(r1Start + 0);
    expect(m[2].advancesTo).toBe(r1Start + 1);
    expect(m[3].advancesTo).toBe(r1Start + 1);
    // even index -> p1, odd index -> p2
    expect(m[0].advancesToSlot).toBe('p1');
    expect(m[1].advancesToSlot).toBe('p2');
  });
});

// ---- applyResultToBracket ----

describe('applyResultToBracket', () => {
  it('records a winner and marks the match done', () => {
    const m = seedBracket(players(4), 'ABCD');
    const res = applyResultToBracket(m, m[0].matchId, m[0].p1!);
    expect(res.resolved).not.toBeNull();
    expect(m[0].winner).toBe(m[0].p1);
    expect(m[0].status).toBe('done');
  });

  it('advances the winner into the next match slot', () => {
    const m = seedBracket(players(4), 'ABCD');
    const w0 = m[0].p1!;
    applyResultToBracket(m, m[0].matchId, w0);
    const next = m[m[0].advancesTo!];
    expect(next[m[0].advancesToSlot!]).toBe(w0);
  });

  it('marks the next match ready only once BOTH slots are filled', () => {
    const m = seedBracket(players(4), 'ABCD');
    const r1 = m[2]; // the final for a 4-player bracket
    const first = applyResultToBracket(m, m[0].matchId, m[0].p1!);
    expect(first.newlyReady).toBeNull();
    expect(r1.status).toBe('pending');
    const second = applyResultToBracket(m, m[1].matchId, m[1].p1!);
    expect(second.newlyReady).not.toBeNull();
    expect(r1.status).toBe('ready');
  });

  it('is idempotent — a duplicate report is a no-op', () => {
    const m = seedBracket(players(4), 'ABCD');
    applyResultToBracket(m, m[0].matchId, m[0].p1!);
    const dup = applyResultToBracket(m, m[0].matchId, m[0].p2!);
    expect(dup.resolved).toBeNull();
    expect(m[0].winner).toBe(m[0].p1); // unchanged
  });

  it('rejects a winner who is not a participant', () => {
    const m = seedBracket(players(4), 'ABCD');
    const res = applyResultToBracket(m, m[0].matchId, 'stranger');
    expect(res.resolved).toBeNull();
    expect(m[0].winner).toBeNull();
  });

  it('returns champion when the final is resolved', () => {
    const m = seedBracket(players(4), 'ABCD');
    const champ = playToChampion(m);
    expect(champ).toBeTruthy();
    expect(players(4)).toContain(champ);
  });

  for (const size of [4, 8, 16]) {
    it(`plays a full ${size}-player bracket to exactly one champion`, () => {
      const m = seedBracket(players(size), 'ABCD');
      const champ = playToChampion(m);
      expect(champ).toBeTruthy();
      expect(m.every(x => x.status === 'done')).toBe(true);
      expect(m.filter(x => x.advancesTo === null)[0].winner).toBe(champ);
    });
  }
});

// ---- opponentOf ----

describe('opponentOf', () => {
  it('returns the other participant', () => {
    const m = seedBracket(players(4), 'ABCD');
    expect(opponentOf(m[0], m[0].p1!)).toBe(m[0].p2);
    expect(opponentOf(m[0], m[0].p2!)).toBe(m[0].p1);
  });

  it('returns null for a non-participant', () => {
    const m = seedBracket(players(4), 'ABCD');
    expect(opponentOf(m[0], 'stranger')).toBeNull();
  });
});
