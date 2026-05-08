-- supabase/migrations/008_fix_notification_triggers.sql
-- Fix: DB trigger functions now insert notification rows directly.
--
-- Background: send-push Edge Function previously inserted notification rows as a
-- side-effect. That was removed to eliminate duplicates (settle_bet RPC and the
-- frontend already inserted rows for bet_won/bet_lost and bet_received).
-- But bet_accepted, bet_declined, friend_request, friend_accepted,
-- challenge_submitted, challenge_approved, and challenge_rejected had NO other
-- insert path — they were broken. This migration adds the inserts into each
-- trigger function alongside the existing send_push_notification() call.

-- ── 1. notify_bet_accepted: inserts bet_accepted / bet_declined rows ─────────
CREATE OR REPLACE FUNCTION notify_bet_accepted()
RETURNS trigger AS $$
DECLARE
  v_opponent_name text;
  v_match_name    text;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT coalesce(full_name, username) INTO v_opponent_name
    FROM profiles WHERE id = NEW.opponent_id;

    SELECT
      coalesce(ht.short_name, ht.name) || ' vs ' || coalesce(at.short_name, at.name)
    INTO v_match_name
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE m.id = NEW.match_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.challenger_id,
      'bet_accepted',
      'Veðmál samþykkt! ✅',
      v_opponent_name || ' samþykkti veðmálið á ' || coalesce(v_match_name, 'leikinn'),
      jsonb_build_object('type', 'bet_accepted', 'bet_id', NEW.id)
    );

    PERFORM send_push_notification(
      NEW.challenger_id,
      'Veðmál samþykkt! ✅',
      v_opponent_name || ' samþykkti veðmálið á ' || coalesce(v_match_name, 'leikinn'),
      jsonb_build_object('type', 'bet_accepted', 'bet_id', NEW.id)
    );
  END IF;

  IF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    SELECT coalesce(full_name, username) INTO v_opponent_name
    FROM profiles WHERE id = NEW.opponent_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.challenger_id,
      'bet_declined',
      'Veðmáli hafnað',
      v_opponent_name || ' hafnaði veðmálsbeiðninni.',
      jsonb_build_object('type', 'bet_declined', 'bet_id', NEW.id)
    );

    PERFORM send_push_notification(
      NEW.challenger_id,
      'Veðmáli hafnað',
      v_opponent_name || ' hafnaði veðmálsbeiðninni.',
      jsonb_build_object('type', 'bet_declined', 'bet_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. notify_challenge_submitted: inserts challenge_submitted row ───────────
CREATE OR REPLACE FUNCTION notify_challenge_submitted()
RETURNS trigger AS $$
DECLARE
  v_loser_name text;
  v_winner_id  uuid;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status = 'assigned' THEN
    SELECT winner_id INTO v_winner_id FROM challenges WHERE id = NEW.id;
    SELECT coalesce(full_name, username) INTO v_loser_name
    FROM profiles WHERE id = NEW.loser_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_winner_id,
      'challenge_submitted',
      'Sönnun móttekin! 📸',
      v_loser_name || ' sendi sönnun. Farðu og staðfestu!',
      jsonb_build_object('type', 'challenge_submitted', 'challenge_id', NEW.id)
    );

    PERFORM send_push_notification(
      v_winner_id,
      'Sönnun móttekin! 📸',
      v_loser_name || ' sendi sönnun. Farðu og staðfestu!',
      jsonb_build_object('type', 'challenge_submitted', 'challenge_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. notify_proof_reviewed: inserts challenge_approved / challenge_rejected ─
CREATE OR REPLACE FUNCTION notify_proof_reviewed()
RETURNS trigger AS $$
DECLARE
  v_winner_name text;
  v_loser_id    uuid;
BEGIN
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'pending' THEN
    SELECT loser_id INTO v_loser_id FROM challenges WHERE id = NEW.challenge_id;
    SELECT coalesce(full_name, username) INTO v_winner_name
    FROM profiles WHERE id = NEW.reviewed_by;

    IF NEW.status = 'approved' THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_loser_id,
        'challenge_approved',
        'Sönnun samþykkt! 🎉',
        v_winner_name || ' samþykkti sönnunina. Vel gert!',
        jsonb_build_object('type', 'challenge_approved', 'challenge_id', NEW.challenge_id)
      );

      PERFORM send_push_notification(
        v_loser_id,
        'Sönnun samþykkt! 🎉',
        v_winner_name || ' samþykkti sönnunina. Vel gert!',
        jsonb_build_object('type', 'challenge_approved', 'challenge_id', NEW.challenge_id)
      );
    ELSE
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (
        v_loser_id,
        'challenge_rejected',
        'Sönnun hafnað 🔄',
        v_winner_name || ' hafnaði sönnuninni. Reyndu aftur.',
        jsonb_build_object('type', 'challenge_rejected', 'challenge_id', NEW.challenge_id)
      );

      PERFORM send_push_notification(
        v_loser_id,
        'Sönnun hafnað 🔄',
        v_winner_name || ' hafnaði sönnuninni. Reyndu aftur.',
        jsonb_build_object('type', 'challenge_rejected', 'challenge_id', NEW.challenge_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. notify_friend_request: inserts friend_request / friend_accepted rows ──
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS trigger AS $$
DECLARE
  v_requester_name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT coalesce(full_name, username) INTO v_requester_name
    FROM profiles WHERE id = NEW.requester_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.addressee_id,
      'friend_request',
      'Vinarbeiðni! 👋',
      v_requester_name || ' vill bæta þér við sem vin.',
      jsonb_build_object('type', 'friend_request', 'friendship_id', NEW.id)
    );

    PERFORM send_push_notification(
      NEW.addressee_id,
      'Vinarbeiðni! 👋',
      v_requester_name || ' vill bæta þér við sem vin.',
      jsonb_build_object('type', 'friend_request', 'friendship_id', NEW.id)
    );
  END IF;

  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT coalesce(full_name, username) INTO v_requester_name
    FROM profiles WHERE id = NEW.addressee_id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Vinarbeiðni samþykkt! 🤝',
      v_requester_name || ' er nú vinur þinn.',
      jsonb_build_object('type', 'friend_accepted', 'friendship_id', NEW.id)
    );

    PERFORM send_push_notification(
      NEW.requester_id,
      'Vinarbeiðni samþykkt! 🤝',
      v_requester_name || ' er nú vinur þinn.',
      jsonb_build_object('type', 'friend_accepted', 'friendship_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
