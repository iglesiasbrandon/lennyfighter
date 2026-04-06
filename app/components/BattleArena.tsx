'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTypeMultiplier } from '../../lib/gameLogic';
import type { Fighter, FighterType } from '../../lib/types';

interface PlayerDisplay {
  fighter: Fighter;
  hp: number;
  maxHp: number;
  username: string;
}

interface DamagePopup {
  id: number;
  x: string;
  y: string;
  value: number;
  correct: boolean;
}

export interface BattleArenaProps {
  // Players (already arranged left = me, right = opponent)
  leftPlayer: PlayerDisplay;
  rightPlayer: PlayerDisplay;

  // State
  isMyTurn: boolean;
  turnNumber: number;
  status: string;
  trivia: {
    question: string;
    options: string[];
    eliminatedOption?: number | null;
    revealedMoves?: Array<{ name: string; power: number; type?: string }> | null;
  } | null;
  selectedMove: number;
  onSelectMove: (index: number) => void;

  // Actions
  onAnswer: (answer: string) => void;
  onForfeit: () => void;
  canUseItem?: boolean;
  onUseItem?: () => void;

  // Answer feedback (from turn_result or bot logic)
  answerFeedback?: {
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  } | null;
  onFeedbackDone?: () => void;

  // Extra move buttons (e.g. stolen move in BattleView)
  extraMoveButtons?: React.ReactNode;

  // Animations
  leftAnim: string;
  rightAnim: string;
  damagePopups: DamagePopup[];
  showFight: boolean;
  showKO: boolean;
  shaking: boolean;
  showImpact: boolean;

  // Moves for the move selection row
  moves: Array<{ name: string; power: number; type: string | FighterType }>;
  opponentType: string | FighterType;

  // Optional
  waitingMessage?: string;
  finishedMessage?: string;
}

export function BattleArena({
  leftPlayer,
  rightPlayer,
  isMyTurn,
  turnNumber,
  status,
  trivia,
  selectedMove,
  onSelectMove,
  onAnswer,
  onForfeit,
  canUseItem,
  onUseItem,
  answerFeedback,
  onFeedbackDone,
  extraMoveButtons,
  leftAnim,
  rightAnim,
  damagePopups,
  showFight,
  showKO,
  shaking,
  showImpact,
  moves,
  opponentType,
  waitingMessage = 'Opponent is thinking...',
  finishedMessage,
}: BattleArenaProps) {
  const leftHpPct = (leftPlayer.hp / leftPlayer.maxHp) * 100;
  const rightHpPct = (rightPlayer.hp / rightPlayer.maxHp) * 100;

  // Answer feedback display state
  const [feedbackActive, setFeedbackActive] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ selectedAnswer: string; correctAnswer: string; isCorrect: boolean } | null>(null);
  const [feedbackTrivia, setFeedbackTrivia] = useState<{ question: string; options: string[] } | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When answerFeedback prop arrives, activate the feedback display
  useEffect(() => {
    if (answerFeedback) {
      setFeedbackData(answerFeedback);
      setFeedbackActive(true);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackActive(false);
        setFeedbackData(null);
        setFeedbackTrivia(null);
        onFeedbackDone?.();
      }, 1500);
    }
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [answerFeedback, onFeedbackDone]);

  // Wrap onAnswer to capture the selected answer and trivia options before they disappear
  const handleAnswer = useCallback((answer: string) => {
    if (feedbackActive) return; // Block clicks during feedback
    if (trivia) {
      setFeedbackTrivia({ question: trivia.question, options: [...trivia.options] });
    }
    onAnswer(answer);
  }, [onAnswer, feedbackActive, trivia]);

  return (
    <>
      <div className={`arena-container ${shaking ? 'arena-shake' : ''}`}>
        <div className="sf-hp-bar-container">
          <div className="sf-hp-section sf-hp-left">
            <div className="sf-hp-name-row">
              <span className="sf-hp-name">{leftPlayer.fighter.name.toUpperCase()}</span>
              <span className={`hp-type-badge type-${leftPlayer.fighter.type}`}>{leftPlayer.fighter.type.toUpperCase()}</span>
              <span className="sf-hp-gamertag">{leftPlayer.username}</span>
            </div>
            <div className="hp-bar-track" role="progressbar" aria-valuenow={leftPlayer.hp} aria-valuemin={0} aria-valuemax={leftPlayer.maxHp} aria-label={`${leftPlayer.fighter.name} health`}>
              <div className={`hp-bar-fill ${leftHpPct < 25 ? 'low' : leftHpPct < 50 ? 'medium' : ''}`} style={{ width: `${leftHpPct}%` }} />
            </div>
            <span className="sf-hp-numbers">{leftPlayer.hp} / {leftPlayer.maxHp}</span>
          </div>
          <div className="sf-turn-indicator" aria-live="polite">
            <span>TURN {turnNumber}</span>
          </div>
          <div className="sf-hp-section sf-hp-right">
            <div className="sf-hp-name-row">
              <span className="sf-hp-gamertag">{rightPlayer.username}</span>
              <span className={`hp-type-badge type-${rightPlayer.fighter.type}`}>{rightPlayer.fighter.type.toUpperCase()}</span>
              <span className="sf-hp-name">{rightPlayer.fighter.name.toUpperCase()}</span>
            </div>
            <div className="hp-bar-track" role="progressbar" aria-valuenow={rightPlayer.hp} aria-valuemin={0} aria-valuemax={rightPlayer.maxHp} aria-label={`${rightPlayer.fighter.name} health`}>
              <div className={`hp-bar-fill ${rightHpPct < 25 ? 'low' : rightHpPct < 50 ? 'medium' : ''}`} style={{ width: `${rightHpPct}%` }} />
            </div>
            <span className="sf-hp-numbers">{rightPlayer.hp} / {rightPlayer.maxHp}</span>
          </div>
        </div>

        <div className="arena-bg" />
        <div className="arena-circle-left" />
        <div className="arena-circle-right" />

        {/* FIGHT! / K.O.! / Impact overlays */}
        {showFight && <div className="fight-text">FIGHT!</div>}
        {showKO && <div className="ko-text">K.O.!</div>}
        {showImpact && <div className="impact-overlay" />}

        {/* Sprites */}
        <div className="arena-fighters">
          <div className={`arena-fighter player ${leftAnim} sprite-${leftPlayer.fighter.type}`}>
            <img className="fighter-sprite" src={leftPlayer.fighter.avatar} alt={leftPlayer.fighter.name} />
          </div>
          <div className={`arena-fighter opponent ${rightAnim} sprite-${rightPlayer.fighter.type}`}>
            <img className="fighter-sprite" src={rightPlayer.fighter.avatar} alt={rightPlayer.fighter.name} />
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
            <div className="waiting-text">{waitingMessage}</div>
          </div>
        )}

        {/* Victory / finished overlay */}
        {status === 'finished' && finishedMessage && (
          <div className="waiting-overlay">
            <div className="waiting-text" style={{ fontSize: '18px', animation: 'none', opacity: 1 }}>
              {finishedMessage}
            </div>
          </div>
        )}
      </div>

      {/* Move selection + Use Item button */}
      {status === 'active' && isMyTurn && moves.length > 0 && (
        <div className="move-select-row">
          {moves.map((move, i) => {
            const mult = getTypeMultiplier(move.type, opponentType);
            return (
              <button
                key={move.name}
                className={`move-btn ${selectedMove === i ? 'active' : ''}`}
                onClick={() => onSelectMove(i)}
                aria-label={`Move: ${move.name}, Power: ${move.power}`}
              >
                {move.name} (PWR:{move.power})
                {mult > 1.0 && <span className="move-effectiveness super">&#9650; 1.5x</span>}
                {mult < 1.0 && <span className="move-effectiveness weak">&#9660; 0.67x</span>}
              </button>
            );
          })}
          {extraMoveButtons}
          {canUseItem && onUseItem && (
            <button
              className="move-btn"
              style={{ backgroundColor: '#a855f7', borderColor: '#a855f7' }}
              onClick={onUseItem}
            >
              Use Item
            </button>
          )}
        </div>
      )}

      {/* Revealed opponent moves (The Memo) */}
      {trivia?.revealedMoves && isMyTurn && status === 'active' && (
        <div style={{ padding: '6px 10px', margin: '4px 0', backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '16px', color: '#93c5fd', maxWidth: '720px', marginLeft: 'auto', marginRight: 'auto' }}>
          <strong>The Memo reveals opponent moves:</strong>{' '}
          {trivia.revealedMoves.map((m, i) => (
            <span key={i}>{i > 0 ? ', ' : ''}{m.name} (PWR:{m.power})</span>
          ))}
        </div>
      )}

      {/* Trivia — show normal trivia OR feedback state */}
      {trivia && isMyTurn && status === 'active' && !feedbackActive && (
        <div className="question-panel">
          <div className="question-left">
            <div>
              <span className="question-counter">Turn {turnNumber}</span>
              <span className="question-difficulty">TRIVIA</span>
            </div>
            <div className="question-text">{trivia.question}</div>
            <div className="enter-hint">Select your answer</div>
          </div>
          <div className="question-right">
            {trivia.options.map((option, i) => {
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

      {/* Answer feedback overlay */}
      {feedbackActive && feedbackData && feedbackTrivia && (
        <div className="question-panel">
          <div className="question-left">
            <div>
              <span className="question-counter">Turn {turnNumber}</span>
              <span className="question-difficulty">{feedbackData.isCorrect ? 'CORRECT' : 'WRONG'}</span>
            </div>
            <div className="question-text">{feedbackTrivia.question}</div>
            <div className="enter-hint">{feedbackData.isCorrect ? 'Nice one!' : `Answer: ${feedbackData.correctAnswer}`}</div>
          </div>
          <div className="question-right">
            {feedbackTrivia.options.map((option, i) => {
              const isSelected = option === feedbackData.selectedAnswer;
              const isCorrectAnswer = option === feedbackData.correctAnswer;
              let extraClass = '';
              let indicator = '';
              if (isCorrectAnswer) {
                extraClass = 'answer-correct';
                indicator = ' \u2713';
              } else if (isSelected && !feedbackData.isCorrect) {
                extraClass = 'answer-wrong';
                indicator = ' \u2717';
              } else {
                extraClass = 'answer-dimmed';
              }
              return (
                <button key={i} className={`answer-option ${extraClass}`} disabled role="button" aria-label={`Answer ${i + 1}: ${option}`}>
                  <span className="option-number">{i + 1}</span>
                  {option}{indicator}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Game footer with forfeit */}
      <div className="game-footer">
        <div>
          <h4>How to Play:</h4>
          <ul>
            <li>Click answers to respond</li>
            <li>Select moves to attack</li>
          </ul>
        </div>
        <div>
          {status === 'active' && (
            <button className="forfeit-btn" onClick={onForfeit}>Forfeit Match</button>
          )}
        </div>
      </div>
    </>
  );
}
