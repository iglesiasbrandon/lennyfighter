-- Indexes for common query patterns

-- NOTE: api_key column and this index are removed in 006_cleanup.sql
-- Authentication: every authenticated request looks up player by api_key
CREATE INDEX IF NOT EXISTS idx_players_api_key ON players(api_key);
