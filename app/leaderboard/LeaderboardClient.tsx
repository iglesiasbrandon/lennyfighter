'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLocalGamertag } from '../hooks/useMultiplayer';

interface PlayerStats {
  gamertag: string;
  lennycoins: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_streak: number;
  best_streak: number;
  last_fighter: string | null;
  last_match_at: string | null;
}

export function LeaderboardClient() {
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myGamertag, setMyGamertag] = useState<string | null>(null);

  useEffect(() => {
    setMyGamertag(getLocalGamertag());
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/stats');
      const json = await res.json() as { success: boolean; data?: { leaderboard: PlayerStats[] }; error?: { message: string } };
      if (json.success && json.data?.leaderboard) {
        setLeaderboard(json.data.leaderboard);
      } else {
        setError(json.error?.message || 'Failed to load leaderboard');
      }
    } catch {
      setError('Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  function winPercent(wins: number, total: number): string {
    if (total === 0) return '0%';
    return Math.round((wins / total) * 100) + '%';
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header-section">
        <h1 className="leaderboard-title">Leaderboard</h1>
        <button className="btn btn-outline leaderboard-refresh" onClick={fetchLeaderboard} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading && leaderboard.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontFamily: 'VT323, monospace', fontSize: '28px', color: '#e0e0e0', animation: 'pulse 1.5s ease-in-out infinite' }}>
            Loading...
          </p>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
      )}

      {error && <p className="leaderboard-error">{error}</p>}

      {!loading && !error && leaderboard.length === 0 && (
        <p className="leaderboard-empty">No matches played yet. Be the first!</p>
      )}

      {leaderboard.length > 0 && (
        <div className="leaderboard-table-wrapper">
          <table className="leaderboard-table">
            <thead>
              <tr className="leaderboard-header">
                <th className="leaderboard-rank">#</th>
                <th className="leaderboard-gamertag">Gamertag</th>
                <th className="leaderboard-stat">LC</th>
                <th className="leaderboard-stat">W</th>
                <th className="leaderboard-stat">L</th>
                <th className="leaderboard-stat leaderboard-hide-mobile">Win%</th>
                <th className="leaderboard-stat leaderboard-hide-mobile">Streak</th>
                <th className="leaderboard-stat leaderboard-hide-mobile">Fighter</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, i) => {
                const isMe = myGamertag != null && player.gamertag === myGamertag;
                return (
                  <tr key={player.gamertag} className={`leaderboard-row${isMe ? ' current-player' : ''}`}>
                    <td className="leaderboard-rank">{i + 1}</td>
                    <td className="leaderboard-gamertag">{player.gamertag}{isMe ? ' (you)' : ''}</td>
                    <td className="leaderboard-stat">{'\u{1FA99}'} {player.lennycoins}</td>
                    <td className="leaderboard-stat">{player.wins}</td>
                    <td className="leaderboard-stat">{player.losses}</td>
                    <td className="leaderboard-stat leaderboard-hide-mobile">{winPercent(player.wins, player.total_matches)}</td>
                    <td className="leaderboard-stat leaderboard-hide-mobile">{player.win_streak}</td>
                    <td className="leaderboard-stat leaderboard-hide-mobile">{player.last_fighter || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
