import { describe, it, expect } from 'vitest';
import { ITEMS, getItemById, getAllItems, VALID_ITEM_IDS } from './itemData';

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic'] as const;
const VALID_TIMINGS = ['pre_match', 'active_use', 'passive', 'trivia_phase'] as const;

describe('ITEMS array', () => {
  it('contains exactly 12 items', () => {
    expect(ITEMS).toHaveLength(12);
  });

  it('has unique IDs', () => {
    const ids = ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has a positive cost', () => {
    for (const item of ITEMS) {
      expect(item.cost).toBeGreaterThan(0);
    }
  });

  it('every item has a valid rarity', () => {
    for (const item of ITEMS) {
      expect(VALID_RARITIES).toContain(item.rarity);
    }
  });

  it('every item has a valid timing', () => {
    for (const item of ITEMS) {
      expect(VALID_TIMINGS).toContain(item.timing);
    }
  });

  it('every item has a non-empty name', () => {
    for (const item of ITEMS) {
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it('every item has a non-empty effect', () => {
    for (const item of ITEMS) {
      expect(item.effect.length).toBeGreaterThan(0);
    }
  });

  it('every item has a non-empty description', () => {
    for (const item of ITEMS) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Stat modifier items', () => {
  it('blitzscaling_bomb has atkBoost and defPenalty', () => {
    const item = getItemById('blitzscaling_bomb');
    expect(item).toBeDefined();
    expect(item!.atkBoost).toBe(0.30);
    expect(item!.defPenalty).toBe(0.15);
  });

  it('moat_builder has defBoost', () => {
    const item = getItemById('moat_builder');
    expect(item).toBeDefined();
    expect(item!.defBoost).toBe(0.30);
  });

  it('items without stat modifiers have no atkBoost/defPenalty/defBoost', () => {
    const nonStatItems = ITEMS.filter(
      i => !['blitzscaling_bomb', 'moat_builder'].includes(i.id),
    );
    for (const item of nonStatItems) {
      expect(item.atkBoost).toBeUndefined();
      expect(item.defPenalty).toBeUndefined();
      expect(item.defBoost).toBeUndefined();
    }
  });
});

describe('getItemById', () => {
  it('returns a known item by ID', () => {
    const item = getItemById('hook_model');
    expect(item).toBeDefined();
    expect(item!.name).toBe('The Hook Model');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getItemById('nonexistent-item')).toBeUndefined();
  });
});

describe('getAllItems', () => {
  it('returns all 12 items', () => {
    expect(getAllItems()).toHaveLength(12);
  });

  it('returns the same items as ITEMS', () => {
    expect(getAllItems()).toEqual(ITEMS);
  });
});

describe('VALID_ITEM_IDS', () => {
  it('has the same length as ITEMS', () => {
    expect(VALID_ITEM_IDS).toHaveLength(ITEMS.length);
  });

  it('contains every item ID from ITEMS', () => {
    for (const item of ITEMS) {
      expect(VALID_ITEM_IDS).toContain(item.id);
    }
  });
});
