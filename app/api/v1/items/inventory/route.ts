import { getEnv } from '../../../../../lib/env';
import { successResponse, errorResponse } from '../../../../../lib/utils';
import { getItemById } from '../../../../../lib/itemData';
import type { GameItem } from '../../../../../lib/types';

/**
 * Inventory API
 *
 * GET /api/v1/items/inventory?gamertag=xxx -- List player's inventory with item details
 */
export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const gamertag = url.searchParams.get('gamertag');

  if (!gamertag) {
    return errorResponse('UNAUTHORIZED', 'gamertag query parameter required', 401);
  }

  // Look up player_id from gamertag
  const player = await env.DB.prepare(
    'SELECT id FROM players WHERE username = ?'
  ).bind(gamertag).first<{ id: string }>();

  if (!player) {
    // No player record yet — return empty inventory
    return successResponse([]);
  }

  const rows = await env.DB.prepare(
    'SELECT item_id, quantity, purchased_at FROM player_items WHERE player_id = ? AND quantity > 0'
  ).bind(player.id).all<{ item_id: string; quantity: number; purchased_at: string }>();

  const items = (rows.results || []).map(row => {
    const item = getItemById(row.item_id);
    return {
      item: item as GameItem,
      quantity: row.quantity,
      purchasedAt: row.purchased_at,
    };
  }).filter(entry => entry.item != null);

  return successResponse(items);
}
