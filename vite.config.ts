// Note: Rollup warnings about "treeshake.preset" and "experimentalMinChunkSize" are
// upstream vinext/Vite issues and do not affect the build. They will resolve when vinext updates.
import { defineConfig, type Plugin } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { WebSocketServer } from "ws";
import http from "http";
import type { Duplex } from "stream";
import { VALID_FIGHTER_IDS, getFighterById } from "./lib/fighterData";
import { getItemById, VALID_ITEM_IDS } from "./lib/itemData";
import { getTypeMultiplier, calculateDamage, getRandomTrivia } from './lib/gameLogic';
import type { Fighter, Move, TriviaQuestion, GameItem } from './lib/types';

// Prevent unhandled rejections from crashing the dev server
function catchRejections(): Plugin {
  return {
    name: "catch-unhandled-rejections",
    configureServer() {
      process.on("unhandledRejection", (err) => {
        console.warn("[dev] unhandled rejection (non-fatal):", String(err));
      });
    },
  };
}

/**
 * In-process matchmaking WebSocket server for local dev.
 *
 * The Cloudflare Vite plugin runs our worker in workerd, but
 * Vite's dev server owns the HTTP listener and doesn't proxy
 * WebSocket upgrades to workerd. So we run a lightweight
 * matchmaking + match-room WS server directly in Node.
 */
function localMultiplayerWs(): Plugin {
  return {
    name: "local-multiplayer-ws",
    configureServer() {
      const WS_PORT = 3001;
      const wsHttpServer = http.createServer();
      const wss = new WebSocketServer({ noServer: true });

      wsHttpServer.listen(WS_PORT, () => {
        console.log(`[ws] Multiplayer WebSocket server running on port ${WS_PORT}`);
      });

      // Matchmaking queue
      interface QueuedPlayer {
        id: string;
        username: string;
        level: number;
        fighterId: string;
        ws: import("ws").WebSocket;
      }
      const queue: QueuedPlayer[] = [];
      let matchCounter = 0;

      // Match rooms
      interface MatchPlayer {
        id: string;
        username: string;
        fighter: Fighter;
        currentHp: number;
        ws: import("ws").WebSocket;
        slot: "player1" | "player2";
        selectedItem: GameItem | null;
        itemUsed: boolean;
        modifiedStats: { atk: number; def: number } | null;
      }

      interface MatchRoom {
        id: string;
        players: Map<string, MatchPlayer>;
        state: {
          currentTurn: "player1" | "player2";
          turnNumber: number;
          status: "waiting" | "active" | "finished";
          currentTrivia?: { question: string; options: string[]; answer: string };
          player1?: MatchPlayer;
          player2?: MatchPlayer;
          itemsAllowed: boolean;
          itemSelectionPhase: boolean;
          itemSelectionsReceived: number;
          scopeCreepTarget: string | null;
          pendingItem: { nullifyType?: boolean; doubleDamage?: boolean; stealMove?: boolean } | null;
          itemSelectionTimeout?: ReturnType<typeof setTimeout>;
          usedTriviaIndices: Record<string, number[]>;
          wagerPhase: boolean;
          wagerAmount: number;
          wagerProposerSlot: 'player1' | 'player2' | null;
          wagerAwaitingSlot: 'player1' | 'player2' | null;
          wagerMaxAmount: number;
          player1Balance: number;
          player2Balance: number;
          wagerTimeout?: ReturnType<typeof setTimeout>;
        };
      }
      const matchRooms = new Map<string, MatchRoom>();
      // Grace period timers for reconnecting players (React strict mode double-mounts)
      const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

      function tryMatch() {
        if (queue.length < 2) return;
        console.log(`[matchmaking] Queue has ${queue.length} players, attempting match...`);
        const p1 = queue.shift()!;
        const p2 = queue.shift()!;
        matchCounter++;
        const rand = Math.random().toString(36).slice(2, 8);
        const matchId = `match_${Date.now()}_${matchCounter}_${rand}`;
        console.log(`[matchmaking] Match found: ${p1.username} vs ${p2.username} → ${matchId}`);

        const msg1 = JSON.stringify({ type: "match_found", matchId, slot: "player1", opponent: { id: p2.id, username: p2.username, level: p2.level } });
        const msg2 = JSON.stringify({ type: "match_found", matchId, slot: "player2", opponent: { id: p1.id, username: p1.username, level: p1.level } });
        try { p1.ws.send(msg1); } catch {}
        try { p2.ws.send(msg2); } catch {}

        // Pre-create the match room
        matchRooms.set(matchId, {
          id: matchId,
          players: new Map(),
          state: {
            currentTurn: "player1",
            turnNumber: 0,
            status: "waiting",
            itemsAllowed: true,
            itemSelectionPhase: false,
            itemSelectionsReceived: 0,
            scopeCreepTarget: null,
            pendingItem: null,
            usedTriviaIndices: {},
            wagerPhase: false,
            wagerAmount: 0,
            wagerProposerSlot: null,
            wagerAwaitingSlot: null,
            wagerMaxAmount: 0,
            player1Balance: 0,
            player2Balance: 0,
          },
        });
      }

      function broadcastToRoom(room: MatchRoom, msg: object, exclude?: import("ws").WebSocket) {
        const data = JSON.stringify(msg);
        for (const p of room.players.values()) {
          if (p.ws !== exclude && p.ws.readyState === 1) {
            try { p.ws.send(data); } catch {}
          }
        }
      }

      function sendTo(ws: import("ws").WebSocket, msg: object) {
        if (ws.readyState === 1) {
          try { ws.send(JSON.stringify(msg)); } catch {}
        }
      }

      function sendToSlot(room: MatchRoom, slot: 'player1' | 'player2', msg: object) {
        for (const p of room.players.values()) {
          if (p.slot === slot && p.ws.readyState === 1) {
            try { p.ws.send(JSON.stringify(msg)); } catch {}
          }
        }
      }

      function startWagerPhase(room: MatchRoom) {
        // Dev mode: simulate coin balances (100 LC each)
        const DEV_BALANCE = 100;
        room.state.player1Balance = DEV_BALANCE;
        room.state.player2Balance = DEV_BALANCE;
        room.state.wagerMaxAmount = DEV_BALANCE;
        room.state.wagerPhase = true;
        room.state.wagerProposerSlot = room.state.currentTurn;
        room.state.wagerAwaitingSlot = room.state.currentTurn;

        broadcastToRoom(room, {
          type: 'wager_phase_start',
          player1Balance: DEV_BALANCE,
          player2Balance: DEV_BALANCE,
          maxWager: DEV_BALANCE,
          proposerSlot: room.state.currentTurn,
          timeout: 15,
        });

        // 15-second timeout
        room.state.wagerTimeout = setTimeout(() => {
          room.state.wagerPhase = false;
          room.state.wagerAmount = 0;
          broadcastToRoom(room, { type: 'wager_finalized', amount: 0 });
          startMatch(room);
        }, 15_000);
      }

      /**
       * Apply pre_match item effects (stat boosts, turn order).
       * Called after both players have selected items, before the first turn.
       */
      function applyPreMatchItems(room: MatchRoom) {
        for (const player of room.players.values()) {
          if (!player.selectedItem) continue;
          const item = player.selectedItem;
          if (item.timing !== 'pre_match') continue;

          switch (item.effect) {
            case 'atk_boost_def_penalty': {
              const atkMult = 1 + (item.atkBoost || 0.30);
              const defMult = 1 - (item.defPenalty || 0.15);
              player.modifiedStats = {
                atk: Math.round(player.fighter.stats.atk * atkMult),
                def: Math.round(player.fighter.stats.def * defMult),
              };
              player.itemUsed = true;
              broadcastToRoom(room, {
                type: 'item_activated',
                playerId: player.id,
                itemName: item.name,
                description: item.description,
              });
              break;
            }
            case 'def_boost': {
              const defMult = 1 + (item.defBoost || 0.30);
              player.modifiedStats = {
                atk: player.fighter.stats.atk,
                def: Math.round(player.fighter.stats.def * defMult),
              };
              player.itemUsed = true;
              broadcastToRoom(room, {
                type: 'item_activated',
                playerId: player.id,
                itemName: item.name,
                description: item.description,
              });
              break;
            }
            case 'go_first': {
              room.state.currentTurn = player.slot;
              player.itemUsed = true;
              broadcastToRoom(room, {
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
       * Start the actual match (send match_start, trivia, etc.).
       * Called after item selection completes (or immediately if items not allowed).
       */
      function startMatch(room: MatchRoom) {
        const players = Array.from(room.players.values());
        const p1 = players.find((p) => p.slot === "player1")!;
        const p2 = players.find((p) => p.slot === "player2")!;

        room.state.status = "active";
        room.state.turnNumber = 1;
        room.state.player1 = p1;
        room.state.player2 = p2;

        // Apply pre-match items before the first turn
        if (room.state.itemsAllowed) {
          applyPreMatchItems(room);
        }

        // Randomize first turn (unless an item overrode it)
        if (room.state.currentTurn === "player1") {
          const p1HasGoFirst = p1.selectedItem?.effect === 'go_first';
          const p2HasGoFirst = p2.selectedItem?.effect === 'go_first';
          if (!p1HasGoFirst && !p2HasGoFirst) {
            room.state.currentTurn = Math.random() < 0.5 ? "player1" : "player2";
          }
        }

        const attackerSlot = room.state.currentTurn;
        const defenderSlot = attackerSlot === "player1" ? "player2" : "player1";
        const attacker = attackerSlot === "player1" ? p1 : p2;
        const defender = defenderSlot === "player1" ? p1 : p2;

        // Trivia comes from the opponent's fighter
        const trivia = getRandomTrivia(defender.fighter, room.state.usedTriviaIndices);
        room.state.currentTrivia = trivia;

        broadcastToRoom(room, {
          type: "match_start",
          player1: { id: p1.id, username: p1.username, fighter: p1.fighter, hp: p1.currentHp, itemName: p1.selectedItem?.name || null },
          player2: { id: p2.id, username: p2.username, fighter: p2.fighter, hp: p2.currentHp, itemName: p2.selectedItem?.name || null },
          currentTurn: room.state.currentTurn,
          turnNumber: 1,
          wagerAmount: room.state.wagerAmount || 0,
        });

        // Check if active player has an unused active_use item
        const hasActiveItem = attacker.selectedItem
          && !attacker.itemUsed
          && (attacker.selectedItem.timing === 'active_use');

        // Build trivia message with item info
        const triviaMsg: Record<string, unknown> = {
          type: "trivia",
          question: trivia.question,
          options: trivia.options,
          canUseItem: hasActiveItem,
        };

        // Hook Model (trivia_phase): eliminate one wrong answer
        if (attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'eliminate_wrong_answer') {
          const wrongIndices = trivia.options
            .map((opt: string, i: number) => opt !== trivia.answer ? i : -1)
            .filter((i: number) => i >= 0);
          if (wrongIndices.length > 0) {
            triviaMsg.eliminatedOption = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
            attacker.itemUsed = true;
            broadcastToRoom(room, {
              type: 'item_activated',
              playerId: attacker.id,
              itemName: attacker.selectedItem.name,
              description: attacker.selectedItem.description,
            });
          }
        }

        // The Memo (passive): reveal opponent's moves
        if (attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'reveal_move') {
          const opponentMoves = defender.fighter.moves;
          triviaMsg.revealedMoves = opponentMoves.map((m: Move) => ({ name: m.name, power: m.power, type: m.type }));
        }

        sendTo(attacker.ws, triviaMsg);
      }

      // Handle WebSocket upgrades on our dedicated server
      wsHttpServer.on("upgrade", (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        console.log(`[ws] upgrade request: ${url.pathname}`);

        if (url.pathname === "/ws/matchmaking") {
          wss.handleUpgrade(req, socket, head, (ws) => {
            const gamertag = url.searchParams.get("gamertag") || url.searchParams.get("playerId") || "anonymous";
            const playerId = gamertag;
            const username = gamertag;
            console.log(`[matchmaking] Player joined: ${username} (${playerId})`);
            const level = parseInt(url.searchParams.get("level") || "1");
            const fighterId = url.searchParams.get("fighterId") || "";

            // Validate fighterId against the allowed roster
            if (!VALID_FIGHTER_IDS.includes(fighterId)) {
              ws.close(4002, "Invalid fighter ID");
              return;
            }

            // Remove if already queued
            const idx = queue.findIndex((p) => p.id === playerId);
            if (idx >= 0) queue.splice(idx, 1);

            queue.push({ id: playerId, username, level, fighterId, ws });
            sendTo(ws, { type: "queued", position: queue.length, queueSize: queue.length });

            tryMatch();

            ws.on("message", (raw) => {
              try {
                const msg = JSON.parse(raw.toString());
                if (msg.type === "cancel") {
                  const i = queue.findIndex((p) => p.ws === ws);
                  if (i >= 0) queue.splice(i, 1);
                  sendTo(ws, { type: "cancelled" });
                  ws.close();
                }
              } catch {}
            });

            ws.on("close", () => {
              const i = queue.findIndex((p) => p.ws === ws);
              if (i >= 0) queue.splice(i, 1);
            });
          });
          return;
        }

        const matchWs = url.pathname.match(/^\/ws\/match\/(.+)$/);
        if (matchWs) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            const matchId = matchWs[1];
            const gamertag = url.searchParams.get("gamertag") || url.searchParams.get("playerId") || "anonymous";
            const playerId = gamertag;
            const username = gamertag;
            console.log(`[match-room] Player ${username} connecting to ${matchId}`);
            const fighterId = url.searchParams.get("fighterId") || "";

            // Validate fighterId and look up the full fighter data server-side
            const fighter = getFighterById(fighterId);
            if (!fighter) {
              ws.close(4002, "Invalid fighter ID");
              return;
            }

            // Get or create room
            if (!matchRooms.has(matchId)) {
              matchRooms.set(matchId, {
                id: matchId,
                players: new Map(),
                state: {
                  currentTurn: "player1",
                  turnNumber: 0,
                  status: "waiting",
                  itemsAllowed: true,
                  itemSelectionPhase: false,
                  itemSelectionsReceived: 0,
                  scopeCreepTarget: null,
                  pendingItem: null,
                  usedTriviaIndices: {},
                  wagerPhase: false,
                  wagerAmount: 0,
                  wagerProposerSlot: null,
                  wagerAwaitingSlot: null,
                  wagerMaxAmount: 0,
                  player1Balance: 0,
                  player2Balance: 0,
                },
              });
            }
            const room = matchRooms.get(matchId)!;

            // Cancel any pending disconnect timer for this player (React strict mode reconnect)
            const timerKey = `${matchId}:${playerId}`;
            if (disconnectTimers.has(timerKey)) {
              clearTimeout(disconnectTimers.get(timerKey)!);
              disconnectTimers.delete(timerKey);
              console.log(`[match-room] Cancelled disconnect timer for ${username} (reconnect)`);
            }

            // Check if this player is already in the room (reconnecting)
            const existing = room.players.get(playerId);
            if (existing) {
              // Update the WebSocket reference
              existing.ws = ws;
              console.log(`[match-room] Player ${username} reconnected as ${existing.slot}. Room ${matchId} has ${room.players.size} player(s)`);
              sendTo(ws, { type: "joined", slot: existing.slot, matchId });

              // If match is already active, re-send match state so the client catches up
              if (room.state.status === "active" && room.players.size === 2) {
                const players = Array.from(room.players.values());
                const p1 = players.find((p) => p.slot === "player1")!;
                const p2 = players.find((p) => p.slot === "player2")!;
                console.log(`[match-room] Re-sending match_start to reconnected player ${username}`);
                sendTo(ws, {
                  type: "match_start",
                  player1: { id: p1.id, username: p1.username, fighter: p1.fighter, hp: p1.currentHp, itemName: p1.selectedItem?.name || null },
                  player2: { id: p2.id, username: p2.username, fighter: p2.fighter, hp: p2.currentHp, itemName: p2.selectedItem?.name || null },
                  currentTurn: room.state.currentTurn,
                  turnNumber: room.state.turnNumber,
                });
                // Re-send trivia if it's this player's turn
                if (room.state.currentTrivia && room.state.currentTurn === existing.slot) {
                  const hasActiveItem = existing.selectedItem
                    && !existing.itemUsed
                    && existing.selectedItem.timing === 'active_use';
                  sendTo(ws, {
                    type: "trivia",
                    question: room.state.currentTrivia.question,
                    options: room.state.currentTrivia.options,
                    canUseItem: hasActiveItem,
                  });
                }
              } else if (room.state.itemSelectionPhase) {
                // Reconnected during item selection -- re-send the selection start
                sendTo(ws, { type: 'item_selection_start' });
              }
            } else {
              const playerCount = room.players.size;

              if (playerCount >= 2) {
                ws.close(4000, "Match full");
                return;
              }

              const slot: "player1" | "player2" = playerCount === 0 ? "player1" : "player2";
              const playerData: MatchPlayer = {
                id: playerId,
                username,
                fighter,
                currentHp: fighter.stats?.hp || 100,
                ws,
                slot,
                selectedItem: null,
                itemUsed: false,
                modifiedStats: null,
              };

              room.players.set(playerId, playerData);
              console.log(`[match-room] Player ${username} joined as ${slot}. Room ${matchId} now has ${room.players.size} player(s)`);
              sendTo(ws, { type: "joined", slot, matchId });
            }

            // If both players are connected and match hasn't started yet, begin item selection or start match
            if (room.players.size === 2 && room.state.status === "waiting") {
              if (room.state.itemsAllowed) {
                // Start item selection phase
                console.log(`[match-room] Both players connected! Starting item selection for ${matchId}`);
                room.state.itemSelectionPhase = true;
                room.state.itemSelectionsReceived = 0;
                broadcastToRoom(room, { type: 'item_selection_start' });

                // Set a 15-second timeout for item selection
                room.state.itemSelectionTimeout = setTimeout(() => {
                  if (!room.state.itemSelectionPhase) return;
                  console.log(`[match-room] Item selection timed out for ${matchId}`);
                  room.state.itemSelectionPhase = false;
                  broadcastToRoom(room, { type: 'item_selection_complete' });
                  startWagerPhase(room);
                }, 15_000);
              } else {
                // No items -- start immediately
                console.log(`[match-room] Both players connected! Starting match ${matchId}`);
                startWagerPhase(room);
              }
            }

            ws.on("message", (raw) => {
              try {
                const msg = JSON.parse(raw.toString());

                // --- Item Selection Phase ---
                if (msg.type === 'item_select' && room.state.itemSelectionPhase) {
                  const currentPlayer = room.players.get(playerId);
                  if (!currentPlayer) return;

                  // Validate item ID if provided
                  if (msg.itemId && typeof msg.itemId === 'string') {
                    if (!VALID_ITEM_IDS.includes(msg.itemId)) {
                      sendTo(ws, { type: 'error', message: 'Invalid item ID' });
                      return;
                    }
                    currentPlayer.selectedItem = getItemById(msg.itemId) || null;
                  } else {
                    currentPlayer.selectedItem = null;
                  }
                  currentPlayer.itemUsed = false;

                  room.state.itemSelectionsReceived++;

                  // Both selected? Start the match
                  if (room.state.itemSelectionsReceived >= 2) {
                    room.state.itemSelectionPhase = false;
                    // Cancel the timeout
                    if (room.state.itemSelectionTimeout) {
                      clearTimeout(room.state.itemSelectionTimeout);
                      room.state.itemSelectionTimeout = undefined;
                    }

                    // If either player opted out, strip items from both (mutual consent)
                    const allPlayers = Array.from(room.players.values());
                    const p1 = allPlayers.find((p) => p.slot === 'player1');
                    const p2 = allPlayers.find((p) => p.slot === 'player2');
                    if (!p1?.selectedItem || !p2?.selectedItem) {
                      if (p1) { p1.selectedItem = null; p1.itemUsed = false; }
                      if (p2) { p2.selectedItem = null; p2.itemUsed = false; }
                      room.state.itemsAllowed = false;
                    }

                    broadcastToRoom(room, { type: 'item_selection_complete' });
                    startWagerPhase(room);
                  }
                  return;
                }

                // --- Wager Phase ---
                if (room.state.wagerPhase) {
                  const wagerPlayer = room.players.get(playerId);
                  if (!wagerPlayer) return;
                  const playerSlot = wagerPlayer.slot;

                  if (msg.type === 'wager_propose' && room.state.wagerAwaitingSlot === playerSlot) {
                    const amount = Math.min(Math.max(0, msg.amount || 0), room.state.wagerMaxAmount);
                    if (amount <= 0) {
                      // Treat as skip
                      clearTimeout(room.state.wagerTimeout);
                      room.state.wagerPhase = false;
                      room.state.wagerAmount = 0;
                      broadcastToRoom(room, { type: 'wager_finalized', amount: 0 });
                      startMatch(room);
                      return;
                    }
                    room.state.wagerAmount = amount;
                    const otherSlot = playerSlot === 'player1' ? 'player2' : 'player1';
                    room.state.wagerAwaitingSlot = otherSlot;
                    sendToSlot(room, otherSlot, { type: 'wager_proposed', amount, proposer: playerSlot });
                    clearTimeout(room.state.wagerTimeout);
                    room.state.wagerTimeout = setTimeout(() => {
                      room.state.wagerPhase = false;
                      room.state.wagerAmount = 0;
                      broadcastToRoom(room, { type: 'wager_finalized', amount: 0 });
                      startMatch(room);
                    }, 15_000);
                  }
                  else if (msg.type === 'wager_accept' && room.state.wagerAwaitingSlot === playerSlot) {
                    clearTimeout(room.state.wagerTimeout);
                    room.state.wagerPhase = false;
                    broadcastToRoom(room, { type: 'wager_finalized', amount: room.state.wagerAmount });
                    startMatch(room);
                  }
                  else if (msg.type === 'wager_counter' && room.state.wagerAwaitingSlot === playerSlot) {
                    const amount = Math.min(Math.max(0, msg.amount || 0), room.state.wagerMaxAmount);
                    clearTimeout(room.state.wagerTimeout);
                    if (amount <= room.state.wagerAmount) {
                      // Lower counter = auto-accept
                      room.state.wagerAmount = amount;
                      room.state.wagerPhase = false;
                      broadcastToRoom(room, { type: 'wager_finalized', amount });
                      startMatch(room);
                    } else {
                      // Higher counter = send back to proposer
                      room.state.wagerAmount = amount;
                      const otherSlot = playerSlot === 'player1' ? 'player2' : 'player1';
                      room.state.wagerAwaitingSlot = otherSlot;
                      sendToSlot(room, otherSlot, { type: 'wager_counter_received', amount });
                      room.state.wagerTimeout = setTimeout(() => {
                        room.state.wagerPhase = false;
                        room.state.wagerAmount = 0;
                        broadcastToRoom(room, { type: 'wager_finalized', amount: 0 });
                        startMatch(room);
                      }, 15_000);
                    }
                  }
                  else if (msg.type === 'wager_skip') {
                    clearTimeout(room.state.wagerTimeout);
                    room.state.wagerPhase = false;
                    room.state.wagerAmount = 0;
                    broadcastToRoom(room, { type: 'wager_finalized', amount: 0 });
                    startMatch(room);
                  }
                  return; // Don't process other message types during wager phase
                }

                // --- Active Item Use ---
                if (msg.type === 'item_use' && room.state.status === 'active') {
                  const currentPlayer = room.players.get(playerId);
                  if (!currentPlayer) return;

                  // Must be their turn
                  if (currentPlayer.slot !== room.state.currentTurn) return;

                  // Must have an unused active_use item
                  if (!currentPlayer.selectedItem || currentPlayer.itemUsed) return;
                  if (currentPlayer.selectedItem.timing !== 'active_use') return;

                  const item = currentPlayer.selectedItem;
                  const opponentSlot = currentPlayer.slot === "player1" ? "player2" : "player1";
                  const opponent = Array.from(room.players.values()).find((p) => p.slot === opponentSlot)!;

                  switch (item.effect) {
                    case 'heal_30pct': {
                      const healAmount = Math.round(currentPlayer.fighter.stats.hp * 0.30);
                      currentPlayer.currentHp = Math.min(currentPlayer.fighter.stats.hp, currentPlayer.currentHp + healAmount);
                      currentPlayer.itemUsed = true;
                      const players = Array.from(room.players.values());
                      const p1 = players.find((p) => p.slot === "player1")!;
                      const p2 = players.find((p) => p.slot === "player2")!;
                      broadcastToRoom(room, {
                        type: 'item_activated',
                        playerId: currentPlayer.id,
                        itemName: item.name,
                        description: `Restored ${healAmount} HP`,
                        player1Hp: p1.currentHp,
                        player2Hp: p2.currentHp,
                      });
                      break;
                    }
                    case 'nullify_type': {
                      room.state.pendingItem = { nullifyType: true };
                      currentPlayer.itemUsed = true;
                      broadcastToRoom(room, {
                        type: 'item_activated',
                        playerId: currentPlayer.id,
                        itemName: item.name,
                        description: item.description,
                      });
                      break;
                    }
                    case 'double_damage': {
                      room.state.pendingItem = { doubleDamage: true };
                      currentPlayer.itemUsed = true;
                      broadcastToRoom(room, {
                        type: 'item_activated',
                        playerId: currentPlayer.id,
                        itemName: item.name,
                        description: item.description,
                      });
                      break;
                    }
                    case 'steal_move': {
                      // Store pending flag; actual move swap happens during answer processing
                      room.state.pendingItem = { ...(room.state.pendingItem || {}), stealMove: true };
                      currentPlayer.itemUsed = true;
                      broadcastToRoom(room, {
                        type: 'item_activated',
                        playerId: currentPlayer.id,
                        itemName: item.name,
                        description: item.description,
                      });
                      break;
                    }
                    case 'invert_answer': {
                      // Scope Creep: set target to opponent's slot
                      room.state.scopeCreepTarget = opponentSlot;
                      currentPlayer.itemUsed = true;
                      broadcastToRoom(room, {
                        type: 'item_activated',
                        playerId: currentPlayer.id,
                        itemName: item.name,
                        description: item.description,
                      });
                      break;
                    }
                  }
                  return;
                }

                // --- Answer / Attack Phase ---
                if (msg.type !== "answer" || room.state.status !== "active") return;

                const currentPlayer = room.players.get(playerId);
                if (!currentPlayer) return;

                const isP1 = currentPlayer.slot === "player1";
                const isMyTurn =
                  (isP1 && room.state.currentTurn === "player1") ||
                  (!isP1 && room.state.currentTurn === "player2");
                if (!isMyTurn) return;

                // Immediately switch turn to block duplicate answer messages
                room.state.currentTurn = room.state.currentTurn === "player1" ? "player2" : "player1";

                const attacker = currentPlayer;
                const defenderArr = Array.from(room.players.values()).find((p) => p.id !== playerId)!;
                let correct = msg.answer === room.state.currentTrivia?.answer;

                // Scope Creep: if this attacker's slot is the scope creep target, invert correct answer
                if (room.state.scopeCreepTarget === attacker.slot && correct) {
                  correct = false;
                  room.state.scopeCreepTarget = null;
                  broadcastToRoom(room, {
                    type: 'item_activated',
                    playerId: defenderArr.id,
                    itemName: 'Scope Creep',
                    description: 'Correct answer was inverted!',
                  });
                }

                // Determine which move to use
                const moveIdx = Math.min(msg.moveIndex || 0, attacker.fighter.moves.length - 1);
                let move = attacker.fighter.moves[moveIdx];

                // Check for pending item effects
                let nullifyType = false;
                let doubleDamage = false;

                if (room.state.pendingItem) {
                  if (room.state.pendingItem.nullifyType) nullifyType = true;
                  if (room.state.pendingItem.doubleDamage) doubleDamage = true;
                  if (room.state.pendingItem.stealMove) {
                    // Use opponent's highest-power move
                    const highestMove = [...defenderArr.fighter.moves].sort((a: Move, b: Move) => b.power - a.power)[0];
                    if (highestMove) {
                      move = highestMove;
                    }
                  }
                  room.state.pendingItem = null;
                }

                const damage = calculateDamage(move, correct, attacker, defenderArr, { nullifyType, doubleDamage });
                defenderArr.currentHp = Math.max(0, defenderArr.currentHp - damage);

                // Self-damage on wrong answer
                let selfDamage = 0;
                if (!correct) {
                  // Pivot Potion: block self-damage
                  if (attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'block_self_damage') {
                    selfDamage = 0;
                    attacker.itemUsed = true;
                    broadcastToRoom(room, {
                      type: 'item_activated',
                      playerId: attacker.id,
                      itemName: attacker.selectedItem.name,
                      description: 'Self-damage blocked!',
                    });
                  } else {
                    selfDamage = Math.round(move.power * 0.5); // Wrong answer = significant recoil
                    attacker.currentHp = Math.max(0, attacker.currentHp - selfDamage);
                  }
                }

                const p1 = Array.from(room.players.values()).find((p) => p.slot === "player1")!;
                const p2 = Array.from(room.players.values()).find((p) => p.slot === "player2")!;

                broadcastToRoom(room, {
                  type: "turn_result",
                  attacker: attacker.id,
                  defender: defenderArr.id,
                  move: move.name,
                  correct,
                  damage,
                  selfDamage,
                  player1Hp: p1.currentHp,
                  player2Hp: p2.currentHp,
                  turnNumber: room.state.turnNumber,
                });

                // Check for KO with Bridge Round revival
                let defenderKO = defenderArr.currentHp <= 0;
                let attackerKO = attacker.currentHp <= 0;

                // Bridge Round: revive with 20% HP
                if (defenderKO && defenderArr.selectedItem && !defenderArr.itemUsed && defenderArr.selectedItem.effect === 'revive_20pct') {
                  const reviveHp = Math.round(defenderArr.fighter.stats.hp * 0.20);
                  defenderArr.currentHp = reviveHp;
                  defenderArr.itemUsed = true;
                  defenderKO = false;
                  broadcastToRoom(room, {
                    type: 'item_activated',
                    playerId: defenderArr.id,
                    itemName: defenderArr.selectedItem.name,
                    description: `Revived with ${reviveHp} HP!`,
                    player1Hp: p1.currentHp,
                    player2Hp: p2.currentHp,
                  });
                }

                if (attackerKO && attacker.selectedItem && !attacker.itemUsed && attacker.selectedItem.effect === 'revive_20pct') {
                  const reviveHp = Math.round(attacker.fighter.stats.hp * 0.20);
                  attacker.currentHp = reviveHp;
                  attacker.itemUsed = true;
                  attackerKO = false;
                  broadcastToRoom(room, {
                    type: 'item_activated',
                    playerId: attacker.id,
                    itemName: attacker.selectedItem.name,
                    description: `Revived with ${reviveHp} HP!`,
                    player1Hp: p1.currentHp,
                    player2Hp: p2.currentHp,
                  });
                }

                // Final KO check
                if (defenderKO || attackerKO) {
                  const winnerId = defenderKO ? attacker.id : defenderArr.id;
                  room.state.status = "finished";
                  // Local dev server has no D1 access, so stats are not recorded.
                  // coinsAwarded/coinsTaken are sent as 0 to match the production message shape.
                  broadcastToRoom(room, {
                    type: "match_end",
                    winner: winnerId,
                    reason: defenderKO ? "ko" : "self_ko",
                    coinsAwarded: 0,
                    coinsTaken: 0,
                    wagerAmount: room.state.wagerAmount || 0,
                  });
                  // Cleanup after a delay
                  setTimeout(() => matchRooms.delete(matchId), 10000);
                  return;
                }

                // Next turn — currentTurn was already switched above to block duplicates
                room.state.turnNumber++;

                const nextPlayer = room.state.currentTurn === "player1" ? p1 : p2;
                const nextOpponent = room.state.currentTurn === "player1" ? p2 : p1;
                // Trivia comes from the opponent's fighter
                const trivia = getRandomTrivia(nextOpponent.fighter, room.state.usedTriviaIndices);
                room.state.currentTrivia = trivia;

                // Check if next attacker has an active_use item available
                const hasActiveItem = nextPlayer.selectedItem
                  && !nextPlayer.itemUsed
                  && nextPlayer.selectedItem.timing === 'active_use';

                const triviaMsg: Record<string, unknown> = {
                  type: "trivia",
                  question: trivia.question,
                  options: trivia.options,
                  canUseItem: hasActiveItem,
                };

                // Hook Model: eliminate one wrong answer for the attacker
                if (nextPlayer.selectedItem && !nextPlayer.itemUsed && nextPlayer.selectedItem.effect === 'eliminate_wrong_answer') {
                  const wrongIndices = trivia.options
                    .map((opt: string, i: number) => opt !== trivia.answer ? i : -1)
                    .filter((i: number) => i >= 0);
                  if (wrongIndices.length > 0) {
                    triviaMsg.eliminatedOption = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
                    nextPlayer.itemUsed = true;
                    broadcastToRoom(room, {
                      type: 'item_activated',
                      playerId: nextPlayer.id,
                      itemName: nextPlayer.selectedItem.name,
                      description: nextPlayer.selectedItem.description,
                    });
                  }
                }

                // The Memo (passive): reveal opponent's moves
                if (nextPlayer.selectedItem && !nextPlayer.itemUsed && nextPlayer.selectedItem.effect === 'reveal_move') {
                  const opponentMoves = nextOpponent.fighter.moves;
                  triviaMsg.revealedMoves = opponentMoves.map((m: Move) => ({ name: m.name, power: m.power, type: m.type }));
                }

                broadcastToRoom(room, {
                  type: "turn_change",
                  currentTurn: room.state.currentTurn,
                  turnNumber: room.state.turnNumber,
                });

                sendTo(nextPlayer.ws, triviaMsg);
              } catch (err) {
                console.error("[match-room] message error:", err);
              }
            });

            ws.on("close", () => {
              const timerKey = `${matchId}:${playerId}`;
              console.log(`[match-room] Player ${username} WebSocket closed. Starting 3s grace period for reconnect.`);

              // Grace period: wait before removing player (handles React strict mode remounts)
              const timer = setTimeout(() => {
                disconnectTimers.delete(timerKey);
                const currentPlayer = room.players.get(playerId);
                // Only remove if the ws reference matches (hasn't been replaced by a reconnect)
                if (currentPlayer && currentPlayer.ws === ws) {
                  room.players.delete(playerId);
                  console.log(`[match-room] Player ${username} removed after grace period. Room ${matchId} has ${room.players.size} player(s)`);
                  if (room.state.status === "active") {
                    const remaining = Array.from(room.players.values())[0];
                    if (remaining) {
                      room.state.status = "finished";
                      // Local dev server has no D1 access — stats not recorded in dev
                      broadcastToRoom(room, {
                        type: "match_end",
                        winner: remaining.id,
                        reason: "disconnect",
                        coinsAwarded: 0,
                        coinsTaken: 0,
                        wagerAmount: room.state.wagerAmount || 0,
                      });
                    }
                  }
                  if (room.players.size === 0) {
                    matchRooms.delete(matchId);
                  }
                } else {
                  console.log(`[match-room] Player ${username} already reconnected, skipping removal.`);
                }
              }, 3000);
              disconnectTimers.set(timerKey, timer);
            });
          });
          return;
        }
      });

      // Periodic matchmaking
      setInterval(tryMatch, 3000);
    },
  };
}

export default defineConfig({
  plugins: [
    catchRejections(),
    localMultiplayerWs(),
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
