'use client';

import { useState, useEffect } from 'react';
import { getLocalGamertag, setLocalGamertag } from '../hooks/useMultiplayer';

export function LandingHero() {
  const [gamertag, setGamertag] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existing = getLocalGamertag();
    if (existing) {
      setHasExisting(true);
      setGamertag(existing);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = gamertag.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(trimmed)) {
      setError('3-16 characters, letters/numbers/underscore only');
      return;
    }
    setLocalGamertag(trimmed);
    window.location.href = '/lobby';
  }

  return (
    <div className="landing-container">
      <h1 className="landing-title">LENNYFIGHTER</h1>
      <p style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", color: '#ff6b35', letterSpacing: '4px', fontSize: '16px' }}>ENTER THE ARENA</p>
      <p className="landing-tagline">Battle for LennyCoin!</p>

      {hasExisting ? (
        <div className="landing-welcome">
          <p>Welcome back, fighter <strong>{gamertag}</strong></p>
          <a href="/lobby" className="btn btn-primary landing-play-btn">Play</a>
          <button className="landing-change-btn" onClick={() => setHasExisting(false)}>
            CHANGE FIGHTER TAG
          </button>
        </div>
      ) : (
        <form className="landing-form" onSubmit={handleSubmit}>
          <input
            className="landing-input"
            type="text"
            placeholder="INSERT GAMERTAG"
            value={gamertag}
            onChange={(e) => setGamertag(e.target.value)}
            maxLength={16}
            autoFocus
          />
          {error && <p className="landing-error">{error}</p>}
          <button type="submit" className="btn btn-primary landing-play-btn">
            FIGHT!
          </button>
        </form>
      )}

      <p className="landing-subtitle">
        Choose your fighter. Answer trivia. Win LennyCoin.
      </p>
    </div>
  );
}
