/**
 * Pure single-elimination bracket logic for LennyFighter tournaments.
 *
 * This module is the single source of truth for bracket seeding and
 * advancement. It is imported by BOTH the production TournamentRoom
 * Durable Object and the in-process local-dev server in vite.config.ts,
 * so the two can never drift.
 *
 * No I/O, no side effects — just data transforms.
 */
import type { BracketMatch, BracketSize } from './types';

/** The bracket sizes a tournament admin may choose. */
export const BRACKET_SIZES: BracketSize[] = [4, 8, 16];

export function isValidBracketSize(n: number): n is BracketSize {
  return n === 4 || n === 8 || n === 16;
}

/** Number of rounds in a single-elimination bracket of `size` players. */
export function roundCount(size: BracketSize): number {
  return Math.log2(size);
}

function rand6(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a complete single-elimination bracket.
 *
 * Returns a FLAT array of `players.length - 1` matches ordered round 0
 * first, then round 1, etc. Round-0 matches have both slots filled (from
 * a shuffled seeding) and status `'ready'`; all later matches start empty
 * and `'pending'`. Each match's `matchId` is pre-generated so it can
 * address a MatchRoom DO via idFromName.
 *
 * `players.length` must be a valid BracketSize (4, 8, or 16).
 */
export function seedBracket(players: readonly string[], code: string): BracketMatch[] {
  const size = players.length as BracketSize;
  const rounds = roundCount(size);

  // Flat-index layout: all round-0 matches, then all round-1, etc.
  const roundStart: number[] = [];
  let offset = 0;
  for (let r = 0; r < rounds; r++) {
    roundStart[r] = offset;
    offset += size / Math.pow(2, r + 1);
  }

  const matches: BracketMatch[] = [];
  for (let r = 0; r < rounds; r++) {
    const count = size / Math.pow(2, r + 1);
    for (let i = 0; i < count; i++) {
      const isFinal = r === rounds - 1;
      matches.push({
        matchId: `mt_${code}_${r}_${i}_${rand6()}`,
        round: r,
        indexInRound: i,
        p1: null,
        p2: null,
        winner: null,
        status: r === 0 ? 'ready' : 'pending',
        advancesTo: isFinal ? null : roundStart[r + 1] + Math.floor(i / 2),
        advancesToSlot: isFinal ? null : i % 2 === 0 ? 'p1' : 'p2',
      });
    }
  }

  // Seed round 0 from a shuffled roster.
  const shuffled = shuffle(players);
  const r0count = size / 2;
  for (let i = 0; i < r0count; i++) {
    matches[i].p1 = shuffled[i * 2];
    matches[i].p2 = shuffled[i * 2 + 1];
  }

  return matches;
}

export interface ApplyResult {
  /** Set when the resolved match was the final. */
  champion: string | null;
  /** A next-round match that just became fully populated and ready to assign. */
  newlyReady: BracketMatch | null;
  /** The match that was resolved (null if the result was a no-op). */
  resolved: BracketMatch | null;
}

/**
 * Record a match result and advance the winner.
 *
 * Idempotent: if the match is unknown, already `'done'`, or the winner is
 * not a participant, this is a no-op and all fields return null. This makes
 * duplicate result reports (e.g. both a forfeit and a retry) harmless.
 *
 * Mutates `matches` in place.
 */
export function applyResultToBracket(
  matches: BracketMatch[],
  tournamentMatchId: string,
  winner: string,
): ApplyResult {
  const match = matches.find(m => m.matchId === tournamentMatchId);
  if (!match || match.status === 'done') {
    return { champion: null, newlyReady: null, resolved: null };
  }
  if (winner !== match.p1 && winner !== match.p2) {
    return { champion: null, newlyReady: null, resolved: null };
  }

  match.winner = winner;
  match.status = 'done';

  // The final has no parent — the winner is the champion.
  if (match.advancesTo === null || match.advancesToSlot === null) {
    return { champion: winner, newlyReady: null, resolved: match };
  }

  const next = matches[match.advancesTo];
  if (match.advancesToSlot === 'p1') next.p1 = winner;
  else next.p2 = winner;

  let newlyReady: BracketMatch | null = null;
  if (next.p1 && next.p2 && next.status === 'pending') {
    next.status = 'ready';
    newlyReady = next;
  }

  return { champion: null, newlyReady, resolved: match };
}

/** The opponent of `gamertag` in a match, or null if not a participant / not yet decided. */
export function opponentOf(match: BracketMatch, gamertag: string): string | null {
  if (match.p1 === gamertag) return match.p2;
  if (match.p2 === gamertag) return match.p1;
  return null;
}
