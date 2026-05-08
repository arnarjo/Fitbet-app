-- supabase/migrations/014_schedule_reminders.sql
--
-- Schedule challenge-reminders edge function daily at 09:00 via pg_cron.
-- Idempotent: unschedules existing job first so re-runs don't fail.

DO $$
BEGIN
  PERFORM cron.unschedule('challenge-reminders-daily');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet, ignore
END $$;

SELECT cron.schedule(
  'challenge-reminders-daily',
  '0 9 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nzxdnwovvyjbzxrsgfaa.supabase.co/functions/v1/challenge-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56eGRud292dnlqYnp4cnNnZmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDY3NTQsImV4cCI6MjA4OTU4Mjc1NH0.3R-kAku7xjHQLuA5Ie6DrolC33vw0hbCSs3exJsMJDk'
      ),
      body    := '{}'::jsonb
    );
  $$
);
