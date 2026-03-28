import { describe, it, expect } from 'vitest';
import { getEnv, runWithEnv } from './env';
import type { Env } from './types';

// We only need a minimal mock since we're testing the AsyncLocalStorage mechanism,
// not the actual Cloudflare bindings.
const mockEnv = { DB: {}, KV: {}, MATCH_ROOM: {}, MATCHMAKING_QUEUE: {}, ASSETS: {}, IMAGES: {} } as unknown as Env;

describe('getEnv', () => {
  it('throws when called outside runWithEnv context', () => {
    expect(() => getEnv()).toThrow('getEnv() called outside of request context');
  });
});

describe('runWithEnv', () => {
  it('makes env available via getEnv (sync)', () => {
    const result = runWithEnv(mockEnv, () => {
      const env = getEnv();
      return env === mockEnv;
    });
    expect(result).toBe(true);
  });

  it('makes env available via getEnv (async)', async () => {
    const result = await runWithEnv(mockEnv, async () => {
      // Simulate async work
      await new Promise((r) => setTimeout(r, 1));
      const env = getEnv();
      return env === mockEnv;
    });
    expect(result).toBe(true);
  });

  it('isolates env between nested calls', () => {
    const otherEnv = { ...mockEnv, DB: 'other' } as unknown as Env;

    runWithEnv(mockEnv, () => {
      expect(getEnv()).toBe(mockEnv);

      runWithEnv(otherEnv, () => {
        expect(getEnv()).toBe(otherEnv);
      });

      // Outer context should still see original env
      expect(getEnv()).toBe(mockEnv);
    });
  });
});
