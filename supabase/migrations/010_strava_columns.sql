-- 010_strava_columns.sql
-- Add missing Strava columns to profiles table

alter table profiles
  add column if not exists strava_expires_at bigint,
  add column if not exists strava_athlete_id bigint;
