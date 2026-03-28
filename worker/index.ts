/**
 * LennyFighter — Cloudflare Worker entry point
 *
 * Exports the Vinext handler + all Durable Object classes.
 * Routes WebSocket upgrades to Durable Objects, and wraps
 * regular requests in runWithEnv() so API routes can access bindings.
 *
 * -------------------------------------------------------------------
 * RATE LIMITING (production recommendation)
 * -------------------------------------------------------------------
 * Rate limiting should be configured via Cloudflare Rate Limiting Rules
 * in the dashboard (Security > WAF > Rate limiting rules), not in
 * application code. Recommended configuration:
 *
 * 1. Unauthenticated endpoints — per-IP limits:
 *    - POST /api/v1/players (registration): 5 req/min per IP
 *    - GET /api/v1/items: 60 req/min per IP
 *
 * 2. Authenticated endpoints — per-gamertag/IP limits:
 *    - Rate-limit key is the gamertag (from session token) or IP fallback
 *    - General API calls: 120 req/min per gamertag
 *    - Item purchases: 30 req/min per gamertag
 *
 * 3. WebSocket connections:
 *    - Limit new WS upgrades to 10/min per IP
 *
 * Cloudflare's built-in rate limiting runs at the edge before the
 * Worker executes, which is more efficient and harder to bypass than
 * any in-code solution.
 * -------------------------------------------------------------------
 */
import { handleImageOptimization } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runWithEnv } from "../lib/env";
import type { Env } from "../lib/types";

// Re-export Durable Objects so Cloudflare can instantiate them
export { MatchRoom } from "../durableObjects/MatchRoom";
export { MatchmakingQueue } from "../durableObjects/MatchmakingQueue";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isUpgrade = request.headers.get("Upgrade") === "websocket";

    // Authenticate all WebSocket upgrade requests via KV session token
    if (isUpgrade) {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Missing auth token", { status: 401 });
      }

      const gamertag = await env.KV.get(`session:${token}`);
      if (!gamertag) {
        return new Response("Invalid or expired token", { status: 401 });
      }

      // Rewrite URL: strip client-supplied identity params, inject verified gamertag
      const rewrittenUrl = new URL(url.toString());
      rewrittenUrl.searchParams.delete("token");
      rewrittenUrl.searchParams.delete("playerId");
      rewrittenUrl.searchParams.delete("username");
      rewrittenUrl.searchParams.set("verifiedGamertag", gamertag);
      const authedRequest = new Request(rewrittenUrl.toString(), request);

      // WebSocket: matchmaking queue (singleton)
      if (url.pathname === "/ws/matchmaking") {
        const id = env.MATCHMAKING_QUEUE.idFromName("global");
        const stub = env.MATCHMAKING_QUEUE.get(id);
        return stub.fetch(authedRequest);
      }

      // WebSocket: match room (per-match)
      const matchWsMatch = url.pathname.match(/^\/ws\/match\/(.+)$/);
      if (matchWsMatch) {
        const matchId = matchWsMatch[1];
        const id = env.MATCH_ROOM.idFromName(matchId);
        const stub = env.MATCH_ROOM.get(id);
        return stub.fetch(authedRequest);
      }
    }

    // REST: initialize a match room
    if (url.pathname.match(/^\/api\/match\/(.+)\/init$/) && request.method === "POST") {
      const matchId = url.pathname.match(/^\/api\/match\/(.+)\/init$/)![1];
      const id = env.MATCH_ROOM.idFromName(matchId);
      const stub = env.MATCH_ROOM.get(id);
      return stub.fetch(request);
    }

    // Image optimization (only if IMAGES binding is available)
    if (url.pathname === "/_vinext/image" && env.IMAGES) {
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      });
    }

    // Wrap in runWithEnv so API routes can access bindings via getEnv()
    return runWithEnv(env, () => handler.fetch(request));
  },
};
