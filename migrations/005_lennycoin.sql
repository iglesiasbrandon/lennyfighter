-- Add LennyCoin balance to player stats
ALTER TABLE player_stats ADD COLUMN lennycoins INTEGER DEFAULT 0;
