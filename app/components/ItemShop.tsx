'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GameItem, InventoryEntry } from '../../lib/types';
import { getShopItems, purchaseItem, getInventory, getGamertag } from '../lib/api';
import { RARITY_COLORS } from '../../lib/itemData';

const MAX_QUANTITY = 3;

export function ItemShop({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<GameItem[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, inventoryRes] = await Promise.all([
        getShopItems(),
        getInventory(),
      ]);

      if (itemsRes.success && itemsRes.data) {
        setItems(itemsRes.data as GameItem[]);
      }

      if (inventoryRes.success && inventoryRes.data) {
        const inv: Record<string, number> = {};
        for (const entry of inventoryRes.data as InventoryEntry[]) {
          inv[entry.item.id] = entry.quantity;
        }
        setInventory(inv);
      }
    } catch {
      showToast('Failed to load shop data', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const tag = getGamertag();
    if (tag) {
      fetch(`/api/v1/stats/${tag}`)
        .then(r => r.json())
        .then((json: any) => {
          if (json.success && json.data) setBalance(json.data.lennycoins);
        })
        .catch(() => {});
    }
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handlePurchase(item: GameItem) {
    setPurchasing(item.id);
    try {
      const res = await purchaseItem(item.id);
      if (res.success) {
        showToast(`Purchased ${item.name}!`, 'success');
        setInventory(prev => ({
          ...prev,
          [item.id]: (prev[item.id] || 0) + 1,
        }));
        const data = res.data as { remaining_coins?: number } | undefined;
        if (data && typeof data.remaining_coins === 'number') {
          setBalance(data.remaining_coins);
        }
      } else {
        showToast(res.error?.message || 'Purchase failed', 'error');
      }
    } catch {
      showToast('Network error during purchase', 'error');
    }
    setPurchasing(null);
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Item Shop</h2>
          <span style={{ color: '#ffcc00', fontSize: '20px', fontFamily: "'VT323', monospace" }}>💰 {balance !== null ? `${balance} LC` : '...'}</span>
          <button style={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingText}>Loading shop...</div>
          </div>
        ) : (
          <div style={styles.grid}>
            {items.map(item => {
              const owned = inventory[item.id] || 0;
              const atMax = owned >= MAX_QUANTITY;
              const unaffordable = balance !== null && balance < item.cost;
              const disabled = atMax || unaffordable || purchasing === item.id;

              return (
                <div key={item.id} style={{ ...styles.card, ...(unaffordable ? { opacity: 0.5 } : {}) }}>
                  <div style={styles.cardHeader}>
                    <span style={styles.itemName}>{item.name}</span>
                    <span
                      style={{
                        ...styles.rarityBadge,
                        backgroundColor: RARITY_COLORS[item.rarity],
                      }}
                    >
                      {item.rarity.toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.description}>{item.description}</div>
                  <div style={styles.flavor}>{item.flavor}</div>

                  <div style={styles.cardFooter}>
                    <div style={styles.costRow}>
                      <span style={styles.costIcon}>LC</span>
                      <span style={styles.costAmount}>{item.cost}</span>
                      {owned > 0 && (
                        <span style={styles.ownedBadge}>Owned: {owned}/{MAX_QUANTITY}</span>
                      )}
                    </div>
                    <button
                      style={{
                        ...styles.buyBtn,
                        ...(disabled ? styles.buyBtnDisabled : {}),
                      }}
                      disabled={disabled}
                      onClick={() => handlePurchase(item)}
                    >
                      {purchasing === item.id
                        ? 'Buying...'
                        : atMax
                          ? 'Max Owned'
                          : unaffordable
                            ? 'Not enough LC'
                            : 'Buy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {toast && (
          <div
            style={{
              ...styles.toast,
              backgroundColor: toast.type === 'success' ? '#22c55e' : '#ef4444',
            }}
          >
            {toast.message}
          </div>
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
    maxWidth: '900px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '12px',
    position: 'relative',
    fontFamily: "'VT323', monospace",
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
    borderBottom: '2px solid #333',
    paddingBottom: '16px',
  },
  title: {
    margin: 0,
    color: '#ffcc00',
    fontSize: '28px',
    fontWeight: 700,
    flex: 1,
    fontFamily: "'VT323', monospace",
  },
  closeBtn: {
    background: 'rgba(0,0,0,0.4)',
    border: '2px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: '4px',
    fontFamily: "'VT323', monospace",
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px',
  },
  loadingText: {
    color: '#ffcc00',
    fontSize: '22px',
    fontFamily: "'VT323', monospace",
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  card: {
    backgroundColor: '#0d1117',
    border: '2px solid #333',
    borderRadius: '6px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'border-color 0.15s',
  },
  cardHeader: {
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
    letterSpacing: '0.5px',
    fontFamily: "'VT323', monospace",
  },
  description: {
    color: '#ccc',
    fontSize: '18px',
    lineHeight: '1.4',
    fontFamily: "'VT323', monospace",
  },
  flavor: {
    color: '#888',
    fontSize: '16px',
    fontStyle: 'italic',
    lineHeight: '1.3',
    fontFamily: "'VT323', monospace",
  },
  cardFooter: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    paddingTop: '10px',
    borderTop: '1px solid #444',
  },
  costRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  costIcon: {
    color: '#ff6b35',
    fontWeight: 700,
    fontSize: '20px',
    fontFamily: "'VT323', monospace",
  },
  costAmount: {
    color: '#ff6b35',
    fontWeight: 700,
    fontSize: '20px',
    fontFamily: "'VT323', monospace",
  },
  ownedBadge: {
    color: '#9ca3af',
    fontSize: '16px',
    marginLeft: '8px',
    fontFamily: "'VT323', monospace",
  },
  buyBtn: {
    backgroundColor: '#ff6b35',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 20px',
    fontSize: '20px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'VT323', monospace",
    minHeight: '44px',
  },
  buyBtnDisabled: {
    backgroundColor: '#444',
    color: '#777',
    cursor: 'not-allowed',
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    padding: '12px 28px',
    borderRadius: '6px',
    fontSize: '20px',
    fontWeight: 600,
    zIndex: 1100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    fontFamily: "'VT323', monospace",
  },
};
