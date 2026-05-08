-- 011_admin_and_premium.sql
-- Add is_admin and premium columns to profiles

alter table profiles
  add column if not exists is_admin boolean default false,
  add column if not exists is_premium boolean default false,
  add column if not exists premium_expires_at timestamptz;

-- Set yourself as admin (replace with your actual user ID from Supabase Auth dashboard)
-- update profiles set is_admin = true where id = 'YOUR_USER_ID_HERE';
