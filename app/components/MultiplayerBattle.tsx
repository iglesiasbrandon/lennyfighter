'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { InventoryEntry } from '../../lib/types';
import type { MultiplayerBattleState } from '../hooks/useMultiplayer';
import { ItemSelector } from './ItemSelector';
import { WagerNegotiation } from './WagerNegotiation';
import { BattleArena } from './BattleArena';

interface MultiplayerBattleProps {
  battleState: MultiplayerBattleState;
  connected: boolean;
  sendAnswer: (answer: string, moveIndex: number) => void;
  onMatchEnd: (winnerId: string, reason: string) => void;
  selectItem: (itemId: string | null) => void;
  useItem: () => void;
  inventory: InventoryEntry[];
  proposeWager: (amount: number) => void;
  acceptWager: () => void;
  counterWager: (amount: number) => void;
  skipWager: () => void;
}

interface DamagePopup {
  id: number;
  x: string;
  y: string;
  value: number;
  correct: boolean;
}

export function MultiplayerBattle({ battleState, connected, sendAnswer, onMatchEnd, selectItem, useItem, inventory, proposeWager, acceptWager, counterWager, skipWager }: MultiplayerBattleProps) {
  const [selectedMove, setSelectedMove] = useState(0);
  const [p1Anim, setP1Anim] = useState('');
  const [p2Anim, setP2Anim] = useState('');
  const [damagePopups, setDamagePopups] = useState<DamagePopup[]>([]);
  const [showFight, setShowFight] = useState(false);
  const [showKO, setShowKO] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const popupId = useRef(0);
  const hasEnded = useRef(false);

  const { player1, player2, currentTurn, trivia, status, mySlot, lastTurnResult, winner, winReason, itemSelectionPhase, canUseItem, itemActivated } = battleState;
  const isMyTurn = currentTurn === mySlot;
  const myFighter = mySlot === 'player1' ? player1?.fighter : player2?.fighter;
  const opponentFighter = mySlot === 'player1' ? player2?.fighter : player1?.fighter;

  // Reset selected move to 0 at the start of each new turn
  useEffect(() => {
    if (isMyTurn && status === 'active') {
      setSelectedMove(0);
    }
  }, [currentTurn, isMyTurn, status]);

  // FIGHT! announcement when battle becomes active
  useEffect(() => {
    if (status === 'active') {
      setShowFight(true);
      const t = setTimeout(() => setShowFight(false), 2000);
      return () => clearTimeout(t);
    }
  }, [status]);

  // K.O.! announcement
  useEffect(() => {
    if (status === 'finished' && winReason === 'ko') {
      setShowKO(true);
      const t = setTimeout(() => setShowKO(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status, winReason]);

  // Screen shake + impact flash on damage
  useEffect(() => {
    if (lastTurnResult && lastTurnResult.damage > 0) {
      setShaking(true);
      setShowImpact(true);
      const t1 = setTimeout(() => setShaking(false), 300);
      const t2 = setTimeout(() => setShowImpact(false), 150);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [lastTurnResult]);

  // Animate turn results
  useEffect(() => {
    if (!lastTurnResult) return;
    const attackerIsP1 = lastTurnResult.attacker === player1?.id;

    if (attackerIsP1) {
      setP1Anim('attacking');
      setTimeout(() => { setP1Anim(''); setP2Anim('hit'); }, 400);
      setTimeout(() => setP2Anim(''), 700);
    } else {
      setP2Anim('attacking');
      setTimeout(() => { setP2Anim(''); setP1Anim('hit'); }, 400);
      setTimeout(() => setP1Anim(''), 700);
    }

    // Damage popup
    const id = ++popupId.current;
    const side = attackerIsP1 ? 'opponent' : 'player';
    const x = side === 'opponent' ? '75%' : '25%';
    const y = side === 'opponent' ? '30%' : '50%';
    setDamagePopups(prev => [...prev, { id, x, y, value: lastTurnResult.damage, correct: lastTurnResult.correct }]);
    setTimeout(() => setDamagePopups(prev => prev.filter(p => p.id !== id)), 1000);
  }, [lastTurnResult, player1?.id]);

  // Handle match end
  useEffect(() => {
    if (status === 'finished' && winner && !hasEnded.current) {
      hasEnded.current = true;
      setTimeout(() => onMatchEnd(winner, winReason || 'ko'), 2500);
    }
  }, [status, winner, winReason, onMatchEnd]);

  const handleAnswer = useCallback((answer: string) => {
    if (!isMyTurn || status !== 'active') return;
    sendAnswer(answer, selectedMove);
  }, [isMyTurn, status, sendAnswer, selectedMove]);

  // Wager negotiation phase
  if (battleState.wagerPhase) {
    return (
      <WagerNegotiation
        mySlot={battleState.mySlot}
        proposerSlot={battleState.wagerProposerSlot}
        player1Balance={battleState.player1Balance}
        player2Balance={battleState.player2Balance}
        maxWager={battleState.wagerMaxAmount}
        proposedAmount={battleState.wagerProposedAmount}
        awaitingResponse={battleState.wagerAwaitingResponse}
        onPropose={proposeWager}
        onAccept={acceptWager}
        onCounter={counterWager}
        onSkip={skipWager}
      />
    );
  }

  // Item selection phase overlay
  if (itemSelectionPhase) {
    return (
      <div className="game-wrapper">
        <div className="game-title">
          <h1>LennyFighter</h1>
          <div className="subtitle">Select your item for battle!</div>
        </div>
        <ItemSelector inventory={inventory} onSelect={selectItem} />
      </div>
    );
  }

  if (!player1 || !player2) {
    return (
      <div className="game-wrapper">
        <div className="game-title">
          <h1>LennyFighter</h1>
          <div className="subtitle">Waiting for opponent to connect...</div>
        </div>
        <div className="queuing-screen">
          <h2>{connected ? 'Waiting for opponent...' : 'Connecting...'}</h2>
          <p>Your opponent is joining the match room</p>
          <div className="queuing-bar"><div className="queuing-bar-fill" /></div>
        </div>
      </div>
    );
  }

  // Display: if I'm player2, visually swap so I'm always on the left
  const displayLeft = mySlot === 'player1' ? player1 : player2;
  const displayRight = mySlot === 'player1' ? player2 : player1;
  const leftAnim = mySlot === 'player1' ? p1Anim : p2Anim;
  const rightAnim = mySlot === 'player1' ? p2Anim : p1Anim;

  return (
    <div className="game-wrapper">
      <div className="game-title">
        <h1>LennyFighter</h1>
        <div className="subtitle">
          {status === 'active'
            ? (isMyTurn ? 'Your turn!' : `${(mySlot === 'player1' ? player2 : player1).username}'s turn...`)
            : status === 'finished' ? 'Match Over!' : 'Battle for LennyCoin!'}
        </div>
      </div>

      <div className="game-layout">
        {/* Left HUD */}
        <div className="player-hud">
          <div className="hud-avatar">
            <img src={myFighter?.avatar} alt={myFighter?.name} />
          </div>
          <div className="hud-name">{displayLeft.username}</div>
          <div className="hud-fighter-name">{myFighter?.name}</div>
          <span className={`hud-type-badge type-${myFighter?.type}`}>{myFighter?.type}</span>
          <div className="hud-stats">
            <div className="hud-stat"><span>ATK</span><span>{myFighter?.stats.atk}</span></div>
            <div className="hud-stat"><span>DEF</span><span>{myFighter?.stats.def}</span></div>
            <div className="hud-stat"><span>SPD</span><span>{myFighter?.stats.spd}</span></div>
          </div>
          <div className="hud-turn-indicator" aria-live="polite">
            {isMyTurn ? '⚔️ YOUR TURN' : '⏳ WAITING'}
          </div>
        </div>

        {/* Main arena */}
        <div style={{ flex: 1 }}>
          <BattleArena
            leftPlayer={{ fighter: displayLeft.fighter, hp: displayLeft.hp, maxHp: displayLeft.fighter.stats.hp, username: displayLeft.username }}
            rightPlayer={{ fighter: displayRight.fighter, hp: displayRight.hp, maxHp: displayRight.fighter.stats.hp, username: displayRight.username }}
            isMyTurn={isMyTurn}
            turnNumber={battleState.turnNumber}
            status={status}
            trivia={trivia ? {
              question: trivia.question,
              options: trivia.options,
              eliminatedOption: trivia.eliminatedOption,
              revealedMoves: trivia.revealedMoves,
            } : null}
            selectedMove={selectedMove}
            onSelectMove={setSelectedMove}
            onAnswer={handleAnswer}
            onForfeit={() => {
              if (window.confirm('Forfeit the match? Your opponent wins.')) {
                const opponentId = mySlot === 'player1' ? player2?.id : player1?.id;
                onMatchEnd(opponentId || '', 'forfeit');
              }
            }}
            canUseItem={canUseItem}
            onUseItem={useItem}
            leftAnim={leftAnim}
            rightAnim={rightAnim}
            damagePopups={damagePopups}
            showFight={showFight}
            showKO={showKO}
            shaking={shaking}
            showImpact={showImpact}
            moves={myFighter?.moves ?? []}
            opponentType={opponentFighter?.type ?? 'Growth'}
            waitingMessage="Opponent is thinking..."
            finishedMessage={
              status === 'finished'
                ? (winner === (mySlot === 'player1' ? player1.id : player2.id) ? 'YOU WIN!' : 'YOU LOSE!')
                : undefined
            }
          />

          {/* Mobile HUD bar — visible only on mobile when sidebars are hidden */}
          <div className="mobile-hud">
            <div className="mobile-hud-item">
              <span>Lv 1</span>
              {canUseItem && <span className="mobile-hud-item-badge">Item Ready</span>}
            </div>
            <div className="mobile-hud-status">
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </div>
            <div className="mobile-hud-item">
              <span>vs {(mySlot === 'player1' ? player2 : player1).username}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="game-footer">
            <div>
              <span>Click answers to respond</span>
            </div>
            <div>
              <span>Multiplayer — Playing vs {(mySlot === 'player1' ? player2 : player1).username}</span>
              {!connected && <span style={{ color: '#f87171', marginLeft: '8px' }}>Reconnecting...</span>}
            </div>
          </div>
        </div>

      </div>

      {/* Item activation toast */}
      {itemActivated && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#a855f7',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 1100,
          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.5)',
          textAlign: 'center',
          maxWidth: '90vw',
        }}>
          <div>{itemActivated.name}</div>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{itemActivated.description}</div>
        </div>
      )}

      {/* Opponent item indicator */}
      {status === 'active' && (() => {
        const opponentPlayer = mySlot === 'player1' ? player2 : player1;
        return opponentPlayer?.itemName ? (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: '#2d2d4a',
            border: '1px solid #a855f7',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '12px',
            color: '#c4b5fd',
            maxWidth: '50vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Opponent item: {opponentPlayer.itemName}
          </div>
        ) : null;
      })()}
    </div>
  );
}
