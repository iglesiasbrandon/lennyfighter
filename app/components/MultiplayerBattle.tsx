'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Fighter, GameItem, InventoryEntry } from '../../lib/types';
import type { MultiplayerBattleState } from '../hooks/useMultiplayer';
import { getTypeMultiplier } from '../game/fighters';
import { ItemSelector } from './ItemSelector';
import { WagerNegotiation } from './WagerNegotiation';

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
  const popupId = useRef(0);
  const hasEnded = useRef(false);

  const { player1, player2, currentTurn, trivia, status, mySlot, lastTurnResult, winner, winReason, itemSelectionPhase, canUseItem, itemActivated } = battleState;
  const isMyTurn = currentTurn === mySlot;
  const myFighter = mySlot === 'player1' ? player1?.fighter : player2?.fighter;
  const opponentFighter = mySlot === 'player1' ? player2?.fighter : player1?.fighter;

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

  const p1HpPct = (player1.hp / player1.fighter.stats.hp) * 100;
  const p2HpPct = (player2.hp / player2.fighter.stats.hp) * 100;
  const hpClass = (pct: number) => pct > 50 ? '' : pct > 25 ? 'medium' : 'low';

  // Display: if I'm player2, visually swap so I'm always on the left
  const displayLeft = mySlot === 'player1' ? player1 : player2;
  const displayRight = mySlot === 'player1' ? player2 : player1;
  const leftHpPct = mySlot === 'player1' ? p1HpPct : p2HpPct;
  const rightHpPct = mySlot === 'player1' ? p2HpPct : p1HpPct;
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
          {status === 'active' && (
            <button className="forfeit-btn" onClick={() => {
              if (window.confirm('Forfeit the match? Your opponent wins.')) {
                const opponentId = mySlot === 'player1' ? player2?.id : player1?.id;
                onMatchEnd(opponentId || '', 'forfeit');
              }
            }}>Forfeit</button>
          )}
        </div>

        {/* Main arena */}
        <div style={{ flex: 1 }}>
          <div className="arena-container">
            <div className="arena-bg" />
            <div className="arena-circle-left" />
            <div className="arena-circle-right" />

            {/* Opponent HP box */}
            <div className="hp-box opponent-box">
              <span className="fighter-name">{displayRight.fighter.name.toUpperCase()}</span>
              <span className={`hp-type-badge type-${displayRight.fighter.type}`}>{displayRight.fighter.type.toUpperCase()}</span>
              <span className="level-badge">Lv1</span>
              <div className="hp-box-gamertag">{displayRight.username}</div>
              <div className="hp-bar-container">
                <span className="hp-label">HP</span>
                <div className="hp-bar-track" role="progressbar" aria-valuenow={displayRight.hp} aria-valuemin={0} aria-valuemax={displayRight.fighter.stats.hp} aria-label={`${displayRight.fighter.name} HP`}>
                  <div className={`hp-bar-fill ${hpClass(rightHpPct)}`} style={{ width: `${rightHpPct}%` }} />
                </div>
              </div>
              <div className="hp-numbers">{displayRight.hp} / {displayRight.fighter.stats.hp}</div>
            </div>

            {/* Player HP box */}
            <div className="hp-box player-box">
              <span className="fighter-name">{displayLeft.fighter.name.toUpperCase()}</span>
              <span className="level-badge">Lv1</span>
              <div className="hp-box-gamertag">{displayLeft.username}</div>
              <div className="hp-bar-container">
                <span className="hp-label">HP</span>
                <div className="hp-bar-track" role="progressbar" aria-valuenow={displayLeft.hp} aria-valuemin={0} aria-valuemax={displayLeft.fighter.stats.hp} aria-label={`${displayLeft.fighter.name} HP`}>
                  <div className={`hp-bar-fill ${hpClass(leftHpPct)}`} style={{ width: `${leftHpPct}%` }} />
                </div>
              </div>
              <div className="hp-numbers">{displayLeft.hp} / {displayLeft.fighter.stats.hp}</div>
            </div>

            {/* Sprites */}
            <div className="arena-fighters">
              <div className={`arena-fighter player ${leftAnim} sprite-${displayLeft.fighter.type}`}>
                <img className="fighter-sprite" src={displayLeft.fighter.avatar} alt={displayLeft.fighter.name} />
              </div>
              <div className={`arena-fighter opponent ${rightAnim} sprite-${displayRight.fighter.type}`}>
                <img className="fighter-sprite" src={displayRight.fighter.avatar} alt={displayRight.fighter.name} />
              </div>
            </div>

            {/* Damage popups */}
            {damagePopups.map(p => (
              <div key={p.id} className={`damage-popup ${p.correct ? 'correct' : ''}`} style={{ left: p.x, top: p.y }}>
                -{p.value}
              </div>
            ))}

            {/* Waiting for opponent's turn */}
            {!isMyTurn && status === 'active' && (
              <div className="waiting-overlay">
                <div className="waiting-text">Opponent is thinking...</div>
              </div>
            )}

            {/* Victory */}
            {status === 'finished' && (
              <div className="waiting-overlay">
                <div className="waiting-text" style={{ fontSize: '20px', animation: 'none', opacity: 1 }}>
                  {winner === (mySlot === 'player1' ? player1.id : player2.id)
                    ? 'YOU WIN!'
                    : 'YOU LOSE!'}
                </div>
              </div>
            )}
          </div>

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

          {/* Move selection + Use Item button */}
          {status === 'active' && isMyTurn && myFighter && (
            <div className="move-select-row">
              {myFighter.moves.map((move, i) => {
                const mult = opponentFighter ? getTypeMultiplier(move.type, opponentFighter.type) : 1.0;
                return (
                  <button
                    key={move.name}
                    className={`move-btn ${selectedMove === i ? 'active' : ''}`}
                    onClick={() => setSelectedMove(i)}
                    aria-label={`Move: ${move.name}, Power: ${move.power}`}
                  >
                    {move.name} (PWR:{move.power})
                    {mult > 1.0 && <span className="move-effectiveness super">&#9650; 1.5x</span>}
                    {mult < 1.0 && <span className="move-effectiveness weak">&#9660; 0.67x</span>}
                  </button>
                );
              })}
              {canUseItem && (
                <button
                  className="move-btn"
                  style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}
                  onClick={useItem}
                >
                  Use Item
                </button>
              )}
            </div>
          )}

          {/* Revealed opponent moves (The Memo) */}
          {trivia && trivia.revealedMoves && isMyTurn && status === 'active' && (
            <div style={{ padding: '8px 12px', margin: '4px 0', backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '24px', color: '#93c5fd' }}>
              <strong>The Memo reveals opponent moves:</strong>{' '}
              {trivia.revealedMoves.map((m, i) => (
                <span key={i}>{i > 0 ? ', ' : ''}{m.name} (PWR:{m.power})</span>
              ))}
            </div>
          )}

          {/* Trivia */}
          {trivia && isMyTurn && status === 'active' && (
            <div className="question-panel">
              <div className="question-left">
                <div>
                  <span className="question-counter">Turn {battleState.turnNumber}</span>
                  <span className="question-difficulty">TRIVIA</span>
                </div>
                <div className="question-text">{trivia.question}</div>
                <div className="enter-hint">Select your answer</div>
              </div>
              <div className="question-right">
                {trivia.options.map((option, i) => {
                  // Hook Model: hide eliminated option
                  if (trivia.eliminatedOption === i) {
                    return (
                      <button key={i} className="answer-option" disabled style={{ opacity: 0.3, textDecoration: 'line-through', cursor: 'not-allowed' }} role="button" aria-label={`Answer ${i + 1}: ${option}`}>
                        <span className="option-number">{i + 1}</span>
                        {option}
                      </button>
                    );
                  }
                  return (
                    <button key={i} className="answer-option" onClick={() => handleAnswer(option)} role="button" aria-label={`Answer ${i + 1}: ${option}`}>
                      <span className="option-number">{i + 1}</span>
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
          padding: '10px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 1100,
          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.5)',
          textAlign: 'center',
        }}>
          <div>{itemActivated.name}</div>
          <div style={{ fontSize: '24px', opacity: 0.9, marginTop: '2px' }}>{itemActivated.description}</div>
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
            padding: '4px 10px',
            fontSize: '24px',
            color: '#c4b5fd',
          }}>
            Opponent item: {opponentPlayer.itemName}
          </div>
        ) : null;
      })()}
    </div>
  );
}
