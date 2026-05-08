-- ============================================================
-- ACHIEVEMENT SYSTEM FIX
-- Run in Supabase SQL Editor
-- ============================================================

-- Helper RPC callable from the app (security definer bypasses RLS)
create or replace function award_achievement(p_user_id uuid, p_type text)
returns void as $$
begin
  insert into achievements (user_id, type)
  values (p_user_id, p_type)
  on conflict (user_id, type) do nothing;
end;
$$ language plpgsql security definer;

grant execute on function award_achievement(uuid, text) to authenticated;

-- ============================================================
-- Update settle_bet to award first_win and ten_wins
-- ============================================================
create or replace function settle_bet(p_bet_id uuid, p_match_result text)
returns void as $$
declare
  v_bet bets%rowtype;
  v_winner_id uuid;
  v_loser_id uuid;
  v_win_count integer;
begin
  select * into v_bet from bets where id = p_bet_id;

  if v_bet.challenger_prediction = p_match_result then
    v_winner_id := v_bet.challenger_id;
    v_loser_id  := v_bet.opponent_id;
  elsif v_bet.opponent_prediction = p_match_result then
    v_winner_id := v_bet.opponent_id;
    v_loser_id  := v_bet.challenger_id;
  else
    return; -- no winner if neither prediction matched
  end if;

  update bets
  set status = 'settled', winner_id = v_winner_id, loser_id = v_loser_id, settled_at = now()
  where id = p_bet_id;

  update profiles
  set total_points = total_points + 3, total_wins = total_wins + 1
  where id = v_winner_id
  returning total_wins into v_win_count;

  update profiles set total_losses = total_losses + 1
  where id = v_loser_id;

  insert into notifications (user_id, type, title, body, data) values
    (v_winner_id, 'bet_won',  'Þú vannst veðmál! 🏆', 'Til hamingju, spáin þín var rétt!',        jsonb_build_object('bet_id', p_bet_id)),
    (v_loser_id,  'bet_lost', 'Þú tapaðir veðmáli 😅', 'Tíminn er kominn til að klára áskorunina!', jsonb_build_object('bet_id', p_bet_id));

  -- Award achievements based on cumulative win count
  if v_win_count = 1 then
    insert into achievements (user_id, type) values (v_winner_id, 'first_win') on conflict do nothing;
  end if;
  if v_win_count >= 10 then
    insert into achievements (user_id, type) values (v_winner_id, 'ten_wins') on conflict do nothing;
  end if;
end;
$$ language plpgsql security definer;
