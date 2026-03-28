import { DurableObject } from 'cloudflare:workers';
import { VALID_FIGHTER_IDS } from '../lib/fighterData';

interface QueuedPlayer {
  id: string;
  username: string;
  level: number;
  fighterId: string;
  ws: WebSocket;
  joinedAt: number;
}

/**
 * MatchmakingQueue Durable Object
 *
 * Single global instance that manages the matchmaking queue.
 * Players connect via WebSocket and wait to be paired.
 * Pairing algorithm: closest level within +/- 3, FIFO within range.
 * After 15 seconds, expands range to any level.
 *
 * Security: Only accepts a fighterId parameter (not full fighter JSON).
 * The fighterId is validated against the allowed roster before queuing.
 */
export class MatchmakingQueue extends DurableObject {
  private queue: QueuedPlayer[] = [];
  private matchCounter = 0;
  private alarmScheduled = false;

  private tryMatch(): void {
    if (this.queue.length < 2) return;

    for (let i = 0; i < this.queue.length; i++) {
      const player = this.queue[i];
      const waitTime = Date.now() - player.joinedAt;
      const levelRange = waitTime > 15000 ? 999 : 3;

      for (let j = i + 1; j < this.queue.length; j++) {
        const opponent = this.queue[j];
        if (Math.abs(player.level - opponent.level) <= levelRange) {
          // Match found
          this.queue.splice(j, 1);
          this.queue.splice(i, 1);
          this.createMatch(player, opponent);
          return;
        }
      }
    }
  }

  private createMatch(p1: QueuedPlayer, p2: QueuedPlayer): void {
    this.matchCounter++;
    const rand = Math.random().toString(36).slice(2, 8);
    const matchId = `match_${Date.now()}_${this.matchCounter}_${rand}`;

    const matchInfo = { type: 'match_found', matchId };

    try { p1.ws.send(JSON.stringify({ ...matchInfo, slot: 'player1', opponent: { id: p2.id, username: p2.username, level: p2.level } })); } catch { /* disconnected */ }
    try { p2.ws.send(JSON.stringify({ ...matchInfo, slot: 'player2', opponent: { id: p1.id, username: p1.username, level: p1.level } })); } catch { /* disconnected */ }
  }

  private async scheduleAlarm(): Promise<void> {
    if (this.alarmScheduled) return;
    this.alarmScheduled = true;
    // Use DO alarm for periodic matching (every 3 seconds)
    await this.ctx.storage.setAlarm(Date.now() + 3000);
  }

  async alarm(): Promise<void> {
    this.alarmScheduled = false;
    this.tryMatch();
    // Keep scheduling while there are players waiting
    if (this.queue.length > 0) {
      await this.scheduleAlarm();
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ success: true, data: { queueSize: this.queue.length } });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);

    const url = new URL(request.url);
    const verifiedGamertag = url.searchParams.get('verifiedGamertag');
    const level = parseInt(url.searchParams.get('level') || '1');
    const fighterId = url.searchParams.get('fighterId') || '';

    if (!verifiedGamertag) {
      server.close(4001, 'Missing verified gamertag');
      return new Response(null, { status: 101, webSocket: client });
    }

    const playerId = verifiedGamertag;
    const username = verifiedGamertag;

    // Validate fighterId against the allowed roster
    if (!VALID_FIGHTER_IDS.includes(fighterId)) {
      server.close(4002, 'Invalid fighter ID');
      return new Response(null, { status: 101, webSocket: client });
    }

    // Remove player if already in queue
    this.queue = this.queue.filter(p => p.id !== playerId);

    const queuedPlayer: QueuedPlayer = {
      id: playerId,
      username,
      level,
      fighterId,
      ws: server,
      joinedAt: Date.now(),
    };

    this.queue.push(queuedPlayer);
    this.sendTo(server, { type: 'queued', position: this.queue.length, queueSize: this.queue.length });

    // Try to match immediately
    this.tryMatch();

    // Schedule alarm for periodic matching
    await this.scheduleAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  private sendTo(ws: WebSocket, message: Record<string, unknown>): void {
    try { ws.send(JSON.stringify(message)); } catch { /* disconnected */ }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));

    if (data.type === 'cancel') {
      this.queue = this.queue.filter(p => p.ws !== ws);
      this.sendTo(ws, { type: 'cancelled' });
      ws.close(1000, 'Cancelled');
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.queue = this.queue.filter(p => p.ws !== ws);
  }
}
