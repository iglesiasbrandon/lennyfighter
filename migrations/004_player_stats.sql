CREATE TABLE IF NOT EXISTS player_stats (
  gamertag TEXT PRIMARY KEY,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  win_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_fighter TEXT,
  last_match_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_player_stats_wins ON player_stats(wins DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_total ON player_stats(total_matches DESC);
