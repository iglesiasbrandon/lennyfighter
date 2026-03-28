-- Remove vestigial columns from removed auth/payment system

-- Drop api_key index (was used for API key auth, now gamertag-based)
DROP INDEX IF EXISTS idx_players_api_key;

-- Note: SQLite doesn't support DROP COLUMN directly in older versions.
-- Since D1 uses modern SQLite, we can use ALTER TABLE DROP COLUMN.
ALTER TABLE players DROP COLUMN api_key;

-- Drop unused level/xp columns (hardcoded to 1, never incremented)
ALTER TABLE players DROP COLUMN level;
ALTER TABLE players DROP COLUMN xp;
