
import { getEnv } from '../../../../../lib/env';
import { successResponse } from '../../../../../lib/utils';

/**
 * GET /api/v1/players/check?username={gamertag}
 *
 * Check if a gamertag is available.
 */
export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return successResponse({ available: false });
  }

  const existing = await env.DB.prepare('SELECT id FROM players WHERE username = ?').bind(username).first();
  return successResponse({ available: !existing });
}
