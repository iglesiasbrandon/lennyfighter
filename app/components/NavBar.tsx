'use client';

import { useState, useEffect, useRef } from 'react';
import { getLocalGamertag } from '../hooks/useMultiplayer';
import { clearSessionToken } from '../lib/api';

export function NavBar() {
  const [gamertag, setGamertag] = useState<string | null>(null);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tag = getLocalGamertag();
    setGamertag(tag);
    if (tag) {
      fetch(`/api/v1/stats/${tag}`)
        .then(r => r.json() as Promise<{ success: boolean; data?: { lennycoins: number } }>)
        .then((json) => {
          if (json.success && json.data?.lennycoins != null) {
            setCoinBalance(json.data.lennycoins);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  function handleLogoff() {
    localStorage.removeItem('lennyfighter_gamertag');
    localStorage.removeItem('lf_gamertag');
    localStorage.removeItem('username');
    clearSessionToken();
    window.location.href = '/';
  }

  return (
    <nav className="nav">
      <a href="/" className="nav-brand">LENNYFIGHTER</a>
      <ul className="nav-links">
        <li><a href="/lobby">Play</a></li>
        <li><a href="/lobby?shop=1">Shop</a></li>
        <li><a href="/leaderboard">Leaderboard</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/technology">Tech</a></li>
      </ul>
      {gamertag ? (
        <div className="nav-user" ref={dropdownRef}>
          {coinBalance != null && (
            <span style={{ color: '#d4a017', fontSize: '13px', fontWeight: 600, marginRight: '8px' }}>
              {'\u{1FA99}'} {coinBalance}
            </span>
          )}
          <button
            className="nav-gamertag"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {gamertag}
          </button>
          {dropdownOpen && (
            <div className="nav-dropdown">
              <button className="nav-dropdown-item" onClick={handleLogoff}>
                Log off
              </button>
            </div>
          )}
        </div>
      ) : (
        <a href="/" className="nav-gamertag">Sign In</a>
      )}
    </nav>
  );
}
