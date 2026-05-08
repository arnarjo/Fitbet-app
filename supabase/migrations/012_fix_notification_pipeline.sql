-- supabase/migrations/012_fix_notification_pipeline.sql
--
-- Comprehensive fix for the push notification pipeline:
--
-- 1. Enable pg_net extension (required for net.http_post)
-- 2. Re-create send_push_notification with hardcoded project URL/key
--    (fixes cases where migration 009 was not applied)
-- 3. Fix notify_bet_received to also insert into notifications table
--    (migration 008 fixed all other triggers but missed this one)
-- 4. Add challenge_reminder to notifications.type CHECK constraint

-- ── 1. pg_net extension ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── 2. send_push_notification — hardcoded project URL/key ─────────────────────
-- This replaces the broken version from migration 002 that used current_setting()
-- which silently failed when app.supabase_url / app.supabase_anon_key were not set.
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://nzxdnwovvyjbzxrsgfaa.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eGRud292dnlqYnp4cnNnZmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDY3NTQsImV4cCI6MjA4OTU4Mjc1NH0.3R-kAku7xjHQLuA5Ie6DrolC33vw0hbCSs3exJsMJDk'
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id,
      'title',   p_title,
      'body',    p_body,
      'data',    p_data
    )
  );
EXCEPTION WHEN others THEN
  RAISE WARNING 'Push notification failed for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. notify_bet_received — add notifications table insert ───────────────────
-- Migration 008 fixed bet_accepted, bet_declined, challenge_*, and friend_*
-- but missed bet_received. The DB trigger only sent a push; the frontend
-- inserted the notification row. This makes it consistent with all other triggers.
CREATE OR REPLACE FUNCTION notify_bet_received()
RETURNS trigger AS $$
DECLARE
  v_challenger_name text;
BEGIN
  SELECT coalesce(full_name, username) INTO v_challenger_name
  FROM profiles WHERE id = NEW.challenger_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.opponent_id,
    'bet_received',
    'Nýtt veðmál! 🎯',
    v_challenger_name || ' boðar þig í veðmál. Samþykkt eða hafna?',
    jsonb_build_object('type', 'bet_received', 'bet_id', NEW.id)
  );

  PERFORM send_push_notification(
    NEW.opponent_id,
    'Nýtt veðmál! 🎯',
    v_challenger_name || ' boðar þig í veðmál. Samþykkt eða hafna?',
    jsonb_build_object('type', 'bet_received', 'bet_id', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Add challenge_reminder to the notifications type constraint ─────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'bet_received', 'bet_accepted', 'bet_declined',
    'bet_won', 'bet_lost',
    'challenge_assigned', 'challenge_submitted', 'challenge_approved', 'challenge_rejected',
    'challenge_reminder',
    'friend_request', 'friend_accepted'
  ));
