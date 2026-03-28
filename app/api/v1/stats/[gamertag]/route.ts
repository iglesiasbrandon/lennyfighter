import { getEnv } from '../../../../../lib/env';
import { successResponse, errorResponse } from '../../../../../lib/utils';

interface PlayerStatsRow {
  gamertag: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_streak: number;
  best_streak: number;
  last_fighter: string | null;
  last_match_at: string | null;
  created_at: string;
  lennycoins: number;
}

/**
 * Individual Player Stats API
 *
 * GET /api/v1/stats/:gamertag -- Fetch stats for a single player
 */
export async function GET(_request: Request, { params }: { params: { gamertag: string } }) {
  const env = getEnv();
  const { gamertag } = params;

  const row = await env.DB.prepare(
    'SELECT gamertag, wins, losses, total_matches, win_streak, best_streak, last_fighter, last_match_at, created_at, lennycoins FROM player_stats WHERE gamertag = ?'
  ).bind(gamertag).first<PlayerStatsRow>();

  if (!row) {
    return errorResponse('NOT_FOUND', 'Player not found', 404);
  }

  return successResponse(row);
}
