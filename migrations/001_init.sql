-- LennyFighter Database Schema
-- Manages player accounts

-- Player accounts
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  api_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);
