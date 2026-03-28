'use client';

import type { Fighter } from '../../lib/types';

interface FighterSelectProps {
  fighters: Fighter[];
  selected: Fighter | null;
  onSelect: (fighter: Fighter) => void;
}

export function FighterSelect({ fighters, selected, onSelect }: FighterSelectProps) {
  return (
    <div className="fighter-grid">
      {fighters.map((fighter) => (
        <div
          key={fighter.id}
          className={`fighter-card ${selected?.id === fighter.id ? 'selected' : ''}`}
          onClick={() => onSelect(fighter)}
        >
          <div className="fighter-avatar">
            <img src={fighter.avatar} alt={fighter.name} />
          </div>
          <span className={`type-badge type-${fighter.type}`}>{fighter.type}</span>
          <h3>{fighter.name}</h3>
          <div className="title">{fighter.title}</div>
          <div className="stats">
            <StatMini label="HP" value={fighter.stats.hp} max={150} />
            <StatMini label="ATK" value={fighter.stats.atk} max={20} />
            <StatMini label="DEF" value={fighter.stats.def} max={15} />
            <StatMini label="SPD" value={fighter.stats.spd} max={16} />
          </div>
          {selected?.id === fighter.id && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '18px', color: '#888', marginBottom: '4px' }}>Moves:</div>
              {fighter.moves.map((m) => (
                <div key={m.name} style={{ fontSize: '18px', color: '#444', marginBottom: '2px' }}>
                  {m.name} (PWR:{m.power})
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatMini({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ textAlign: 'left' }}>
      <span style={{ fontSize: '18px', color: '#888' }}>{label}: </span>
      <span style={{ fontSize: '18px', color: '#444' }}>{value}</span>
      <div className="stat-mini-bar">
        <div className="stat-mini-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
