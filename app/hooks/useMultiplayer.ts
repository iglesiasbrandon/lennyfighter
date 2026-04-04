'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { Fighter } from '../../lib/types';
import { getGamertag, getSessionToken, clearSessionToken } from '../lib/api';

const GAMERTAG_KEY = 'lennyfighter_gamertag';

export function getLocalGamertag(): string | null {
  return getGamertag();
}

export function setLocalGamertag(tag: string): void {
  localStorage.setItem(GAMERTAG_KEY, tag);
  // Clean up legacy keys
  localStorage.removeItem('lf_gamertag');
  localStorage.removeItem('username');
  clearSessionToken();
}

// Get a stable player ID for multiplayer connections.
// Uses gamertag as the primary identifier, falls back to a session-stable random ID.
function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  const tag = getGamertag();
  if (tag) return tag;
  let fallback = sessionStorage.getItem('lf_fallback_player_id');
  if (!fallback) {
    fallback = `player_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
    sessionStorage.setItem('lf_fallback_player_id', fallback);
  }
  return fallback;
}

function getUsername(): string {
  if (typeof window === 'undefined') return '';
  const tag = getLocalGamertag();
  if (tag) return tag;
  // Session-stable fallback username
  let fallback = sessionStorage.getItem('lf_fallback_username');
  if (!fallback) {
    const adjectives = ['Swift', 'Bold', 'Dark', 'Bright', 'Fierce', 'Calm', 'Wild', 'Sharp'];
    const nouns = ['Tiger', 'Eagle', 'Wolf', 'Fox', 'Bear', 'Hawk', 'Lion', 'Raven'];
    fallback = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}`;
    sessionStorage.setItem('lf_fallback_username', fallback);
  }
  return fallback;
}

// Persist/restore active match info across page refreshes
function saveActiveMatch(matchInfo: MatchInfo, fighterId: string) {
  sessionStorage.setItem('lf_active_match', JSON.stringify({ ...matchInfo, fighterId, savedAt: Date.now() }));
}
function getActiveMatch(): (MatchInfo & { fighterId: string }) | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('lf_active_match');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard matches older than 2 minutes — they're stale
    if (data.savedAt && Date.now() - data.savedAt > 2 * 60 * 1000) {
      sessionStorage.removeItem('lf_active_match');
      return null;
    }
    return data;
  } catch { return null; }
}
function clearActiveMatch() {
  sessionStorage.removeItem('lf_active_match');
}

// Persist/restore bot match state across page refreshes
const BOT_MATCH_KEY = 'lf_bot_match';
interface BotMatchPlayer { id: string; fighter: Fighter; username?: string }
interface BotMatchData { matchId: string; player1: BotMatchPlayer; player2: BotMatchPlayer }

function saveBotMatch(matchData: BotMatchData, gameState: Record<string, unknown>) {
  sessionStorage.setItem(BOT_MATCH_KEY, JSON.stringify({ matchData, gameState, savedAt: Date.now() }));
}
function getBotMatch(): { matchData: BotMatchData; gameState: Record<string, unknown> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(BOT_MATCH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard bot matches older than 5 minutes
    if (data.savedAt && Date.now() - data.savedAt > 5 * 60 * 1000) {
      sessionStorage.removeItem(BOT_MATCH_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}
function clearBotMatch() {
  sessionStorage.removeItem(BOT_MATCH_KEY);
}

export { getActiveMatch, clearActiveMatch, saveBotMatch, getBotMatch, clearBotMatch };

export type MatchmakingState = 'idle' | 'queuing' | 'matched' | 'connecting' | 'ready' | 'error';

export interface MatchInfo {
  matchId: string;
  slot: 'player1' | 'player2';
  opponent: { id: string; username: string; level: number };
}

export interface MultiplayerBattleState {
  mySlot: 'player1' | 'player2';
  player1: { id: string; username: string; fighter: Fighter; hp: number; itemName?: string | null } | null;
  player2: { id: string; username: string; fighter: Fighter; hp: number; itemName?: string | null } | null;
  currentTurn: 'player1' | 'player2';
  turnNumber: number;
  trivia: { question: string; options: string[]; eliminatedOption?: number; canUseItem?: boolean; revealedMoves?: Array<{ name: string; power: number; type: string }> } | null;
  status: 'waiting' | 'active' | 'finished';
  lastTurnResult: TurnResult | null;
  winner: string | null;
  winReason: string | null;
  coinsAwarded: number;
  coinsTaken: number;
  itemSelectionPhase: boolean;
  canUseItem: boolean;
  itemActivated: { name: string; description: string; playerId: string } | null;
  wagerPhase: boolean;
  wagerAmount: number;
  wagerMaxAmount: number;
  wagerProposerSlot: 'player1' | 'player2' | null;
  wagerAwaitingResponse: boolean;
  wagerProposedAmount: number | null;
  player1Balance: number;
  player2Balance: number;
}

interface TurnResult {
  attacker: string;
  defender: string;
  move: string;
  correct: boolean;
  damage: number;
  selfDamage: number;
  player1Hp: number;
  player2Hp: number;
  correctAnswer?: string;
}

export function useMatchmaking(fighter: Fighter | null, initialMatchInfo?: MatchInfo | null) {
  const [state, setState] = useState<MatchmakingState>(initialMatchInfo ? 'matched' : 'idle');
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(initialMatchInfo || null);
  const wsRef = useRef<WebSocket | null>(null);

  const joinQueue = useCallback(async () => {
    if (!fighter) return;
    setState('queuing');

    let token: string;
    try {
      token = await getSessionToken();
    } catch {
      setState('error');
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev, use port 3001 (Node WS server); in prod, use same host (Durable Objects)
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsHost = isDev ? window.location.hostname + ':3001' : window.location.host;
    const devParam = isDev ? `&gamertag=${encodeURIComponent(getGamertag() || '')}` : '';
    const url = `${proto}//${wsHost}/ws/matchmaking?token=${token}&fighterId=${fighter.id}&level=1${devParam}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onerror = () => {
      setState('error');
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'queued') {
        setState('queuing');
      } else if (msg.type === 'match_found') {
        const info: MatchInfo = {
          matchId: msg.matchId,
          slot: msg.slot,
          opponent: msg.opponent,
        };
        setMatchInfo(info);
        if (fighter) saveActiveMatch(info, fighter.id);
        setState('matched');
        ws.close();
      }
    };
    ws.onclose = () => {
      // Only set error if we haven't matched
      setState(prev => prev === 'queuing' ? 'error' : prev);
    };
  }, [fighter]);

  const cancelQueue = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'cancel' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setState('idle');
    setMatchInfo(null);
  }, []);

  const reset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState('idle');
    setMatchInfo(null);
    clearActiveMatch();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { state, matchInfo, joinQueue, cancelQueue, reset };
}

export function useMatchRoom(matchInfo: MatchInfo | null, fighter: Fighter | null, itemsAllowed?: boolean) {
  const [battleState, setBattleState] = useState<MultiplayerBattleState>({
    mySlot: 'player1',
    player1: null,
    player2: null,
    currentTurn: 'player1',
    turnNumber: 0,
    trivia: null,
    status: 'waiting',
    lastTurnResult: null,
    winner: null,
    winReason: null,
    coinsAwarded: 0,
    coinsTaken: 0,
    itemSelectionPhase: false,
    canUseItem: false,
    itemActivated: null,
    wagerPhase: false, wagerAmount: 0, wagerMaxAmount: 0, wagerProposerSlot: null,
    wagerAwaitingResponse: false, wagerProposedAmount: null, player1Balance: 0, player2Balance: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const cleanedUpRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchFinishedRef = useRef(false);
  const answerSentRef = useRef(false);
  const retryCountRef = useRef(0);

  // Initialize match and connect.
  //
  // Dependency note: `matchInfo` and `fighter` are both stable references —
  // `matchInfo` comes from useState in useMatchmaking and is set exactly once
  // per match cycle, and `fighter` is the user's selection which doesn't change
  // during a match. The onmessage handler closes over `setBattleState` using
  // functional updaters (prev => ...), so it always reads the latest state
  // without needing battleState in the dependency array. If either dependency's
  // reference *did* change unexpectedly, the cleanup function would close the
  // old WebSocket before opening a new one, so no leaked connections would occur.
  useEffect(() => {
    if (!matchInfo || !fighter) return;

    cleanedUpRef.current = false;
    matchFinishedRef.current = false;
    answerSentRef.current = false;

    // Reset battle state for the new match — prevents showing stale results from previous match
    setBattleState({
      mySlot: 'player1',
      player1: null,
      player2: null,
      currentTurn: 'player1',
      turnNumber: 0,
      trivia: null,
      status: 'waiting',
      lastTurnResult: null,
      winner: null,
      winReason: null,
      coinsAwarded: 0,
      coinsTaken: 0,
      itemSelectionPhase: false,
      canUseItem: false,
      itemActivated: null,
      wagerPhase: false, wagerAmount: 0, wagerMaxAmount: 0, wagerProposerSlot: null,
      wagerAwaitingResponse: false, wagerProposedAmount: null, player1Balance: 0, player2Balance: 0,
    });
    setConnected(false);

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const wsHost = isDev ? window.location.hostname + ':3001' : window.location.host;
    const itemsParam = itemsAllowed ? '&itemsAllowed=true' : '';

    async function connectWs() {
      if (cleanedUpRef.current || !matchInfo || !fighter) return;

      let token: string;
      try {
        token = await getSessionToken();
      } catch {
        clearActiveMatch();
        matchFinishedRef.current = true;
        setBattleState(prev => ({ ...prev, status: 'finished', winReason: 'auth_failed' }));
        return;
      }

      // Close any existing connection
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      const devParam = isDev ? `&gamertag=${encodeURIComponent(getGamertag() || '')}` : '';
      const url = `${proto}//${wsHost}/ws/match/${matchInfo.matchId}?token=${token}&fighterId=${fighter.id}${itemsParam}${devParam}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onerror = () => {};

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        switch (msg.type) {
          case 'joined':
            retryCountRef.current = 0; // Reset retry counter on successful join
            setBattleState(prev => ({ ...prev, mySlot: msg.slot }));
            break;

          case 'item_selection_start':
            setBattleState(prev => ({ ...prev, itemSelectionPhase: true }));
            break;

          case 'item_selection_complete':
            setBattleState(prev => ({ ...prev, itemSelectionPhase: false }));
            break;

          case 'item_activated':
            setBattleState(prev => ({
              ...prev,
              itemActivated: { name: msg.itemName, description: msg.description, playerId: msg.playerId },
              // Update HP if provided (e.g. heal or revive)
              player1: msg.player1Hp != null && prev.player1 ? { ...prev.player1, hp: msg.player1Hp } : prev.player1,
              player2: msg.player2Hp != null && prev.player2 ? { ...prev.player2, hp: msg.player2Hp } : prev.player2,
            }));
            // Auto-clear after 2.5 seconds
            setTimeout(() => {
              setBattleState(prev => ({ ...prev, itemActivated: null }));
            }, 2500);
            break;

          case 'match_start':
            // Use the slot from the server's 'joined' message (prev.mySlot), NOT matchInfo.slot
            // The match room assigns slots by connection order, which may differ from matchmaking
            setBattleState(prev => ({
              ...prev,
              player1: { id: msg.player1.id, username: msg.player1.username, fighter: msg.player1.fighter, hp: msg.player1.hp, itemName: msg.player1.itemName },
              player2: { id: msg.player2.id, username: msg.player2.username, fighter: msg.player2.fighter, hp: msg.player2.hp, itemName: msg.player2.itemName },
              currentTurn: msg.currentTurn,
              turnNumber: msg.turnNumber || 1,
              status: 'active',
              itemSelectionPhase: false,
            }));
            break;

          case 'trivia':
            setBattleState(prev => ({
              ...prev,
              trivia: {
                question: msg.question,
                options: msg.options,
                eliminatedOption: msg.eliminatedOption,
                canUseItem: msg.canUseItem,
                revealedMoves: msg.revealedMoves,
              },
              canUseItem: !!msg.canUseItem,
            }));
            break;

          case 'turn_result':
            setBattleState(prev => ({
              ...prev,
              player1: prev.player1 ? { ...prev.player1, hp: msg.player1Hp } : null,
              player2: prev.player2 ? { ...prev.player2, hp: msg.player2Hp } : null,
              trivia: null,
              canUseItem: false,
              lastTurnResult: {
                attacker: msg.attacker,
                defender: msg.defender,
                move: msg.move,
                correct: msg.correct,
                damage: msg.damage,
                selfDamage: msg.selfDamage,
                player1Hp: msg.player1Hp,
                player2Hp: msg.player2Hp,
                correctAnswer: msg.correctAnswer,
              },
            }));
            break;

          case 'turn_change':
            answerSentRef.current = false;
            setBattleState(prev => ({
              ...prev,
              currentTurn: msg.currentTurn,
              turnNumber: msg.turnNumber,
            }));
            break;

          case 'match_end':
            matchFinishedRef.current = true;
            clearActiveMatch();
            setBattleState(prev => ({
              ...prev,
              status: 'finished',
              winner: msg.winner,
              winReason: msg.reason,
              coinsAwarded: msg.coinsAwarded ?? 0,
              coinsTaken: msg.coinsTaken ?? 0,
              trivia: null,
              canUseItem: false,
            }));
            break;

          case 'wager_phase_start':
            setBattleState(prev => ({
              ...prev,
              wagerPhase: true,
              wagerMaxAmount: msg.maxWager,
              wagerProposerSlot: msg.proposerSlot,
              wagerAwaitingResponse: prev.mySlot === msg.proposerSlot,
              player1Balance: msg.player1Balance,
              player2Balance: msg.player2Balance,
            }));
            break;

          case 'wager_proposed':
            setBattleState(prev => ({
              ...prev,
              wagerProposedAmount: msg.amount,
              wagerAwaitingResponse: true,
            }));
            break;

          case 'wager_counter_received':
            setBattleState(prev => ({
              ...prev,
              wagerProposedAmount: msg.amount,
              wagerAwaitingResponse: true,
            }));
            break;

          case 'wager_finalized':
            setBattleState(prev => ({
              ...prev,
              wagerPhase: false,
              wagerAmount: msg.amount,
              wagerAwaitingResponse: false,
              wagerProposedAmount: null,
            }));
            break;
        }
      };

      ws.onclose = (e) => {
        setConnected(false);
        // Don't reconnect if match is finished, intentionally cleaned up, or match room rejected us
        if (cleanedUpRef.current || e.code === 4000 || e.code === 4003 || matchFinishedRef.current) {
          clearActiveMatch();
          return;
        }
        // Track retry attempts — give up after 10 failed reconnects (~12s with backoff)
        retryCountRef.current++;
        if (retryCountRef.current > 10) {
          clearActiveMatch();
          matchFinishedRef.current = true;
          setBattleState(prev => ({ ...prev, status: 'finished', winReason: 'disconnect' }));
          return;
        }
        // Exponential backoff: 500ms, 750ms, 1s, 1.5s, 2s... capped at 3s
        const delay = Math.min(500 * Math.pow(1.5, retryCountRef.current - 1), 3000);
        reconnectTimerRef.current = setTimeout(connectWs, delay);
      };
    }

    connectWs();

    return () => {
      cleanedUpRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [matchInfo, fighter, itemsAllowed]);

  const sendAnswer = useCallback((answer: string, moveIndex: number) => {
    if (answerSentRef.current) return; // Block duplicate answers in the same turn
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      answerSentRef.current = true;
      wsRef.current.send(JSON.stringify({ type: 'answer', answer, moveIndex }));
    }
  }, []);

  const selectItem = useCallback((itemId: string | null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'item_select', itemId }));
    }
  }, []);

  const useItem = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'item_use' }));
      setBattleState(prev => ({ ...prev, canUseItem: false }));
    }
  }, []);

  const proposeWager = useCallback((amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'wager_propose', amount }));
      setBattleState(prev => ({ ...prev, wagerAwaitingResponse: false, wagerProposedAmount: amount }));
    }
  }, []);

  const acceptWager = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'wager_accept' }));
      setBattleState(prev => ({ ...prev, wagerAwaitingResponse: false }));
    }
  }, []);

  const counterWager = useCallback((amount: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'wager_counter', amount }));
      setBattleState(prev => ({ ...prev, wagerAwaitingResponse: false, wagerProposedAmount: amount }));
    }
  }, []);

  const skipWager = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'wager_skip' }));
      setBattleState(prev => ({ ...prev, wagerAwaitingResponse: false }));
    }
  }, []);

  return { battleState, connected, sendAnswer, selectItem, useItem, proposeWager, acceptWager, counterWager, skipWager };
}
