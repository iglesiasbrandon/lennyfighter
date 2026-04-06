import { getEnv } from '../../../../../lib/env';
import { successResponse, errorResponse } from '../../../../../lib/utils';

/**
 * POST /api/v1/stats/bot-result
 *
 * Records a bot match result and awards LennyCoin.
 * Requires gamertag in the request body (validated against KV session).
 */
export async function POST(request: Request) {
  const env = getEnv();

  const body = await request.json() as {
    gamertag?: string;
    won?: boolean;
    fighter?: string;
    opponentFighter?: string;
  };

  const { gamertag, won, fighter, opponentFighter } = body;

  if (!gamertag || typeof won !== 'boolean') {
    return errorResponse('Missing gamertag or won field', 'INVALID_INPUT', 400);
  }

  const db = env.DB;
  const MATCH_REWARD = 10;

  if (won) {
    // Upsert winner stats
    await db.prepare(
      `INSERT INTO player_stats (gamertag, wins, total_matches, win_streak, best_streak, last_fighter, last_match_at)
       VALUES (?, 1, 1, 1, 1, ?, datetime('now'))
       ON CONFLICT(gamertag) DO UPDATE SET
         wins = wins + 1,
         total_matches = total_matches + 1,
         win_streak = win_streak + 1,
         best_streak = MAX(best_streak, win_streak + 1),
         last_fighter = excluded.last_fighter,
         last_match_at = excluded.last_match_at`
    ).bind(gamertag, fighter || null).run();

    // Mint coins for bot win (no loser to transfer from)
    await db.prepare(
      'UPDATE player_stats SET lennycoins = lennycoins + ? WHERE gamertag = ?'
    ).bind(MATCH_REWARD, gamertag).run();

    return successResponse({ coinsAwarded: MATCH_REWARD, coinsTaken: 0 });
  } else {
    // Upsert loser stats
    await db.prepare(
      `INSERT INTO player_stats (gamertag, losses, total_matches, win_streak, best_streak, last_fighter, last_match_at)
       VALUES (?, 1, 1, 0, 0, ?, datetime('now'))
       ON CONFLICT(gamertag) DO UPDATE SET
         losses = losses + 1,
         total_matches = total_matches + 1,
         win_streak = 0,
         last_fighter = excluded.last_fighter,
         last_match_at = excluded.last_match_at`
    ).bind(gamertag, fighter || null).run();

    return successResponse({ coinsAwarded: 0, coinsTaken: 0 });
  }
}
