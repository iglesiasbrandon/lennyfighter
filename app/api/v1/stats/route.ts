import { getEnv } from '../../../../lib/env';
import { successResponse } from '../../../../lib/utils';

interface PlayerStatsRow {
  gamertag: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_streak: number;
  best_streak: number;
  last_fighter: string | null;
  last_match_at: string | null;
  lennycoins: number;
}

/**
 * Stats / Leaderboard API
 *
 * GET  /api/v1/stats  -- Fetch leaderboard (top 50 by wins)
 *
 * POST was removed — match results are now recorded server-side in the
 * MatchRoom Durable Object to prevent unauthenticated stat fabrication.
 */
export async function GET() {
  const env = getEnv();

  const rows = await env.DB.prepare(
    'SELECT gamertag, wins, losses, total_matches, win_streak, best_streak, last_fighter, last_match_at, lennycoins FROM player_stats ORDER BY wins DESC LIMIT 50'
  ).all<PlayerStatsRow>();

  return successResponse({ leaderboard: rows.results || [] });
}