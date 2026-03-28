
import { getEnv } from '../../../../lib/env';
import { successResponse, errorResponse, generateId } from '../../../../lib/utils';

const GAMERTAG_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

/**
 * POST /api/v1/players -- Register a new player
 *
 * Creates a local player record in LennyFighter's D1 (username, game data).
 * No API key is generated or returned -- gamertag is the sole identity.
 */
export async function POST(request: Request) {
  const env = getEnv();

  let body: { username: string };
  try {
    body = await request.json() as { username: string };
  } catch {
    return new Response(JSON.stringify({ success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (!body.username || !GAMERTAG_REGEX.test(body.username)) {
    return errorResponse('INVALID_REQUEST', 'Gamertag required (3-16 characters, alphanumeric and underscores only)');
  }

  // Check uniqueness
  const existing = await env.DB.prepare('SELECT id FROM players WHERE username = ?').bind(body.username).first();
  if (existing) return errorResponse('USERNAME_TAKEN', 'Gamertag already in use');

  const playerId = generateId();

  // Create player record in local D1 (no API key)
  await env.DB.prepare(
    `INSERT INTO players (id, username) VALUES (?, ?)`
  ).bind(playerId, body.username).run();

  return successResponse({
    player_id: playerId,
    username: body.username,
    message: 'Player created.',
  }, undefined);
}
