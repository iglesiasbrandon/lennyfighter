import { getEnv } from '../../../../../lib/env';
import { successResponse, errorResponse } from '../../../../../lib/utils';

const GAMERTAG_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

export async function POST(request: Request) {
  const env = getEnv();
  const body = await request.json() as { gamertag?: string };

  if (!body.gamertag || !GAMERTAG_REGEX.test(body.gamertag)) {
    return errorResponse('INVALID_GAMERTAG', 'Gamertag must be 3-16 alphanumeric characters or underscores', 400);
  }

  const token = crypto.randomUUID();
  await env.KV.put(`session:${token}`, body.gamertag, { expirationTtl: 3600 });

  return successResponse({ token });
}
