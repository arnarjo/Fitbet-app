-- supabase/migrations/015_fix_admin_rls.sql
--
-- Fix broken admin RLS policy on matches table.
-- Original policy checked raw_user_meta_data->>'role' which is never set.
-- Correct check is profiles.is_admin = true (added in migration 011).

DROP POLICY IF EXISTS "Only admins can insert matches" ON matches;

CREATE POLICY "Only admins can insert matches" ON matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Also fix update/delete policies if they don't exist
DROP POLICY IF EXISTS "Only admins can update matches" ON matches;
CREATE POLICY "Only admins can update matches" ON matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
