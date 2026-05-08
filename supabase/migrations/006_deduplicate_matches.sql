-- ============================================================
-- 006_deduplicate_matches.sql
-- Remove duplicate matches keeping the one with fd_match_id
-- (or the earliest created_at when neither has fd_match_id)
-- ============================================================

-- Delete duplicates: same home+away teams on same day, keep best row
DELETE FROM matches
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          home_team_id,
          away_team_id,
          DATE(kickoff_time)
        ORDER BY
          -- prefer rows that have fd_match_id
          (fd_match_id IS NOT NULL) DESC,
          created_at ASC
      ) AS rn
    FROM matches
  ) ranked
  WHERE rn > 1
);

-- Add missing teams that the API uses for Besta deild
-- KA Akureyri = KA in our system → update name to match API exactly via fd_team_id
-- (fd_team_id will be set by the sync function on next run, so we just ensure no duplicate team)
-- Ensure KA has its full name so resolveTeam can match it
UPDATE teams SET name = 'KA' WHERE name = 'KA Akureyri' AND league_name = 'Besta deild karla';

-- Add Fram Reykjavík (appears in API results but missing from original seed)
INSERT INTO teams (name, short_name, country, league_name)
VALUES ('Fram', 'FRA', 'Iceland', 'Besta deild karla')
ON CONFLICT DO NOTHING;

-- Add ÍBV (appears in API results)
INSERT INTO teams (name, short_name, country, league_name)
VALUES ('ÍBV', 'ÍBV', 'Iceland', 'Besta deild karla')
ON CONFLICT DO NOTHING;

-- Þór Akureyri — api sends "Thor" or "Þór Akureyri"
-- Our DB has 'Þór' — add alias via ensuring name is correct
UPDATE teams SET name = 'Þór' WHERE name IN ('Thor', 'Þór Akureyri') AND league_name = 'Besta deild karla';
