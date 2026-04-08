import { getEnv } from '../../../../lib/env';
import { successResponse, errorResponse, getPlayerIdByGamertag } from '../../../../lib/utils';
import { getAllItems, getItemById, VALID_ITEM_IDS } from '../../../../lib/itemData';

const MAX_ITEM_QUANTITY = 3;

/**
 * Items API
 *
 * GET /api/v1/items  -- List all available items in the shop
 * POST /api/v1/items -- Purchase an item (costs LennyCoin)
 */
export async function GET() {
  const items = getAllItems();
  return successResponse(items);
}

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

  const item = getItemById(body.item_id)!;

  // Verify gamertag exists in player_stats
  const statsRow = await env.DB.prepare(
    'SELECT lennycoins FROM player_stats WHERE gamertag = ?'
  ).bind(body.gamertag).first<{ lennycoins: number }>();

  if (!statsRow) {
    return errorResponse('NO_STATS', 'Play a match first to earn LennyCoin', 400);
  }

  if (statsRow.lennycoins < item.cost) {
    return errorResponse('INSUFFICIENT_COINS', 'Not enough LennyCoin', 400);
  }

  // Look up the player record to get player_id for inventory
  let playerId = await getPlayerIdByGamertag(env.DB, body.gamertag);

  if (!playerId) {
    // Auto-create a player record for this gamertag
    playerId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO players (id, username) VALUES (?, ?)'
    ).bind(playerId, body.gamertag).run();
  }

  return await completePurchase(env, playerId, body.gamertag, item, statsRow.lennycoins);
}

async function completePurchase(
  env: ReturnType<typeof getEnv>,
  playerId: string,
  gamertag: string,
  item: ReturnType<typeof getItemById> & {},
  currentCoins: number,
) {
  // Check current quantity
  const existing = await env.DB.prepare(
    'SELECT quantity FROM player_items WHERE player_id = ? AND item_id = ?'
  ).bind(playerId, item.id).first<{ quantity: number }>();

  if (existing && existing.quantity >= MAX_ITEM_QUANTITY) {
    return errorResponse('MAX_QUANTITY', `You already have the maximum of ${MAX_ITEM_QUANTITY} of this item`);
  }

  // Deduct cost and insert/update inventory atomically via D1 batch
  const deductStmt = env.DB.prepare(
    'UPDATE player_stats SET lennycoins = lennycoins - ? WHERE gamertag = ? AND lennycoins >= ?'
  ).bind(item.cost, gamertag, item.cost);

  const inventoryStmt = existing
    ? env.DB.prepare(
        'UPDATE player_items SET quantity = quantity + 1 WHERE player_id = ? AND item_id = ?'
      ).bind(playerId, item.id)
    : env.DB.prepare(
        'INSERT INTO player_items (id, player_id, item_id, quantity) VALUES (?, ?, ?, 1)'
      ).bind(crypto.randomUUID(), playerId, item.id);

  const batchResults = await env.DB.batch([deductStmt, inventoryStmt]);

  // Verify the deduction actually affected a row (guards against race conditions)
  if (!batchResults[0].meta.changes) {
    return errorResponse('INSUFFICIENT_COINS', 'Not enough LennyCoin', 400);
  }

  return successResponse({
    item,
    quantity: existing ? existing.quantity + 1 : 1,
    remaining_coins: currentCoins - item.cost,
    message: `Purchased ${item.name} for ${item.cost} LennyCoin`,
  });
}
