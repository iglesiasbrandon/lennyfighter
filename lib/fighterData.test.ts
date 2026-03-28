import { describe, it, expect } from 'vitest';
import { FIGHTERS, getFighterById, VALID_FIGHTER_IDS } from './fighterData';
import type { FighterType } from './types';

const VALID_TYPES: FighterType[] = ['Growth', 'Engineering', 'Design', 'Data', 'Product'];

describe('FIGHTERS array', () => {
  it('contains exactly 15 fighters', () => {
    expect(FIGHTERS).toHaveLength(15);
  });

  it('has unique IDs', () => {
    const ids = FIGHTERS.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique names', () => {
    const names = FIGHTERS.map(f => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every fighter has a valid type', () => {
    for (const f of FIGHTERS) {
      expect(VALID_TYPES).toContain(f.type);
    }
  });

  it('every fighter has exactly 4 moves', () => {
    for (const f of FIGHTERS) {
      expect(f.moves).toHaveLength(4);
    }
  });

  it('every fighter has exactly 4 trivia questions', () => {
    for (const f of FIGHTERS) {
      expect(f.trivia).toHaveLength(4);
    }
  });

  it('every fighter has positive stats (hp, atk, def, spd)', () => {
    for (const f of FIGHTERS) {
      expect(f.stats.hp).toBeGreaterThan(0);
      expect(f.stats.atk).toBeGreaterThan(0);
      expect(f.stats.def).toBeGreaterThan(0);
      expect(f.stats.spd).toBeGreaterThan(0);
    }
  });

  it('every fighter has an avatar path', () => {
    for (const f of FIGHTERS) {
      expect(f.avatar).toBeTruthy();
      expect(f.avatar).toMatch(/^\/assets\/avatars\/.+/);
    }
  });
});

describe('Move data', () => {
  it('every move has a non-empty name', () => {
    for (const f of FIGHTERS) {
      for (const m of f.moves) {
        expect(m.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('every move has a valid FighterType', () => {
    for (const f of FIGHTERS) {
      for (const m of f.moves) {
        expect(VALID_TYPES).toContain(m.type);
      }
    }
  });

  it('every move has positive power', () => {
    for (const f of FIGHTERS) {
      for (const m of f.moves) {
        expect(m.power).toBeGreaterThan(0);
      }
    }
  });

  it('every move has a non-empty description', () => {
    for (const f of FIGHTERS) {
      for (const m of f.moves) {
        expect(m.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('Trivia data', () => {
  it('every trivia question has exactly 4 options', () => {
    for (const f of FIGHTERS) {
      for (const t of f.trivia) {
        expect(t.options).toHaveLength(4);
      }
    }
  });

  it('the answer is always one of the options', () => {
    for (const f of FIGHTERS) {
      for (const t of f.trivia) {
        expect(t.options).toContain(t.answer);
      }
    }
  });

  it('no duplicate options within a question', () => {
    for (const f of FIGHTERS) {
      for (const t of f.trivia) {
        expect(new Set(t.options).size).toBe(t.options.length);
      }
    }
  });

  it('every trivia question has a non-empty question string', () => {
    for (const f of FIGHTERS) {
      for (const t of f.trivia) {
        expect(t.question.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getFighterById', () => {
  it('returns a known fighter by ID', () => {
    const fighter = getFighterById('elena-verna');
    expect(fighter).toBeDefined();
    expect(fighter!.name).toBe('Elena Verna');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getFighterById('nonexistent-fighter')).toBeUndefined();
  });
});

describe('VALID_FIGHTER_IDS', () => {
  it('has the same length as FIGHTERS', () => {
    expect(VALID_FIGHTER_IDS).toHaveLength(FIGHTERS.length);
  });

  it('contains every fighter ID from FIGHTERS', () => {
    for (const f of FIGHTERS) {
      expect(VALID_FIGHTER_IDS).toContain(f.id);
    }
  });
});
