import { DurableObject } from 'cloudflare:workers';
import type { Env, Fighter, TriviaQuestion, GameItem } from '../lib/types';
import { VALID_FIGHTER_IDS, getFighterById } from '../lib/fighterData';
import { getItemById, VALID_ITEM_IDS } from '../lib/itemData';
import { calculateDamage, getRandomTrivia, calculateSelfDamage, applyItemStats } from '../lib/gameLogic';

interface MatchPlayer {
  id: string;
  username: string;
  fighter: Fighter;
  currentHp: number;
  selectedItem?: GameItem | null;
  itemUsed?: boolean;
  /** Modified stats after pre_match item application */
  modifiedStats?: { atk: number; def: number };
}

interface MatchState {
  id: string;
  player1: MatchPlayer | null;
  player2: MatchPlayer | null;
  currentTurn: 'player1' | 'player2';
  turnNumber: number;
  status: 'waiting' | 'active' | 'finished';
  winner?: string;
  currentTrivia?: TriviaQuestion;
  itemsAllowed: boolean;
  itemSelectionPhase?: boolean;
  itemSelectionsReceived?: number;
  scopeCreepTarget?: string;
  /** For The Memo: stores the opponent's pending move before the attacker sees it */
  pendingMoveReveal?: { moveName: string; movePower: number } | null;
  /** Track used trivia indices per fighter to avoid repeats */
  usedTriviaIndices: Record<string, number[]>;
  wagerPhase?: boolean;
  wagerAmount?: number;
  wagerProposerSlot?: 'player1' | 'player2';
  wagerAwaitingSlot?: 'player1' | 'player2';
  wagerMaxAmount?: number;
  player1Balance?: number;
  player2Balance?: number;
}

/**
 * MatchRoom Durable Object
 *
 * Per-match instance that holds authoritative game state.
 * Uses WebSocket tags to identify players (survives hibernation).
 * Turn-based combat: answer trivia about opponent -> determines attack effectiveness.
 *
 * Security: Only accepts a fighterId parameter (not full fighter JSON).
 * The fighterId is validated against the allowed roster and the full
 * Fighter object is looked up server-side from the canonical data.
 *
 * Items: If itemsAllowed is true on match init, an item selection phase
 * occurs before the first turn. Items are validated server-side by ID.
 */
export class MatchRoom extends DurableObject<Env> {
  private state: MatchState | null = null;

  private async loadOrCreateState(matchId: string): Promise<MatchState> {
    if (!this.state) {
      this.state = await this.ctx.storage.get<MatchState>('match') || null;
    }
    if (!this.state) {
      this.state = {
        id: matchId,
        player1: null,
        player2: null,
        currentTurn: 'player1',
        turnNumber: 0,
        status: 'waiting',
        itemsAllowed: false,
        usedTriviaIndices: {},
      };
    }
    return this.state;
  }

  private async loadState(): Promise<MatchState | null> {
    if (!this.state) {
      this.state = await this.ctx.storage.get<MatchState>('match') || null;
    }
    return this.state;
  }

  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put('match', this.state);
    }
  }

  /** Get the WebSocket for a given player slot using tags (survives hibernation) */
  private getWs(slot: 'player1' | 'player2'): WebSocket | null {
    const sockets = this.ctx.getWebSockets(slot);
    return sockets.length > 0 ? sockets[0] : null;
  }

  /** Identify which slot a WebSocket belongs to */
  private getSlot(ws: WebSocket): 'player1' | 'player2' | null {
    const tags = this.ctx.getTags(ws);
    if (tags.includes('player1')) return 'player1';
    if (tags.includes('player2')) return 'player2';
    return null;
  }

  private broadcast(message: Record<string, unknown>, exclude?: WebSocket): void {
    const msg = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== exclude) {
        try { ws.send(msg); } catch { /* disconnected */ }
      }
    }
  }

  private sendTo(slot: 'player1' | 'player2', message: Record<string, unknown>): void {
    const ws = this.getWs(slot);
    if (ws) {
      try { ws.send(JSON.stringify(message)); } catch { /* disconnected */ }
    }
  }

  private sendToWs(ws: WebSocket, message: Record<string, unknown>): void {
    try { ws.send(JSON.stringify(message)); } catch { /* disconnected */ }
  }

  /**
   * Record match result in D1: upsert winner/loser stats + LennyCoin transfer.
   * Called server-side when a match ends, replacing the old unauthenticated POST /api/v1/stats endpoint.
   */
  private async recordMatchResult(
    winner: string,
    loser: string,
    winnerFighter: string,
    loserFighter: string,
    reason: string,
    matchState?: MatchState | null,
  ): Promise<{ coinsAwarded: number; coinsTaken: number }> {
    const db = this.env.DB;

    // Upsert winner
    await db.prepare(
      `INSERT INTO player_stats (gamertag, wins, total_matches, win_streak, best_streak, last_fighter, last_match_at)
       VALUES (?, 1, 1, 1, 1, ?, datetime('now'))
       ON CONFLICT(gamertag) DO UPDATE SET
         wins = wins + 1,
         total_matches = total_matches + 1,
         win_streak = win_streak + 1,
         best_streak = MAX(best_streak, win_streak + 1),
         last_fighter = excluded.last_fighter,
         last_match_at = excluded.last_match_at`
    ).bind(winner, winnerFighter || null).run();

    // Upsert loser
    await db.prepare(
      `INSERT INTO player_stats (gamertag, losses, total_matches, win_streak, best_streak, last_fighter, last_match_at)
       VALUES (?, 1, 1, 0, 0, ?, datetime('now'))
       ON CONFLICT(gamertag) DO UPDATE SET
         losses = losses + 1,
         total_matches = total_matches + 1,
         win_streak = 0,
         last_fighter = excluded.last_fighter,
         last_match_at = excluded.last_match_at`
    ).bind(loser, loserFighter || null).run();

    // LennyCoin logic
    const MATCH_REWARD = 10;

    const loserRow = await db.prepare(
      'SELECT lennycoins FROM player_stats WHERE gamertag = ?'
    ).bind(loser).first() as { lennycoins: number } | null;
    const loserBalance: number = loserRow?.lennycoins ?? 0;

    let coinsAwarded = 0;
    let coinsTaken = 0;

    if (loserBalance === 0) {
      // Mint new coins for winner (single atomic update)
      coinsAwarded = MATCH_REWARD;
      await db.prepare(
        'UPDATE player_stats SET lennycoins = lennycoins + ? WHERE gamertag = ?'
      ).bind(MATCH_REWARD, winner).run();
    } else {
      // Transfer from loser to winner — atomic batch to prevent double-spend
      const transfer = Math.min(loserBalance, MATCH_REWARD);
      coinsAwarded = transfer;
      coinsTaken = transfer;
      const results = await db.batch([
        db.prepare(
          'UPDATE player_stats SET lennycoins = lennycoins - ? WHERE gamertag = ? AND lennycoins >= ?'
        ).bind(transfer, loser, transfer),
        db.prepare(
          'UPDATE player_stats SET lennycoins = lennycoins + ? WHERE gamertag = ?'
        ).bind(transfer, winner),
      ]);
      // If debit didn't apply (concurrent drain), no coins transferred
      if (results[0].meta.changes === 0) {
        coinsAwarded = 0;
        coinsTaken = 0;
      }
    }

    // Wager payout: transfer wager amount from loser to winner
    if (matchState?.wagerAmount && matchState.wagerAmount > 0) {
      const wagerResults = await db.batch([
        db.prepare('UPDATE player_stats SET lennycoins = lennycoins - ? WHERE gamertag = ? AND lennycoins >= ?')
          .bind(matchState.wagerAmount, loser, matchState.wagerAmount),
        db.prepare('UPDATE player_stats SET lennycoins = lennycoins + ? WHERE gamertag = ?')
          .bind(matchState.wagerAmount, winner),
      ]);
      if (wagerResults[0].meta.changes > 0) {
        coinsAwarded += matchState.wagerAmount;
        coinsTaken += matchState.wagerAmount;
      }
    }

    return { coinsAwarded, coinsTaken };
  }

  /**
   * End the match: record stats in D1, then broadcast match_end with coin info.
   * D1 failures are caught so the match_end message still reaches clients.
   */
  private async endMatch(
    state: MatchState,
    winnerId: string,
    reason: string,
  ): Promise<void> {
    state.status = 'finished';
    state.winner = winnerId;

    // Determine winner/loser gamertags and fighters
    const winnerIsP1 = winnerId === state.player1?.id;
    const winnerPlayer = winnerIsP1 ? state.player1 : state.player2;
    const loserPlayer = winnerIsP1 ? state.player2 : state.player1;

    let coinsAwarded = 0;
    let coinsTaken = 0;

    if (winnerPlayer && loserPlayer) {
      try {
        const result = await this.recordMatchResult(
          winnerPlayer.username,
          loserPlayer.username,
          winnerPlayer.fighter.id,
          loserPlayer.fighter.id,
          reason,
          this.state,
        );
        coinsAwarded = result.coinsAwarded;
        coinsTaken = result.coinsTaken;
      } catch (err) {
        // D1 failure should not prevent match_end from being sent
        console.error('Failed to record match result:', err);
      }
    }

    this.broadcast({
      type: 'match_end',
      winner: winnerId,
      reason,
      coinsAwarded,
      coinsTaken,
    });
  }

  /**
   * Apply pre_match item effects (stat boosts, turn order).
   * Called after both players have selected items, before the first turn.
   */
  private applyPreMatchItems(state: MatchState): void {
    for (const slot of ['player1', 'player2'] as const) {
      const player = state[slot];
      if (!player?.selectedItem) continue;
      const item = player.selectedItem;

      if (item.timing !== 'pre_match') continue;

      const newStats = applyItemStats(player.fighter, item);
      if (newStats) {
        player.modifiedStats = newStats;
        player.itemUsed = true;
        this.broadcast({
          type: 'item_activated',
          playerId: player.id,
          itemName: item.name,
          description: item.description,
        });
      } else switch (item.effect) {
        case 'go_first': {
          state.currentTurn = slot;
          player.itemUsed = true;
          this.broadcast({
            type: 'item_activated',
            playerId: player.id,
            itemName: item.name,
            description: item.description,
          });
          break;
        }
      }
    }
  }

  /**
   * Start the pre-match wager negotiation phase.
   * Query both players' LC balances; if either has 0, skip to startMatch.
   */
  private async startWagerPhase(state: MatchState): Promise<void> {
    const db = this.env.DB;

    const [p1Row, p2Row] = await Promise.all([
      db.prepare('SELECT lennycoins FROM player_stats WHERE gamertag = ?')
        .bind(state.player1!.username).first() as Promise<{ lennycoins: number } | null>,
      db.prepare('SELECT lennycoins FROM player_stats WHERE gamertag = ?')
        .bind(state.player2!.username).first() as Promise<{ lennycoins: number } | null>,
    ]);

    const p1Balance = p1Row?.lennycoins ?? 0;
    const p2Balance = p2Row?.lennycoins ?? 0;

    if (p1Balance === 0 || p2Balance === 0) {
      this.startMatch(state);
      return;
    }

    const maxWager = Math.min(p1Balance, p2Balance);
    state.wagerPhase = true;
    state.wagerMaxAmount = maxWager;
    state.player1Balance = p1Balance;
    state.player2Balance = p2Balance;
    state.wagerProposerSlot = state.currentTurn;
    state.wagerAwaitingSlot = state.currentTurn;

    this.broadcast({
      type: 'wager_phase_start',
      player1Balance: p1Balance,
      player2Balance: p2Balance,
      maxWager,
      proposerSlot: state.currentTurn,
      timeout: 15,
    });

    await this.ctx.storage.put('alarm_type', 'wager_timeout');
    await this.ctx.storage.setAlarm(Date.now() + 15_000);
  }

  /**
   * Start the actual match (send match_start, trivia, etc.).
   * Called after item selection completes (or immediately if items not allowed).
   */
  private startMatch(state: MatchState): void {
    state.status = 'active';
    state.turnNumber = 1;

    // Apply pre-match items before the first turn
    if (state.itemsAllowed) {
      this.applyPreMatchItems(state);
    }

    // Randomize first turn (unless an item like First-Mover Advantage overrode it)
    if (state.currentTurn === 'player1' && !state.player1?.selectedItem?.effect?.includes('go_first') &&
        !state.player2?.selectedItem?.effect?.includes('go_first')) {
      state.currentTurn = Math.random() < 0.5 ? 'player1' : 'player2';
    }

    const attackerSlot = state.currentTurn;
    const defenderSlot = attackerSlot === 'player1' ? 'player2' : 'player1';
    const defender = state[defenderSlot]!;

    const trivia = getRandomTrivia(defender.fighter, state.usedTriviaIndices);
    state.currentTrivia = trivia;

    this.broadcast({
      type: 'match_start',
      player1: {
        id: state.player1!.id,
        username: state.player1!.username,
        fighter: state.player1!.fighter,
        hp: state.player1!.currentHp,
        itemName: state.player1!.selectedItem?.name || null,
      },
      player2: {
        id: state.player2!.id,
        username: state.player2!.username,
        fighter: state.player2!.fighter,
        hp: state.player2!.currentHp,
        itemName: state.player2!.selectedItem?.name || null,
      },
      currentTurn: state.currentTurn,
      turnNumber: 1,
      wagerAmount: state.wagerAmount || 0,
    });

    // Check if active player has an unused active_use item
    const attacker = state[attackerSlot]!;
    const hasActiveItem = attacker.selectedItem
      && !attacker.itemUsed
      && (attacker.selectedItem.timing === 'active_use');

    // Send trivia to active player with item availability info
    const triviaMsg: Record<string, unknown> = {
      type: 'trivia',
      question: trivia.question,
      options: trivia.options,
      canUseItem: hasActiveItem,
    };

    // Hook Model (trivia_phase): eliminate one wrong answer
    if (attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'eliminate_wrong_answer') {
      const wrongIndices = trivia.options
        .map((opt, i) => opt !== trivia.answer ? i : -1)
        .filter(i => i >= 0);
      if (wrongIndices.length > 0) {
        triviaMsg.eliminatedOption = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
        attacker.itemUsed = true;
        this.broadcast({
          type: 'item_activated',
          playerId: attacker.id,
          itemName: attacker.selectedItem.name,
          description: attacker.selectedItem.description,
        });
      }
    }

    this.sendTo(attackerSlot, triviaMsg);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for players
    if (request.headers.get('Upgrade') === 'websocket') {
      const verifiedGamertag = url.searchParams.get('verifiedGamertag');
      const fighterId = url.searchParams.get('fighterId');
      const itemsAllowed = url.searchParams.get('itemsAllowed') === 'true';

      if (!verifiedGamertag || !fighterId) {
        return new Response('Missing player data', { status: 400 });
      }

      const playerId = verifiedGamertag;
      const username = verifiedGamertag;

      // Validate fighterId against the allowed roster
      if (!VALID_FIGHTER_IDS.includes(fighterId)) {
        return new Response('Invalid fighter ID', { status: 400 });
      }

      // Look up the full fighter data server-side (never trust client-supplied stats)
      const fighter = getFighterById(fighterId)!;

      // Extract matchId from the URL path
      const matchIdMatch = url.pathname.match(/\/ws\/match\/([^/]+)/);
      const matchId = matchIdMatch ? matchIdMatch[1] : `match_${Date.now()}`;

      // Auto-create state if it doesn't exist
      const state = await this.loadOrCreateState(matchId);

      // If the first player to connect passes itemsAllowed, set it on state
      if (itemsAllowed && !state.player1 && !state.player2) {
        state.itemsAllowed = true;
      }

      // If this match already finished, reset state for a fresh match.
      // This handles the case where a new matchId maps to the same DO instance
      // (idFromName is deterministic) before the cleanup alarm fires.
      if (state.status === 'finished') {
        this.state = {
          id: matchId,
          player1: null,
          player2: null,
          currentTurn: 'player1',
          turnNumber: 0,
          status: 'waiting',
          itemsAllowed: false,
          usedTriviaIndices: {},
        };
        await this.ctx.storage.deleteAll();
      }

      const playerData: MatchPlayer = {
        id: playerId,
        username,
        fighter,
        currentHp: fighter.stats.hp,
        selectedItem: null,
        itemUsed: false,
      };

      // Check if this player is reconnecting to an existing slot
      let slot: 'player1' | 'player2';
      let isReconnect = false;

      if (state.player1 && state.player1.id === verifiedGamertag) {
        slot = 'player1';
        isReconnect = true;
        // Fighter data comes from server-side lookup, not from the client
        state.player1.fighter = fighter;
        state.player1.username = username;
      } else if (state.player2 && state.player2.id === verifiedGamertag) {
        slot = 'player2';
        isReconnect = true;
        state.player2.fighter = fighter;
        state.player2.username = username;
      } else if (!state.player1) {
        state.player1 = playerData;
        slot = 'player1';
      } else if (!state.player2) {
        state.player2 = playerData;
        slot = 'player2';
      } else {
        return new Response('Match full', { status: 400 });
      }

      // Create WebSocket pair with tag for slot identification (survives hibernation)
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Close any stale WebSocket for this slot before accepting the new one
      if (isReconnect) {
        const oldWs = this.getWs(slot);
        if (oldWs) {
          try { oldWs.close(1000, 'Replaced by reconnection'); } catch { /* already closed */ }
        }
        // Clear the disconnect grace period if one was pending
        const alarmType = await this.ctx.storage.get<string>('alarm_type');
        if (alarmType === 'disconnect_grace') {
          await this.ctx.storage.delete('alarm_type');
          await this.ctx.storage.delete('disconnected_slot');
          await this.ctx.storage.deleteAlarm();
        }
      }

      this.ctx.acceptWebSocket(server, [slot]);

      this.sendToWs(server, { type: 'joined', slot, matchId: state.id });

      if (isReconnect && state.status === 'active' && state.player1 && state.player2) {
        // Re-send current match state to the reconnected player
        this.sendToWs(server, {
          type: 'match_start',
          player1: {
            id: state.player1.id,
            username: state.player1.username,
            fighter: state.player1.fighter,
            hp: state.player1.currentHp,
            itemName: state.player1.selectedItem?.name || null,
          },
          player2: {
            id: state.player2.id,
            username: state.player2.username,
            fighter: state.player2.fighter,
            hp: state.player2.currentHp,
            itemName: state.player2.selectedItem?.name || null,
          },
          currentTurn: state.currentTurn,
          turnNumber: state.turnNumber,
        });

        // If it's the reconnected player's turn, re-send trivia
        if (state.currentTurn === slot && state.currentTrivia) {
          const attacker = state[slot]!;
          const hasActiveItem = attacker.selectedItem
            && !attacker.itemUsed
            && attacker.selectedItem.timing === 'active_use';

          this.sendToWs(server, {
            type: 'trivia',
            question: state.currentTrivia.question,
            options: state.currentTrivia.options,
            canUseItem: hasActiveItem,
          });
        }
      } else if (isReconnect && state.itemSelectionPhase) {
        // Reconnected during item selection -- re-send the selection start
        this.sendToWs(server, { type: 'item_selection_start' });
      } else if (!isReconnect && state.player1 && state.player2) {
        // Both players connected for the first time
        if (state.itemsAllowed) {
          // Start item selection phase
          state.itemSelectionPhase = true;
          state.itemSelectionsReceived = 0;
          this.broadcast({ type: 'item_selection_start' });

          // Set a 15-second timeout for item selection
          await this.ctx.storage.put('alarm_type', 'item_selection_timeout');
          await this.ctx.storage.setAlarm(Date.now() + 15_000);
        } else {
          // No items -- start immediately
          await this.startWagerPhase(state);
        }
      }

      await this.saveState();
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      // Ignore malformed messages
      return;
    }

    // Reload state from storage (may have been lost to hibernation)
    const state = await this.loadState();
    if (!state) return;

    // Use tags to identify the player (survives hibernation, unlike in-memory refs)
    const slot = this.getSlot(ws);
    if (!slot) return;

    // --- Item Selection Phase ---
    if (data.type === 'item_select' && state.itemSelectionPhase) {
      const player = state[slot];
      if (!player) return;

      // Validate item ID if provided
      if (data.itemId && typeof data.itemId === 'string') {
        if (!VALID_ITEM_IDS.includes(data.itemId)) {
          this.sendToWs(ws, { type: 'error', message: 'Invalid item ID' });
          return;
        }
        player.selectedItem = getItemById(data.itemId) || null;
      } else {
        player.selectedItem = null;
      }
      player.itemUsed = false;

      state.itemSelectionsReceived = (state.itemSelectionsReceived || 0) + 1;

      // Both selected? Start the match
      if (state.itemSelectionsReceived >= 2) {
        state.itemSelectionPhase = false;
        // Cancel the timeout alarm
        await this.ctx.storage.delete('alarm_type');
        await this.ctx.storage.deleteAlarm();

        // If either player opted out, strip items from both (mutual consent)
        if (!state.player1?.selectedItem || !state.player2?.selectedItem) {
          if (state.player1) { state.player1.selectedItem = null; state.player1.itemUsed = false; }
          if (state.player2) { state.player2.selectedItem = null; state.player2.itemUsed = false; }
          state.itemsAllowed = false;
        }

        this.broadcast({ type: 'item_selection_complete' });
        await this.startWagerPhase(state);
      }

      await this.saveState();
      return;
    }

    // --- Wager Phase ---
    if (state.wagerPhase) {
      if (data.type === 'wager_propose') {
        if (state.wagerAwaitingSlot !== slot) return;
        const amount = Number(data.amount);
        if (!amount || amount <= 0 || amount > (state.wagerMaxAmount || 0)) return;

        state.wagerAmount = amount;
        const otherSlot = slot === 'player1' ? 'player2' : 'player1';
        state.wagerAwaitingSlot = otherSlot;

        this.sendTo(otherSlot, { type: 'wager_proposed', amount, proposer: slot });

        // Reset 15s alarm
        await this.ctx.storage.put('alarm_type', 'wager_timeout');
        await this.ctx.storage.setAlarm(Date.now() + 15_000);

        await this.saveState();
        return;
      }

      if (data.type === 'wager_accept') {
        if (state.wagerAwaitingSlot !== slot) return;

        this.broadcast({ type: 'wager_finalized', amount: state.wagerAmount });
        await this.ctx.storage.delete('alarm_type');
        await this.ctx.storage.deleteAlarm();
        state.wagerPhase = false;
        this.startMatch(state);

        await this.saveState();
        return;
      }

      if (data.type === 'wager_counter') {
        if (state.wagerAwaitingSlot !== slot) return;
        const amount = Number(data.amount);
        if (!amount || amount <= 0 || amount > (state.wagerMaxAmount || 0)) return;

        if (amount <= (state.wagerAmount || 0)) {
          // Auto-accept at the lower amount
          state.wagerAmount = amount;
          this.broadcast({ type: 'wager_finalized', amount });
          await this.ctx.storage.delete('alarm_type');
          await this.ctx.storage.deleteAlarm();
          state.wagerPhase = false;
          this.startMatch(state);
        } else {
          // Counter with higher amount — send back to original proposer
          state.wagerAmount = amount;
          state.wagerAwaitingSlot = state.wagerProposerSlot;
          this.sendTo(state.wagerProposerSlot!, { type: 'wager_counter_received', amount });

          // Reset 15s alarm
          await this.ctx.storage.put('alarm_type', 'wager_timeout');
          await this.ctx.storage.setAlarm(Date.now() + 15_000);
        }

        await this.saveState();
        return;
      }

      if (data.type === 'wager_skip') {
        state.wagerAmount = 0;
        state.wagerPhase = false;
        await this.ctx.storage.delete('alarm_type');
        await this.ctx.storage.deleteAlarm();
        this.broadcast({ type: 'wager_finalized', amount: 0 });
        this.startMatch(state);

        await this.saveState();
        return;
      }
    }

    // --- Active Item Use ---
    if (data.type === 'item_use' && state.status === 'active') {
      const currentSlot = state.currentTurn;
      if (slot !== currentSlot) return; // Not your turn

      const player = state[slot]!;
      if (!player.selectedItem || player.itemUsed) return;
      if (player.selectedItem.timing !== 'active_use') return;

      const item = player.selectedItem;
      const opponentSlot = slot === 'player1' ? 'player2' : 'player1';
      const opponent = state[opponentSlot]!;

      switch (item.effect) {
        case 'heal_30pct': {
          const healAmount = Math.round(player.fighter.stats.hp * 0.30);
          player.currentHp = Math.min(player.fighter.stats.hp, player.currentHp + healAmount);
          player.itemUsed = true;
          this.broadcast({
            type: 'item_activated',
            playerId: player.id,
            itemName: item.name,
            description: `Restored ${healAmount} HP`,
            player1Hp: state.player1!.currentHp,
            player2Hp: state.player2!.currentHp,
          });
          break;
        }
        case 'nullify_type':
        case 'double_damage':
        case 'steal_move': {
          // These are applied during damage calculation; just mark as "pending use"
          // We store a flag so the answer handler knows to apply it
          await this.ctx.storage.put('pending_item_use', item.effect);
          this.broadcast({
            type: 'item_activated',
            playerId: player.id,
            itemName: item.name,
            description: item.description,
          });
          player.itemUsed = true;
          break;
        }
        case 'invert_answer': {
          // Set scope creep target to opponent
          state.scopeCreepTarget = opponent.id;
          player.itemUsed = true;
          this.broadcast({
            type: 'item_activated',
            playerId: player.id,
            itemName: item.name,
            description: item.description,
          });
          break;
        }
      }

      await this.saveState();
      return;
    }

    // --- Answer / Attack Phase ---
    if (data.type === 'answer' && state.status === 'active') {
      const currentSlot = state.currentTurn;
      const isMyTurn = slot === currentSlot;
      if (!isMyTurn) return;

      // Immediately switch turn to block duplicate answer messages
      const nextTurn = currentSlot === 'player1' ? 'player2' : 'player1';
      state.currentTurn = nextTurn;

      const attacker = state[currentSlot]!;
      const defenderSlot = currentSlot === 'player1' ? 'player2' : 'player1';
      const defender = state[defenderSlot]!;

      let correct = data.answer === state.currentTrivia?.answer;

      // Scope Creep: if this attacker is the scope creep target, invert their correct answer
      if (state.scopeCreepTarget === attacker.id && correct) {
        correct = false;
        state.scopeCreepTarget = undefined; // One-time effect
        this.broadcast({
          type: 'item_activated',
          playerId: defender.id,
          itemName: 'Scope Creep',
          description: 'Correct answer was inverted!',
        });
      }

      // Determine which move to use
      let moveIdx = Math.min(Number(data.moveIndex) || 0, attacker.fighter.moves.length - 1);
      let move = attacker.fighter.moves[moveIdx];

      // Check for pending item effects
      const pendingItemUse = await this.ctx.storage.get<string>('pending_item_use');
      let nullifyType = false;
      let doubleDamage = false;

      if (pendingItemUse) {
        await this.ctx.storage.delete('pending_item_use');

        switch (pendingItemUse) {
          case 'nullify_type':
            nullifyType = true;
            break;
          case 'double_damage':
            doubleDamage = true;
            break;
          case 'steal_move': {
            // Use opponent's highest-power move
            const highestMove = [...defender.fighter.moves].sort((a, b) => b.power - a.power)[0];
            if (highestMove) {
              move = highestMove;
            }
            break;
          }
        }
      }

      const damage = calculateDamage(move, correct, attacker, defender, { nullifyType, doubleDamage });
      defender.currentHp = Math.max(0, defender.currentHp - damage);

      // Self-damage on wrong answer
      let selfDamage = calculateSelfDamage(move.power, correct);
      if (selfDamage > 0) {
        // Pivot Potion: block self-damage
        if (attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'block_self_damage') {
          selfDamage = 0;
          attacker.itemUsed = true;
          this.broadcast({
            type: 'item_activated',
            playerId: attacker.id,
            itemName: attacker.selectedItem.name,
            description: 'Self-damage blocked!',
          });
        } else {
          attacker.currentHp = Math.max(0, attacker.currentHp - selfDamage);
        }
      }

      this.broadcast({
        type: 'turn_result',
        attacker: attacker.id,
        defender: defender.id,
        move: move.name,
        correct,
        damage,
        selfDamage,
        player1Hp: state.player1!.currentHp,
        player2Hp: state.player2!.currentHp,
        turnNumber: state.turnNumber,
        correctAnswer: state.currentTrivia?.answer,
      });

      // Check for KO with Bridge Round revival
      let defenderKO = defender.currentHp <= 0;
      let attackerKO = attacker.currentHp <= 0;

      // Bridge Round: revive with 20% HP
      if (defenderKO && defender.selectedItem && !defender.itemUsed && defender.selectedItem.effect === 'revive_20pct') {
        const reviveHp = Math.round(defender.fighter.stats.hp * 0.20);
        defender.currentHp = reviveHp;
        defender.itemUsed = true;
        defenderKO = false;
        this.broadcast({
          type: 'item_activated',
          playerId: defender.id,
          itemName: defender.selectedItem.name,
          description: `Revived with ${reviveHp} HP!`,
          player1Hp: state.player1!.currentHp,
          player2Hp: state.player2!.currentHp,
        });
      }

      if (attackerKO && attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'revive_20pct') {
        const reviveHp = Math.round(attacker.fighter.stats.hp * 0.20);
        attacker.currentHp = reviveHp;
        attacker.itemUsed = true;
        attackerKO = false;
        this.broadcast({
          type: 'item_activated',
          playerId: attacker.id,
          itemName: attacker.selectedItem.name,
          description: `Revived with ${reviveHp} HP!`,
          player1Hp: state.player1!.currentHp,
          player2Hp: state.player2!.currentHp,
        });
      }

      // Final KO check
      if (defenderKO || attackerKO) {
        const winnerId = defenderKO ? attacker.id : defender.id;
        const reason = defenderKO ? 'ko' : 'self_ko';

        await this.endMatch(state, winnerId, reason);

        // Schedule cleanup after match ends
        await this.ctx.storage.put('alarm_type', 'cleanup');
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
      } else {
        // Next turn
        state.turnNumber++;

        // Get trivia from the opponent's fighter (attacker answers about defender)
        const nextAttackerSlot = state.currentTurn;
        const nextDefenderSlot = nextAttackerSlot === 'player1' ? 'player2' : 'player1';
        const nextAttacker = state[nextAttackerSlot]!;
        const nextDefender = state[nextDefenderSlot]!;
        const trivia = getRandomTrivia(nextDefender.fighter, state.usedTriviaIndices);
        state.currentTrivia = trivia;

        // Check if next attacker has an active_use item available
        const hasActiveItem = nextAttacker.selectedItem
          && !nextAttacker.itemUsed
          && nextAttacker.selectedItem.timing === 'active_use';

        const triviaMsg: Record<string, unknown> = {
          type: 'trivia',
          question: trivia.question,
          options: trivia.options,
          canUseItem: hasActiveItem,
        };

        // Hook Model: eliminate one wrong answer for the attacker
        if (nextAttacker.selectedItem && !nextAttacker.itemUsed && nextAttacker.selectedItem.effect === 'eliminate_wrong_answer') {
          const wrongIndices = trivia.options
            .map((opt, i) => opt !== trivia.answer ? i : -1)
            .filter(i => i >= 0);
          if (wrongIndices.length > 0) {
            triviaMsg.eliminatedOption = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
            nextAttacker.itemUsed = true;
            this.broadcast({
              type: 'item_activated',
              playerId: nextAttacker.id,
              itemName: nextAttacker.selectedItem.name,
              description: nextAttacker.selectedItem.description,
            });
          }
        }

        // The Memo (passive): reveal opponent's move before attacker picks
        // For The Memo, the defender's last selected move is not known ahead of time,
        // but the item reveals the opponent's *upcoming* move. Since we don't have that
        // yet, we reveal the opponent's highest-power move as a preview.
        if (nextAttacker.selectedItem && !nextAttacker.itemUsed && nextAttacker.selectedItem.effect === 'reveal_move') {
          const opponentMoves = nextDefender.fighter.moves;
          // Reveal all of the opponent's moves so the attacker can strategize
          triviaMsg.revealedMoves = opponentMoves.map(m => ({ name: m.name, power: m.power, type: m.type }));
        }

        this.sendTo(state.currentTurn, triviaMsg);
        this.broadcast({ type: 'turn_change', currentTurn: state.currentTurn, turnNumber: state.turnNumber });
      }

      await this.saveState();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const state = await this.loadState();
    if (!state) return;

    const slot = this.getSlot(ws);
    if (!slot) return;

    if (state.status === 'active' || state.itemSelectionPhase) {
      // Give the player a 20-second grace period to reconnect before forfeiting
      await this.ctx.storage.put('alarm_type', 'disconnect_grace');
      await this.ctx.storage.put('disconnected_slot', slot);
      await this.ctx.storage.setAlarm(Date.now() + 20_000);
    }
  }

  async alarm(): Promise<void> {
    const alarmType = await this.ctx.storage.get<string>('alarm_type');

    if (alarmType === 'item_selection_timeout') {
      // Item selection timed out -- start the match with whatever has been selected
      await this.ctx.storage.delete('alarm_type');

      const state = await this.loadState();
      if (!state || !state.itemSelectionPhase) return;

      state.itemSelectionPhase = false;
      // Players who didn't select get null item (already the default)

      this.broadcast({ type: 'item_selection_complete' });
      await this.startWagerPhase(state);
      await this.saveState();
    } else if (alarmType === 'wager_timeout') {
      await this.ctx.storage.delete('alarm_type');

      const state = await this.loadState();
      if (!state || !state.wagerPhase) return;

      state.wagerAmount = 0;
      state.wagerPhase = false;
      this.broadcast({ type: 'wager_finalized', amount: 0 });
      this.startMatch(state);
      await this.saveState();
    } else if (alarmType === 'disconnect_grace') {
      const slot = await this.ctx.storage.get<string>('disconnected_slot') as 'player1' | 'player2' | undefined;
      // Clean up alarm metadata
      await this.ctx.storage.delete('alarm_type');
      await this.ctx.storage.delete('disconnected_slot');

      if (!slot) return;

      const state = await this.loadState();
      if (!state || (state.status !== 'active' && !state.itemSelectionPhase)) return;

      // Check if the player reconnected (has an active WebSocket)
      const ws = this.getWs(slot);
      if (ws) return; // They reconnected, no forfeit

      // Player did not reconnect -- forfeit
      const winnerId = slot === 'player1' ? state.player2?.id : state.player1?.id;
      state.itemSelectionPhase = false;

      if (winnerId) {
        await this.endMatch(state, winnerId, 'disconnect');
      } else {
        state.status = 'finished';
        this.broadcast({ type: 'match_end', winner: null, reason: 'disconnect', coinsAwarded: 0, coinsTaken: 0 });
      }

      await this.saveState();

      // Schedule cleanup since match is now finished
      await this.ctx.storage.put('alarm_type', 'cleanup');
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    } else if (alarmType === 'cleanup') {
      // Match ended -- clean up all storage for this Durable Object
      await this.ctx.storage.deleteAll();
      this.state = null;
    }
  }
}
