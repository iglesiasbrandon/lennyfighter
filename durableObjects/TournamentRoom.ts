import { DurableObject } from 'cloudflare:workers';
import type { Env, TournamentState, TournamentPlayer, BracketMatch } from '../lib/types';
import { VALID_FIGHTER_IDS } from '../lib/fighterData';
import { seedBracket, applyResultToBracket, isValidBracketSize } from '../lib/bracket';

/** No-show deadline window for an unplayed bracket match (5 minutes). */
const NO_SHOW_MS = 300_000;
/** Delay before a finished tournament's storage is wiped (10 minutes). */
const CLEANUP_MS = 600_000;

/** Persisted alarm bookkeeping — kept under a single storage key. */
interface AlarmData {
  /** Map of bracket matchId -> epoch-ms deadline by which it must resolve. */
  noshow: Record<string, number>;
  /** Epoch-ms at which finished-tournament storage should be wiped. */
  cleanupAt?: number;
}

/**
 * TournamentRoom Durable Object
 *
 * Single-elimination tournament orchestrator. Per-tournament instance,
 * addressed by a 4-char join code. It does NOT run combat — the existing
 * MatchRoom DO handles individual matches. This DO seeds the bracket,
 * tracks the roster, and advances winners as results are reported.
 *
 * Uses WebSocket tags (one tag per player gamertag) to identify sockets,
 * which survives hibernation. The full TournamentState is both the storage
 * value and the wire payload of every `state` message.
 *
 * Security: accepts only a fighterId (validated server-side against the
 * canonical roster) and a worker-injected verifiedGamertag.
 */
export class TournamentRoom extends DurableObject<Env> {
  private state: TournamentState | null = null;

  // ---- State persistence (storage key: 'tournament') ----

  private async loadOrCreateState(code: string): Promise<TournamentState> {
    if (!this.state) {
      this.state = await this.ctx.storage.get<TournamentState>('tournament') || null;
    }
    if (!this.state) {
      this.state = {
        code,
        adminGamertag: null,
        status: 'lobby',
        bracketSize: 8,
        roster: [],
        matches: [],
        champion: null,
        createdAt: Date.now(),
      };
    }
    return this.state;
  }

  private async loadState(): Promise<TournamentState | null> {
    if (!this.state) {
      this.state = await this.ctx.storage.get<TournamentState>('tournament') || null;
    }
    return this.state;
  }

  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put('tournament', this.state);
    }
  }

  // ---- Alarm bookkeeping (storage key: 'alarm_data') ----

  private async loadAlarmData(): Promise<AlarmData> {
    return await this.ctx.storage.get<AlarmData>('alarm_data') || { noshow: {} };
  }

  private async saveAlarmData(data: AlarmData): Promise<void> {
    await this.ctx.storage.put('alarm_data', data);
  }

  /** Register a no-show deadline for a round match and re-arm the alarm. */
  private async registerNoShow(matchId: string): Promise<void> {
    const data = await this.loadAlarmData();
    data.noshow[matchId] = Date.now() + NO_SHOW_MS;
    await this.saveAlarmData(data);
    await this.rearmAlarm();
  }

  /** Remove a no-show deadline (match resolved) and re-arm the alarm. */
  private async clearNoShow(matchId: string): Promise<void> {
    const data = await this.loadAlarmData();
    if (matchId in data.noshow) {
      delete data.noshow[matchId];
      await this.saveAlarmData(data);
    }
    await this.rearmAlarm();
  }

  /** Schedule a cleanup wipe and re-arm the alarm. */
  private async registerCleanup(): Promise<void> {
    const data = await this.loadAlarmData();
    data.cleanupAt = Date.now() + CLEANUP_MS;
    await this.saveAlarmData(data);
    await this.rearmAlarm();
  }

  /** Set the DO alarm to the soonest of all pending deadlines. */
  private async rearmAlarm(): Promise<void> {
    const data = await this.loadAlarmData();
    let soonest: number | null = null;
    for (const deadline of Object.values(data.noshow)) {
      if (soonest === null || deadline < soonest) soonest = deadline;
    }
    if (data.cleanupAt !== undefined && (soonest === null || data.cleanupAt < soonest)) {
      soonest = data.cleanupAt;
    }
    if (soonest === null) {
      await this.ctx.storage.deleteAlarm();
    } else {
      await this.ctx.storage.setAlarm(soonest);
    }
  }

  // ---- Messaging helpers ----

  private broadcast(message: Record<string, unknown>): void {
    const msg = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(msg); } catch { /* disconnected */ }
    }
  }

  private sendTo(ws: WebSocket, message: Record<string, unknown>): void {
    try { ws.send(JSON.stringify(message)); } catch { /* disconnected */ }
  }

  /** Broadcast a full state snapshot to every connected socket. */
  private broadcastState(state: TournamentState): void {
    this.broadcast({ type: 'state', state });
  }

  /** Identify a socket's owning gamertag from its single tag. */
  private gamertagOf(ws: WebSocket): string | null {
    const tags = this.ctx.getTags(ws);
    return tags.length > 0 ? tags[0] : null;
  }

  // ---- Bracket advancement (shared by report path + alarm) ----

  /**
   * Apply a resolved result to the bracket, mark the loser eliminated,
   * tear down the resolved match's no-show deadline, and chain onward
   * (champion -> cleanup, newlyReady -> fresh no-show deadline).
   */
  private async advanceBracket(
    state: TournamentState,
    tournamentMatchId: string,
    winnerGamertag: string,
  ): Promise<void> {
    const result = applyResultToBracket(state.matches, tournamentMatchId, winnerGamertag);
    if (!result.resolved) return;

    // Mark the loser eliminated.
    const resolved = result.resolved;
    const loser = resolved.p1 === winnerGamertag ? resolved.p2 : resolved.p1;
    if (loser) {
      const loserEntry = state.roster.find(r => r.gamertag === loser);
      if (loserEntry) loserEntry.eliminated = true;
    }

    // The resolved match no longer needs a no-show deadline.
    await this.clearNoShow(resolved.matchId);

    if (result.champion) {
      state.status = 'finished';
      state.champion = result.champion;
      await this.registerCleanup();
    }

    if (result.newlyReady) {
      await this.registerNoShow(result.newlyReady.matchId);
    }
  }

  // ---- HTTP / WebSocket entry point ----

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- Internal result report (non-websocket POST) ---
    if (request.method === 'POST' && url.pathname.endsWith('/internal/report')) {
      let body: Record<string, unknown>;
      try {
        body = await request.json() as Record<string, unknown>;
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
      }

      const tournamentMatchId = typeof body.tournamentMatchId === 'string' ? body.tournamentMatchId : null;
      const winnerGamertag = typeof body.winnerGamertag === 'string' ? body.winnerGamertag : null;
      if (!tournamentMatchId || !winnerGamertag) {
        return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 });
      }

      const state = await this.loadState();
      if (!state) {
        return Response.json({ ok: false, error: 'No tournament' }, { status: 404 });
      }

      await this.advanceBracket(state, tournamentMatchId, winnerGamertag);
      this.broadcastState(state);
      await this.saveState();
      return Response.json({ ok: true });
    }

    // --- WebSocket upgrade ---
    if (request.headers.get('Upgrade') === 'websocket') {
      const verifiedGamertag = url.searchParams.get('verifiedGamertag');
      const fighterId = url.searchParams.get('fighterId');

      if (!verifiedGamertag || !fighterId) {
        return new Response('Missing player data', { status: 400 });
      }

      // Extract the 4-char code from /ws/tournament/:code
      const codeMatch = url.pathname.match(/\/ws\/tournament\/([^/]+)/);
      const code = codeMatch ? codeMatch[1].toUpperCase() : '';

      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Validate fighterId — accept then close so the client sees the code.
      if (!VALID_FIGHTER_IDS.includes(fighterId)) {
        this.ctx.acceptWebSocket(server, [verifiedGamertag]);
        server.close(4002, 'Invalid fighter ID');
        return new Response(null, { status: 101, webSocket: client });
      }

      const state = await this.loadOrCreateState(code);

      // --- Roster handling ---
      const existing = state.roster.find(r => r.gamertag === verifiedGamertag);

      if (existing) {
        // RECONNECT: refresh fighter, mark connected, drop any stale socket.
        existing.fighterId = fighterId;
        existing.connected = true;
        for (const stale of this.ctx.getWebSockets(verifiedGamertag)) {
          try { stale.close(1000, 'Replaced by reconnection'); } catch { /* already closed */ }
        }
      } else if (state.status !== 'lobby') {
        // New player can't join an in-progress / finished tournament.
        this.ctx.acceptWebSocket(server, [verifiedGamertag]);
        server.close(4003, 'Tournament already started');
        return new Response(null, { status: 101, webSocket: client });
      } else if (state.roster.length >= state.bracketSize) {
        // Lobby is full.
        this.ctx.acceptWebSocket(server, [verifiedGamertag]);
        server.close(4004, 'Tournament full');
        return new Response(null, { status: 101, webSocket: client });
      } else {
        // New player joins the lobby. First joiner becomes admin.
        const player: TournamentPlayer = {
          gamertag: verifiedGamertag,
          fighterId,
          connected: true,
          eliminated: false,
        };
        state.roster.push(player);
        if (state.adminGamertag === null) {
          state.adminGamertag = verifiedGamertag;
        }
      }

      // Accept with the gamertag as the single tag.
      this.ctx.acceptWebSocket(server, [verifiedGamertag]);

      // tournament_joined first, then a full state snapshot to this socket.
      this.sendTo(server, { type: 'tournament_joined', code: state.code, yourGamertag: verifiedGamertag });
      this.sendTo(server, { type: 'state', state });

      // In lobby, the roster changed — let everyone see it.
      if (state.status === 'lobby') {
        this.broadcastState(state);
      }

      await this.saveState();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  // ---- WebSocket message handling ----

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw)) as Record<string, unknown>;
    } catch {
      // Ignore malformed messages.
      return;
    }

    const state = await this.loadState();
    if (!state) return;

    const sender = this.gamertagOf(ws);
    if (!sender) return;

    const isAdmin = sender === state.adminGamertag;

    if (data.type === 'set_bracket_size') {
      const size = Number(data.size);
      if (isAdmin && state.status === 'lobby' && isValidBracketSize(size)) {
        state.bracketSize = size;
        this.broadcastState(state);
        await this.saveState();
      } else {
        this.sendTo(ws, { type: 'error', message: 'Cannot change bracket size' });
      }
      return;
    }

    if (data.type === 'start') {
      if (!isAdmin || state.status !== 'lobby') {
        this.sendTo(ws, { type: 'error', message: 'Only the admin can start the tournament' });
        return;
      }
      if (!isValidBracketSize(state.roster.length)) {
        this.sendTo(ws, { type: 'error', message: 'Need 4, 8, or 16 players to start' });
        return;
      }

      state.bracketSize = state.roster.length;
      state.matches = seedBracket(state.roster.map(r => r.gamertag), state.code);
      state.status = 'in_progress';

      // Register no-show deadlines for every round-0 match (status 'ready').
      for (const match of state.matches) {
        if (match.status === 'ready') {
          await this.registerNoShow(match.matchId);
        }
      }

      this.broadcastState(state);
      await this.saveState();
      return;
    }

    if (data.type === 'request_state') {
      this.sendTo(ws, { type: 'state', state });
      return;
    }
  }

  // ---- WebSocket close handling ----

  async webSocketClose(ws: WebSocket): Promise<void> {
    const state = await this.loadState();
    if (!state) return;

    const gamertag = this.gamertagOf(ws);
    if (!gamertag) return;

    if (state.status === 'lobby') {
      // Remove from roster; promote a new admin if this was the admin.
      state.roster = state.roster.filter(r => r.gamertag !== gamertag);
      if (state.adminGamertag === gamertag) {
        state.adminGamertag = state.roster[0]?.gamertag ?? null;
      }
      this.broadcastState(state);
      await this.saveState();
    } else {
      // In-progress / finished: keep their bracket slot, just mark offline.
      const entry = state.roster.find(r => r.gamertag === gamertag);
      if (entry) entry.connected = false;
      this.broadcastState(state);
      await this.saveState();
    }
  }

  // ---- Alarm: no-show forfeits + finished-tournament cleanup ----

  async alarm(): Promise<void> {
    const now = Date.now();
    const data = await this.loadAlarmData();
    const state = await this.loadState();

    // Cleanup wipe takes precedence — nothing else matters afterward.
    if (data.cleanupAt !== undefined && data.cleanupAt <= now) {
      await this.ctx.storage.deleteAll();
      this.state = null;
      return;
    }

    if (!state) {
      await this.rearmAlarm();
      return;
    }

    // Force-advance every past-due no-show whose match is not yet done.
    const dueMatchIds = Object.entries(data.noshow)
      .filter(([, deadline]) => deadline <= now)
      .map(([matchId]) => matchId);

    for (const matchId of dueMatchIds) {
      const match: BracketMatch | undefined = state.matches.find(m => m.matchId === matchId);
      if (!match || match.status === 'done') {
        // Stale entry — drop it.
        await this.clearNoShow(matchId);
        continue;
      }

      // Winner: prefer a still-connected participant, else fall back to p1.
      let winner: string | null = null;
      for (const candidate of [match.p1, match.p2]) {
        if (!candidate) continue;
        const entry = state.roster.find(r => r.gamertag === candidate);
        if (entry?.connected) { winner = candidate; break; }
      }
      if (!winner) winner = match.p1;
      if (!winner) {
        // Nobody to advance — drop the deadline.
        await this.clearNoShow(matchId);
        continue;
      }

      await this.advanceBracket(state, matchId, winner);
    }

    this.broadcastState(state);
    await this.saveState();
    await this.rearmAlarm();
  }
}
