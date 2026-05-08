-- ============================================================
-- SEASON BETS FIX
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add missing UPDATE policies (accept/decline and admin settle)
create policy "Participants can update season bets" on season_bets
  for update using (auth.uid() = challenger_id or auth.uid() = opponent_id);

create policy "Admin can update season bets" on season_bets
  for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admin can update season markets" on season_markets
  for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- 2. Add exercise/amount/unit columns that submitBet inserts
alter table season_bets
  add column if not exists exercise text,
  add column if not exists amount   integer,
  add column if not exists unit     text;

-- 3. Helper RPCs for incrementing profile stats (called from app when settling season bets)
create or replace function increment_wins(p_user_id uuid)
returns void as $$
begin
  update profiles set total_wins = total_wins + 1, total_points = total_points + 3
  where id = p_user_id;
end;
$$ language plpgsql security definer;

create or replace function increment_losses(p_user_id uuid)
returns void as $$
begin
  update profiles set total_losses = total_losses + 1
  where id = p_user_id;
end;
$$ language plpgsql security definer;

grant execute on function increment_wins(uuid)   to authenticated;
grant execute on function increment_losses(uuid) to authenticated;
