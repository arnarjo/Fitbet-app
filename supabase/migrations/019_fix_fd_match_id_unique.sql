-- ============================================================
-- 019_fix_fd_match_id_unique.sql
-- Remove duplicate fd_match_id rows and add unique constraint
-- so that upsert onConflict:'fd_match_id' actually works.
-- ============================================================

-- Step 1: For each duplicate fd_match_id group, keep the best row:
--   • prefer finished (has result/scores) over upcoming
--   • prefer the row with bets attached
--   • otherwise keep earliest created_at
-- First, re-point any bets/season_bets to the keeper row so we don't orphan data.

DO $$
DECLARE
  dup RECORD;
  keeper_id uuid;
  loser_id  uuid;
BEGIN
  FOR dup IN
    SELECT fd_match_id
    FROM matches
    WHERE fd_match_id IS NOT NULL
    GROUP BY fd_match_id
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the best row to keep: finished first, then most bets, then oldest
    SELECT id INTO keeper_id
    FROM matches
    WHERE fd_match_id = dup.fd_match_id
    ORDER BY
      (status = 'finished')       DESC,
      (result IS NOT NULL)        DESC,
      (home_score IS NOT NULL)    DESC,
      (SELECT COUNT(*) FROM bets WHERE match_id = matches.id) DESC,
      created_at ASC
    LIMIT 1;

    -- Re-point bets on all other rows to keeper
    FOR loser_id IN
      SELECT id FROM matches
      WHERE fd_match_id = dup.fd_match_id AND id <> keeper_id
    LOOP
      UPDATE bets     SET match_id = keeper_id WHERE match_id = loser_id;
      UPDATE season_bets SET match_id = keeper_id WHERE match_id = loser_id;

      DELETE FROM matches WHERE id = loser_id;
    END LOOP;
  END LOOP;
END $$;

-- Step 2: Add a partial unique index so future upserts work correctly.
-- Partial (WHERE fd_match_id IS NOT NULL) because null fd_match_id means
-- manually-created match with no API counterpart yet — those are allowed to coexist.
CREATE UNIQUE INDEX IF NOT EXISTS matches_fd_match_id_unique
  ON matches (fd_match_id)
  WHERE fd_match_id IS NOT NULL;
