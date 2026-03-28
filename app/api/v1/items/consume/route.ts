import { getEnv } from '../../../../../lib/env';
import { successResponse, errorResponse } from '../../../../../lib/utils';
import { VALID_ITEM_IDS } from '../../../../../lib/itemData';

/**
 * Item Consumption API
 *
 * POST /api/v1/items/consume -- Decrement an item from the player's inventory after use in a match
 */
export async function POST(request: Request) {
  const env = getEnv();

  let body: { item_id: string; gamertag: string };
  try {
    body = await request.json() as { item_id: string; gamertag: string };
  } catch {
    return errorResponse('INVALID_JSON', 'Invalid JSON body');
  }

  if (!body.gamertag) {
    return errorResponse('UNAUTHORIZED', 'gamertag is required', 401);
  }

  if (!body.item_id || !VALID_ITEM_IDS.includes(body.item_id)) {
    return errorResponse('INVALID_ITEM', 'Unknown item ID');
  }

  // Look up player_id from gamertag
  const player = await env.DB.prepare(
    'SELECT id FROM players WHERE username = ?'
  ).bind(body.gamertag).first<{ id: string }>();

  if (!player) {
    return errorResponse('PLAYER_NOT_FOUND', 'Player not found', 404);
  }

  // Atomic decrement — prevents race condition where two concurrent requests
  // both read quantity=1 and both succeed. The WHERE quantity > 0 guard ensures
  // we only decrement if there's stock, and meta.changes tells us if it worked.
  const result = await env.DB.prepare(
    'UPDATE player_items SET quantity = quantity - 1 WHERE player_id = ? AND item_id = ? AND quantity > 0'
  ).bind(player.id, body.item_id).run();

  if (result.meta.changes === 0) {
    return errorResponse('NO_ITEM', 'You do not own this item', 400);
  }

  // Get the new quantity for the response
  const updated = await env.DB.prepare(
    'SELECT quantity FROM player_items WHERE player_id = ? AND item_id = ?'
  ).bind(player.id, body.item_id).first<{ quantity: number }>();

  return successResponse({
    item_id: body.item_id,
    remaining: updated?.quantity ?? 0,
    message: 'Item consumed',
  });
}
