-- ============================================================
-- 005_team_fixes.sql
-- Fix team names, add missing teams, and add fd columns
-- ============================================================

-- Fix "Throttur" → "Þróttur" (correct Icelandic spelling)
UPDATE teams SET name = 'Þróttur', short_name = 'ÞRÓ' WHERE name = 'Throttur';

-- Add Stjörnan (Garðabær) to Besta deild karla 2026
INSERT INTO teams (name, short_name, country, league_name)
VALUES ('Stjörnan', 'STJ', 'Iceland', 'Besta deild karla')
ON CONFLICT DO NOTHING;

-- Add Víkingur Ólafsvík so the sync function can tell them apart from Víkingur (Rvk)
INSERT INTO teams (name, short_name, country, league_name)
VALUES ('Víkingur Ólafsvík', 'VÍO', 'Iceland', 'Lengjudeild karla')
ON CONFLICT DO NOTHING;

-- Add fd_team_id column to teams (API sports team ID for exact matching)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fd_team_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS teams_fd_team_id_key ON teams (fd_team_id) WHERE fd_team_id IS NOT NULL;

-- Add fd_match_id column to matches (API sports fixture ID to prevent duplicates)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS fd_match_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS matches_fd_match_id_key ON matches (fd_match_id) WHERE fd_match_id IS NOT NULL;
