-- supabase/migrations/009_fix_push_config.sql
-- Fix: Supabase hosted projects do not allow ALTER DATABASE SET for custom params.
-- Replace current_setting() calls with hardcoded project URL and anon key.

CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb default '{}'::jsonb
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
