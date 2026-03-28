CREATE TABLE IF NOT EXISTS player_items (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);
CREATE INDEX IF NOT EXISTS idx_player_items_player ON player_items(player_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_items_unique ON player_items(player_id, item_id);
