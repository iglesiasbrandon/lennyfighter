'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FIGHTERS } from '../game/fighters';
import type { Fighter, GameItem, InventoryEntry } from '../../lib/types';
import { FighterSelect } from './FighterSelect';
import { BattleView } from './BattleView';
import { MultiplayerBattle } from './MultiplayerBattle';
import { ItemShop } from './ItemShop';
import { ErrorBoundary } from './ErrorBoundary';
import { useMatchmaking, useMatchRoom, getActiveMatch, clearActiveMatch, getLocalGamertag, getBotMatch, clearBotMatch, saveBotMatch } from '../hooks/useMultiplayer';
import type { MatchInfo } from '../hooks/useMultiplayer';
import { getFighterById } from '../game/fighters';
import { getInventory, getUsername } from '../lib/api';

interface BotMatchData {
  matchId: string;
  player1: { id: string; fighter: Fighter; username?: string };
  player2: { id: string; fighter: Fighter; username?: string };
}

type LobbyState = 'select' | 'mode' | 'queuing' | 'battle-mp' | 'battle-bot' | 'result';

export function LobbyClient() {
  // Check for an active match to rejoin after page refresh
  const [restoredMatch] = useState<{ matchInfo: MatchInfo; fighter: Fighter } | null>(() => {
    if (typeof window === 'undefined') return null;
    const active = getActiveMatch();
    if (!active) return null;
    const fighter = getFighterById(active.fighterId);
    if (!fighter) { clearActiveMatch(); return null; }
    return { matchInfo: { matchId: active.matchId, slot: active.slot, opponent: active.opponent }, fighter };
  });

  // Check for a saved bot match to restore after page refresh
  const [restoredBotMatch] = useState<{ matchData: BotMatchData; gameState: Record<string, unknown> } | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = getBotMatch();
    if (!saved) return null;
    // Verify the fighter data is still valid
    const p1Fighter = getFighterById(saved.matchData.player1.fighter.id);
    const p2Fighter = getFighterById(saved.matchData.player2.fighter.id);
    if (!p1Fighter || !p2Fighter) { clearBotMatch(); return null; }
    // Restore with canonical fighter data
    saved.matchData.player1.fighter = p1Fighter;
    saved.matchData.player2.fighter = p2Fighter;
    return saved;
  });

  const initialState: LobbyState = restoredMatch ? 'battle-mp' : restoredBotMatch ? 'battle-bot' : 'select';
  const [state, setState] = useState<LobbyState>(initialState);
  const [selectedFighter, setSelectedFighter] = useState<Fighter | null>(restoredMatch?.fighter || restoredBotMatch?.matchData.player1.fighter || null);
  const [botMatchData, setBotMatchData] = useState<BotMatchData | null>(restoredBotMatch?.matchData || null);
  const [result, setResult] = useState<{ winner: string; reason: string } | null>(null);
  const [showItemShop, setShowItemShop] = useState(false);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [itemsAllowed, setItemsAllowed] = useState(true);
  const [registered, setRegistered] = useState(true);
  const [gamertag, setGamertag] = useState<string | null>(null);
  const [coinResult, setCoinResult] = useState<{ awarded: number; taken: number } | null>(null);

  // Check registration on mount + auto-open shop from nav
  useEffect(() => {
    const localTag = getLocalGamertag() || getUsername();
    if (localTag) {
      setRegistered(true);
      setGamertag(localTag);
    } else {
      window.location.href = '/';
    }
    // Auto-open item shop if ?shop=1 in URL
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('shop') === '1') {
      setShowItemShop(true);
      // Clean up URL
      window.history.replaceState({}, '', '/lobby');
    }
  }, []);

  // Fetch inventory on mount and after shop closes
  const fetchInventory = useCallback(async () => {
    try {
      const res = await getInventory();
      if (res.success && res.data) {
        setInventory(res.data as InventoryEntry[]);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Real matchmaking hooks — pass restored matchInfo to skip matchmaking on reconnect
  const { state: mmState, matchInfo, joinQueue, cancelQueue, reset: resetMatchmaking } = useMatchmaking(selectedFighter, restoredMatch?.matchInfo);
  const { battleState, connected, sendAnswer, selectItem, useItem, proposeWager, acceptWager, counterWager, skipWager } = useMatchRoom(matchInfo, selectedFighter, itemsAllowed);

  // Ref to avoid stale closure in handleMatchEnd (Bug 18)
  const battleStateRef = useRef(battleState);
  battleStateRef.current = battleState;

  const handleFighterSelect = useCallback((fighter: Fighter) => {
    setSelectedFighter(fighter);
  }, []);

  const handleReadyUp = useCallback(() => {
    if (!selectedFighter) return;
    setState('mode');
  }, [selectedFighter]);

  const startMultiplayer = useCallback(() => {
    setState('queuing');
    joinQueue();
  }, [joinQueue]);

  const startBotMatch = useCallback(() => {
    if (!selectedFighter) return;
    const opponentIndex = Math.floor(Math.random() * FIGHTERS.length);
    let opponent = FIGHTERS[opponentIndex];
    if (opponent.id === selectedFighter.id) {
      opponent = FIGHTERS[(opponentIndex + 1) % FIGHTERS.length];
    }
    setBotMatchData({
      matchId: `match_${Date.now()}`,
      player1: { id: 'player_self', fighter: selectedFighter },
      player2: { id: 'bot_opponent', fighter: opponent },
    });
    setState('battle-bot');
  }, [selectedFighter]);

  const handleMatchEnd = useCallback((winnerId: string, reason: string) => {
    setResult({ winner: winnerId, reason });
    setState('result');
    clearBotMatch(); // Clear saved bot match state

    // Stats are now recorded server-side in the MatchRoom Durable Object.
    // Read coin results from battleState (sent via the match_end WS message).
    const bs = battleStateRef.current;
    setCoinResult({
      awarded: bs.coinsAwarded ?? 0,
      taken: bs.coinsTaken ?? 0,
    });
  }, []);

  const handlePlayAgain = useCallback(() => {
    resetMatchmaking();
    clearBotMatch();
    setSelectedFighter(null);
    setBotMatchData(null);
    setResult(null);
    setCoinResult(null);
    setState('select');
    fetchInventory();
  }, [resetMatchmaking, fetchInventory]);

  // Auto-transition from queuing to battle when matched
  useEffect(() => {
    if (state === 'queuing' && mmState === 'matched' && matchInfo) {
      setState('battle-mp');
    }
  }, [state, mmState, matchInfo]);

  // If battle-mp but match failed to reconnect (stale match cleared), go back to select
  useEffect(() => {
    if (state === 'battle-mp' && battleState.status === 'finished' && battleState.winReason === 'disconnect') {
      resetMatchmaking();
      setSelectedFighter(null);
      setState('select');
    }
  }, [state, battleState.status, battleState.winReason, resetMatchmaking]);

  if (!registered) {
    return null;
  }

  return (
    <div className="page-container">
      {state === 'select' && (
        <>
          <div className="page-header">
            <h1>Choose Your Fighter</h1>
            <p>Select a fighter to enter the arena. Each type has strengths and weaknesses.</p>
          </div>
          <FighterSelect
            fighters={FIGHTERS}
            selected={selectedFighter}
            onSelect={handleFighterSelect}
          />
          {selectedFighter && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button className="btn btn-primary" onClick={handleReadyUp} style={{ fontSize: '24px', padding: '14px 40px' }}>
                Ready Up with {selectedFighter.name}
              </button>
            </div>
          )}
        </>
      )}

      {showItemShop && (
        <ItemShop onClose={() => { setShowItemShop(false); fetchInventory(); }} />
      )}

      {state === 'mode' && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2 style={{ fontSize: '14px', color: '#3a2a0a', marginBottom: '24px' }}>Choose Battle Mode</h2>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={startMultiplayer} style={{ padding: '20px 32px', fontSize: '24px' }}>
              Multiplayer<br />
              <span style={{ fontSize: '18px', opacity: 0.8 }}>Real opponent (2 tabs)</span>
            </button>
            <button className="btn btn-outline" onClick={startBotMatch} style={{ padding: '20px 32px', fontSize: '24px' }}>
              vs Bot<br />
              <span style={{ fontSize: '18px', opacity: 0.8 }}>Practice mode</span>
            </button>
          </div>
          <button className="btn btn-outline" onClick={() => setState('select')} style={{ marginTop: '20px', fontSize: '20px' }}>
            Back
          </button>
        </div>
      )}

      {state === 'queuing' && (
        <div className="queuing-screen">
          <h2>Finding Opponent...</h2>
          <p>Open another tab and select a fighter to match!</p>
          <p style={{ fontSize: '18px', color: '#888', marginTop: '8px' }}>
            {mmState === 'queuing' ? 'Waiting in matchmaking queue...' :
             mmState === 'error' ? 'Connection error — try again' :
             'Connecting...'}
          </p>
          <div className="queuing-bar"><div className="queuing-bar-fill" /></div>
          <button className="btn btn-outline" onClick={() => { cancelQueue(); setSelectedFighter(null); setState('select'); }} style={{ marginTop: '20px' }}>
            Back to Fighter Select
          </button>
        </div>
      )}

      {state === 'battle-mp' && (
        <ErrorBoundary>
          <MultiplayerBattle
            battleState={battleState}
            connected={connected}
            sendAnswer={sendAnswer}
            onMatchEnd={handleMatchEnd}
            selectItem={selectItem}
            useItem={useItem}
            inventory={inventory}
            proposeWager={proposeWager}
            acceptWager={acceptWager}
            counterWager={counterWager}
            skipWager={skipWager}
          />
        </ErrorBoundary>
      )}

      {state === 'battle-bot' && botMatchData && (
        <ErrorBoundary>
          <BattleView
            matchData={botMatchData}
            onMatchEnd={handleMatchEnd}
            inventory={inventory}
            restoredGameState={restoredBotMatch?.gameState || null}
            onStateChange={(gs) => saveBotMatch(botMatchData, gs)}
          />
        </ErrorBoundary>
      )}

      {state === 'result' && result && (
        <div className={`match-result ${
          // Check if current player won
          (result.winner === 'player_self') ||
          (battleState.mySlot === 'player1' && result.winner === battleState.player1?.id) ||
          (battleState.mySlot === 'player2' && result.winner === battleState.player2?.id)
            ? 'win' : 'loss'
        }`}>
          <h2>{
            (result.winner === 'player_self') ||
            (battleState.mySlot === 'player1' && result.winner === battleState.player1?.id) ||
            (battleState.mySlot === 'player2' && result.winner === battleState.player2?.id)
              ? 'VICTORY!' : 'DEFEAT'
          }</h2>
          <p style={{ marginBottom: '8px' }}>
            {result.reason === 'ko' ? 'Knockout!' : result.reason === 'self_ko' ? 'Self KO...' : 'Opponent disconnected'}
          </p>
          {battleState.wagerAmount > 0 && (
            <p style={{ color: '#c8a832', fontSize: '18px', margin: '8px 0' }}>
              Wager: {battleState.wagerAmount} LC
            </p>
          )}
          {coinResult && (() => {
            const iWon = (result.winner === 'player_self') ||
              (battleState.mySlot === 'player1' && result.winner === battleState.player1?.id) ||
              (battleState.mySlot === 'player2' && result.winner === battleState.player2?.id);
            return iWon ? (
              <p style={{ color: 'var(--accent-green)', fontSize: '20px', fontWeight: 700, margin: '12px 0' }}>
                +{coinResult.awarded} LennyCoin
              </p>
            ) : (
              <p style={{ color: coinResult.taken > 0 ? 'var(--accent-red)' : undefined, fontSize: '20px', fontWeight: 700, margin: '12px 0' }}>
                {coinResult.taken > 0 ? `-${coinResult.taken} LennyCoin` : '0 LennyCoin lost'}
              </p>
            );
          })()}
          <button className="btn btn-primary" onClick={handlePlayAgain}>Play Again</button>
        </div>
      )}
    </div>
  );
}
