-- supabase/migrations/013_five_streak.sql
--
-- 1. Add win_streak column to profiles
-- 2. Update settle_bet to track streak and award five_streak achievement
-- 3. Update exercise CHECK constraint to allow new premium exercises

-- ── 1. win_streak column ─────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS win_streak INT NOT NULL DEFAULT 0;

-- ── 2. settle_bet — track streak + award five_streak ────────────────────────
CREATE OR REPLACE FUNCTION settle_bet(p_bet_id uuid, p_match_result text)
RETURNS void AS $$
DECLARE
  v_bet        bets%rowtype;
  v_winner_id  uuid;
  v_loser_id   uuid;
  v_win_count  integer;
  v_streak     integer;
BEGIN
  SELECT * INTO v_bet FROM bets WHERE id = p_bet_id;

  IF v_bet.challenger_prediction = p_match_result THEN
    v_winner_id := v_bet.challenger_id;
    v_loser_id  := v_bet.opponent_id;
  ELSIF v_bet.opponent_prediction = p_match_result THEN
    v_winner_id := v_bet.opponent_id;
    v_loser_id  := v_bet.challenger_id;
  ELSE
    RETURN; -- draw or no prediction matched
  END IF;

  UPDATE bets
  SET status = 'settled', winner_id = v_winner_id, loser_id = v_loser_id, settled_at = now()
  WHERE id = p_bet_id;

  -- Update winner: points, wins, streak
  UPDATE profiles
  SET
    total_points = total_points + 3,
    total_wins   = total_wins + 1,
    win_streak   = win_streak + 1
  WHERE id = v_winner_id
  RETURNING total_wins, win_streak INTO v_win_count, v_streak;

  -- Reset loser streak
  UPDATE profiles SET win_streak = 0, total_losses = total_losses + 1
  WHERE id = v_loser_id;

  -- Notifications
  INSERT INTO notifications (user_id, type, title, body, data) VALUES
    (v_winner_id, 'bet_won',  'Þú vannst veðmál! 🏆', 'Til hamingju, spáin þín var rétt!',        jsonb_build_object('bet_id', p_bet_id)),
    (v_loser_id,  'bet_lost', 'Þú tapaðir veðmáli 😅', 'Tíminn er kominn til að klára áskorunina!', jsonb_build_object('bet_id', p_bet_id));

  -- first_win achievement
  IF v_win_count = 1 THEN
    INSERT INTO achievements (user_id, type) VALUES (v_winner_id, 'first_win') ON CONFLICT DO NOTHING;
  END IF;

  -- ten_wins achievement
  IF v_win_count >= 10 THEN
    INSERT INTO achievements (user_id, type) VALUES (v_winner_id, 'ten_wins') ON CONFLICT DO NOTHING;
  END IF;

  -- five_streak achievement
  IF v_streak >= 5 THEN
    INSERT INTO achievements (user_id, type) VALUES (v_winner_id, 'five_streak') ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Update exercise CHECK constraints ─────────────────────────────────────
-- Bets table
ALTER TABLE bets
  DROP CONSTRAINT IF EXISTS bets_exercise_check;

ALTER TABLE bets
  ADD CONSTRAINT bets_exercise_check CHECK (exercise IN (
    'hlaup','armbeygjur','hnébeygjur','burpees','hjólreiðar','planki',
    'sund','gongutur','situps','pullups','hiit','dips','mountain_climbers','interval_run'
  ));

-- Challenges table — drop ALL exercise-related check constraints including the
-- original auto-named inline constraint from migration 001, then add one clean constraint.
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'challenges'::regclass AND contype = 'c' AND conname LIKE '%exercise%'
  LOOP
    EXECUTE 'ALTER TABLE challenges DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

ALTER TABLE challenges
  ADD CONSTRAINT challenges_exercise_check CHECK (exercise IN (
    'hlaup','armbeygjur','hnébeygjur','burpees','hjólreiðar','planki',
    'sund','gongutur','situps','pullups','hiit','dips','mountain_climbers','interval_run'
  ));
