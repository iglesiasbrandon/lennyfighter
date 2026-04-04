'use client';

import { useState, useEffect, useRef } from 'react';
import type { InventoryEntry } from '../../lib/types';
import { RARITY_COLORS } from '../../lib/itemData';

const SELECTION_TIME = 15;

interface ItemSelectorProps {
  inventory: InventoryEntry[];
  onSelect: (itemId: string | null) => void;
}

export function ItemSelector({ inventory, onSelect }: ItemSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(SELECTION_TIME);
  const [confirmed, setConfirmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up -- auto-submit current selection
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-submit when timer hits zero
  useEffect(() => {
    if (timeLeft === 0 && !confirmed) {
      setConfirmed(true);
      onSelect(selectedId);
    }
  }, [timeLeft, confirmed, selectedId, onSelect]);

  function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    onSelect(selectedId);
  }

  function handleSkip() {
    if (confirmed) return;
    setConfirmed(true);
    if (timerRef.current) clearInterval(timerRef.current);
    onSelect(null);
  }

  const timerPct = (timeLeft / SELECTION_TIME) * 100;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Select an Item</h2>
          <div style={styles.timerContainer}>
            <div style={styles.timerBarTrack}>
              <div
                style={{
                  ...styles.timerBarFill,
                  width: `${timerPct}%`,
                  backgroundColor: timeLeft <= 5 ? '#ef4444' : '#ff6b35',
                }}
              />
            </div>
            <span style={{
              ...styles.timerText,
              color: timeLeft <= 5 ? '#ef4444' : '#ff6b35',
            }}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {confirmed ? (
          <div style={styles.confirmedContainer}>
            <div style={styles.confirmedText}>
              {selectedId
                ? `Selected: ${inventory.find(e => e.item.id === selectedId)?.item.name}`
                : 'No item selected'}
            </div>
            <div style={styles.waitingText}>Waiting for opponent...</div>
          </div>
        ) : (
          <>
            {inventory.length === 0 ? (
              <div style={styles.emptyContainer}>
                <div style={styles.emptyText}>
                  You have no items. Visit the Item Shop to purchase some!
                </div>
              </div>
            ) : (
              <div style={styles.grid}>
                {inventory.map(entry => {
                  const isSelected = selectedId === entry.item.id;
                  return (
                    <button
                      key={entry.item.id}
                      style={{
                        ...styles.itemCard,
                        border: isSelected
                          ? '2px solid #ff6b35'
                          : '2px solid #333',
                        boxShadow: isSelected
                          ? '0 0 12px rgba(255, 107, 53, 0.25)'
                          : 'none',
                      }}
                      onClick={() => setSelectedId(isSelected ? null : entry.item.id)}
                    >
                      <div style={styles.cardTop}>
                        <span style={styles.itemName}>{entry.item.name}</span>
                        <span
                          style={{
                            ...styles.rarityBadge,
                            backgroundColor: RARITY_COLORS[entry.item.rarity],
                          }}
                        >
                          {entry.item.rarity.toUpperCase()}
                        </span>
                      </div>
                      <div style={styles.itemDesc}>{entry.item.description}</div>
                      <div style={styles.itemQty}>x{entry.quantity}</div>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={styles.actions}>
              <button style={styles.skipBtn} onClick={handleSkip}>
                No Item
              </button>
              <button
                style={{
                  ...styles.readyBtn,
                  ...(selectedId ? {} : styles.readyBtnDisabled),
                }}
                disabled={!selectedId}
                onClick={handleConfirm}
              >
                Ready
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#141422',
    border: '3px solid #333',
    borderRadius: '8px',
    width: '94%',
    maxWidth: '800px',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: '12px',
    fontFamily: "'VT323', monospace",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    borderBottom: '2px solid #333',
    paddingBottom: '16px',
    gap: '16px',
  },
  title: {
    margin: 0,
    color: '#ffcc00',
    fontSize: '22px',
    fontWeight: 700,
    fontFamily: "'VT323', monospace",
  },
  timerContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  timerBarTrack: {
    width: '100px',
    height: '8px',
    backgroundColor: '#444',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 1s linear',
  },
  timerText: {
    fontWeight: 700,
    fontSize: '20px',
    fontVariantNumeric: 'tabular-nums',
    color: '#e0d8c8',
    fontFamily: "'VT323', monospace",
  },
  confirmedContainer: {
    textAlign: 'center',
    padding: '40px 0',
  },
  confirmedText: {
    color: '#ffcc00',
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '12px',
    fontFamily: "'VT323', monospace",
  },
  waitingText: {
    color: '#888',
    fontSize: '20px',
    fontFamily: "'VT323', monospace",
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '40px 0',
  },
  emptyText: {
    color: '#888',
    fontSize: '20px',
    fontFamily: "'VT323', monospace",
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '10px',
    marginBottom: '20px',
  },
  itemCard: {
    background: '#0d1117',
    border: '2px solid #333',
    borderRadius: '6px',
    padding: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'border-color 0.15s',
    minHeight: '44px',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  itemName: {
    color: '#e0d8c8',
    fontWeight: 700,
    fontSize: '20px',
    fontFamily: "'VT323', monospace",
  },
  rarityBadge: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
    fontFamily: "'VT323', monospace",
  },
  itemDesc: {
    color: '#ccc',
    fontSize: '18px',
    lineHeight: '1.4',
    fontFamily: "'VT323', monospace",
  },
  itemQty: {
    color: '#ffcc00',
    fontSize: '18px',
    fontWeight: 700,
    marginTop: 'auto',
    fontFamily: "'VT323', monospace",
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
  },
  skipBtn: {
    backgroundColor: 'transparent',
    border: '2px solid #555',
    color: '#e0d8c8',
    borderRadius: '4px',
    padding: '10px 28px',
    fontSize: '20px',
    cursor: 'pointer',
    fontFamily: "'VT323', monospace",
    minHeight: '44px',
  },
  readyBtn: {
    backgroundColor: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 28px',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'VT323', monospace",
    minHeight: '44px',
  },
  readyBtnDisabled: {
    backgroundColor: '#444',
    color: '#777',
    cursor: 'not-allowed',
  },
};
