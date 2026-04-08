export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ success: false, error: { code, message } }, status);
}

export function successResponse<T>(data: T, pagination?: { page: number; per_page: number; total: number }): Response {
  return jsonResponse({ success: true, data, ...(pagination ? { pagination } : {}) });
}

/** Look up a player's ID by their gamertag (username). Returns null if not found. */
export async function getPlayerIdByGamertag(db: D1Database, gamertag: string): Promise<string | null> {
  const row = await db.prepare('SELECT id FROM players WHERE username = ?').bind(gamertag).first() as { id: string } | null;
  return row?.id ?? null;
}
