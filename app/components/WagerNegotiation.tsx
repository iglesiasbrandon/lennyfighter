'use client';

import { useState, useEffect } from 'react';

interface WagerNegotiationProps {
  mySlot: 'player1' | 'player2';
  proposerSlot: 'player1' | 'player2' | null;
  player1Balance: number;
  player2Balance: number;
  maxWager: number;
  proposedAmount: number | null;
  awaitingResponse: boolean;
  onPropose: (amount: number) => void;
  onAccept: () => void;
  onCounter: (amount: number) => void;
  onSkip: () => void;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function WagerNegotiation({
  mySlot,
  proposerSlot,
  player1Balance,
  player2Balance,
  maxWager,
  proposedAmount,
  awaitingResponse,
  onPropose,
  onAccept,
  onCounter,
  onSkip,
}: WagerNegotiationProps) {
  const [counterAmount, setCounterAmount] = useState('');
  const [countdown, setCountdown] = useState(15);

  const myBalance = mySlot === 'player1' ? player1Balance : player2Balance;
  const opponentBalance = mySlot === 'player1' ? player2Balance : player1Balance;
  const isProposer = mySlot === proposerSlot;

  // Determine the current phase
  const waitingForOpponent = proposedAmount !== null && !awaitingResponse && isProposer;
  const opponentProposed = proposedAmount !== null && awaitingResponse && !isProposer;
  const opponentCountered = proposedAmount !== null && awaitingResponse && isProposer;
  const needToPropose = isProposer && proposedAmount === null && awaitingResponse;

  // Countdown timer — resets when awaitingResponse changes to true
  useEffect(() => {
    if (!awaitingResponse) return;
    setCountdown(15);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [awaitingResponse, onSkip]);

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '24px',
      fontFamily: "'VT323', monospace",
    },
    panel: {
      backgroundColor: '#2a2a2a',
      border: '3px solid #c8a832',
      borderRadius: '12px',
      padding: '32px',
      maxWidth: '480px',
      width: '100%',
      textAlign: 'center' as const,
      boxShadow: '0 0 20px rgba(200, 168, 50, 0.3)',
    },
    title: {
      fontSize: '28px',
      color: '#c8a832',
      marginBottom: '20px',
      letterSpacing: '2px',
    },
    balanceRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      fontSize: '20px',
      color: '#e0e0e0',
    },
    maxWager: {
      fontSize: '18px',
      color: '#a0a0a0',
      marginBottom: '24px',
      borderTop: '1px solid #444',
      paddingTop: '12px',
    },
    presetRow: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '10px',
      justifyContent: 'center',
      marginBottom: '16px',
    },
    presetBtn: {
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      padding: '10px 20px',
      backgroundColor: '#3a3a3a',
      color: '#c8a832',
      border: '2px solid #c8a832',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.15s',
    },
    allInBtn: {
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      padding: '10px 20px',
      backgroundColor: '#8b0000',
      color: '#ffd700',
      border: '2px solid #ffd700',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: 'bold' as const,
    },
    skipBtn: {
      fontFamily: "'VT323', monospace",
      fontSize: '18px',
      padding: '8px 24px',
      backgroundColor: '#333',
      color: '#888',
      border: '2px solid #555',
      borderRadius: '8px',
      cursor: 'pointer',
      marginTop: '12px',
    },
    acceptBtn: {
      fontFamily: "'VT323', monospace",
      fontSize: '22px',
      padding: '12px 32px',
      backgroundColor: '#1a5c1a',
      color: '#4ade80',
      border: '2px solid #4ade80',
      borderRadius: '8px',
      cursor: 'pointer',
      marginRight: '12px',
    },
    counterSection: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '16px',
    },
    counterInput: {
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      padding: '8px 12px',
      width: '100px',
      backgroundColor: '#1a1a1a',
      color: '#c8a832',
      border: '2px solid #555',
      borderRadius: '6px',
      textAlign: 'center' as const,
    },
    counterBtn: {
      fontFamily: "'VT323', monospace",
      fontSize: '20px',
      padding: '8px 20px',
      backgroundColor: '#3a3a3a',
      color: '#60a5fa',
      border: '2px solid #60a5fa',
      borderRadius: '8px',
      cursor: 'pointer',
    },
    statusText: {
      fontSize: '22px',
      color: '#e0e0e0',
      marginBottom: '16px',
    },
    pulsingText: {
      fontSize: '20px',
      color: '#a0a0a0',
      animation: 'wagerPulse 1.5s ease-in-out infinite',
    },
    countdown: {
      fontSize: '16px',
      color: '#f87171',
      marginTop: '16px',
    },
    proposedAmount: {
      fontSize: '32px',
      color: '#c8a832',
      fontWeight: 'bold' as const,
      margin: '8px 0',
    },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes wagerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <div style={styles.panel}>
        <div style={styles.title}>WAGER NEGOTIATION</div>

        <div style={styles.balanceRow}>
          <span>Your Balance:</span>
          <span>{myBalance} LC</span>
        </div>
        <div style={styles.balanceRow}>
          <span>Opponent:</span>
          <span>{opponentBalance} LC</span>
        </div>
        <div style={styles.maxWager}>
          Maximum Wager: {maxWager} LC
        </div>

        {/* Phase: I'm the proposer, haven't proposed yet */}
        {needToPropose && (
          <>
            <div style={styles.presetRow}>
              {PRESET_AMOUNTS.filter(a => a <= maxWager).map(amount => (
                <button
                  key={amount}
                  style={styles.presetBtn}
                  onClick={() => onPropose(amount)}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#4a4a4a')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
                >
                  {amount} LC
                </button>
              ))}
              <button
                style={styles.allInBtn}
                onClick={() => onPropose(maxWager)}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#a00000')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = '#8b0000')}
              >
                ALL IN
              </button>
            </div>
            <button style={styles.skipBtn} onClick={onSkip}>
              SKIP — Play without wager
            </button>
            <div style={styles.countdown}>
              Time remaining: {countdown}s
            </div>
          </>
        )}

        {/* Phase: Waiting for opponent's response to my proposal */}
        {waitingForOpponent && (
          <>
            <div style={styles.statusText}>
              You proposed <span style={{ color: '#c8a832' }}>{proposedAmount} LC</span>
            </div>
            <div style={styles.pulsingText}>
              Waiting for opponent...
            </div>
          </>
        )}

        {/* Phase: Opponent proposed to me, I need to respond */}
        {opponentProposed && (
          <>
            <div style={styles.statusText}>
              Opponent wagered
            </div>
            <div style={styles.proposedAmount}>{proposedAmount} LC</div>
            <div>
              <button style={styles.acceptBtn} onClick={onAccept}>
                ACCEPT
              </button>
            </div>
            <div style={styles.counterSection}>
              <input
                type="number"
                style={styles.counterInput}
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                placeholder="Amount"
                min={1}
                max={maxWager}
              />
              <button
                style={styles.counterBtn}
                onClick={() => {
                  const val = parseInt(counterAmount, 10);
                  if (val > 0 && val <= maxWager) {
                    onCounter(val);
                    setCounterAmount('');
                  }
                }}
              >
                COUNTER
              </button>
            </div>
            <button style={styles.skipBtn} onClick={onSkip}>
              SKIP — No wager
            </button>
            <div style={styles.countdown}>
              Time remaining: {countdown}s
            </div>
          </>
        )}

        {/* Phase: Opponent countered my proposal */}
        {opponentCountered && (
          <>
            <div style={styles.statusText}>
              Opponent countered with
            </div>
            <div style={styles.proposedAmount}>{proposedAmount} LC</div>
            <div>
              <button style={styles.acceptBtn} onClick={onAccept}>
                ACCEPT
              </button>
              <button style={styles.skipBtn} onClick={onSkip}>
                SKIP
              </button>
            </div>
            <div style={styles.countdown}>
              Time remaining: {countdown}s
            </div>
          </>
        )}
      </div>
    </div>
  );
}
