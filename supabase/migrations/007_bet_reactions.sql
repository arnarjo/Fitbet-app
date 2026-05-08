-- ============================================================
-- 007_bet_reactions.sql
-- Emoji reactions + trash talk á veðmál
-- ============================================================

create table if not exists bet_reactions (
  id         uuid default gen_random_uuid() primary key,
  bet_id     uuid references bets(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  emoji      text not null,
  message    text,
  created_at timestamptz default now(),
  unique(bet_id, user_id, emoji)
);

alter table bet_reactions enable row level security;
create policy "Users can see reactions on their bets"
  on bet_reactions for select using (
    exists (
      select 1 from bets
      where bets.id = bet_reactions.bet_id
        and (bets.challenger_id = auth.uid() or bets.opponent_id = auth.uid())
    )
  );
create policy "Users can react to their own bets"
  on bet_reactions for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from bets
      where bets.id = bet_reactions.bet_id
        and (bets.challenger_id = auth.uid() or bets.opponent_id = auth.uid())
    )
  );
create policy "Users can delete own reactions"
  on bet_reactions for delete using (auth.uid() = user_id);
