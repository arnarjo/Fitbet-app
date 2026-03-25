-- supabase/migrations/push_notification_triggers.sql
-- Run this in Supabase SQL Editor
-- Sets up automatic push notifications on key events

-- ── 1. Push tokens table ─────────────────────────────────────
create table if not exists push_tokens (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  token      text not null,
  platform   text check (platform in ('ios','android','web')) not null,
  active     boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, token)
);

alter table push_tokens enable row level security;
create policy "Users can manage own tokens" on push_tokens
  for all using (auth.uid() = user_id);

-- ── 2. Helper: call the Edge Function ────────────────────────
create or replace function send_push_notification(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb default '{}'::jsonb
)
returns void as $$
begin
  perform net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id,
      'title',   p_title,
      'body',    p_body,
      'data',    p_data
    )
  );
exception when others then
  -- Never fail silently — log but don't block the main transaction
  raise warning 'Push notification failed for user %: %', p_user_id, sqlerrm;
end;
$$ language plpgsql security definer;

-- ── 3. Trigger: new bet received ─────────────────────────────
create or replace function notify_bet_received()
returns trigger as $$
declare
  v_challenger_name text;
begin
  select coalesce(full_name, username) into v_challenger_name
  from profiles where id = NEW.challenger_id;

  perform send_push_notification(
    NEW.opponent_id,
    'Ný veðmálsbeiðni! 🎯',
    v_challenger_name || ' boðar þig í veðmál. Samþykkt eða hafna?',
    jsonb_build_object('type', 'bet_received', 'bet_id', NEW.id)
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_bet_created on bets;
create trigger on_bet_created
  after insert on bets
  for each row execute procedure notify_bet_received();

-- ── 4. Trigger: bet accepted ─────────────────────────────────
create or replace function notify_bet_accepted()
returns trigger as $$
declare
  v_opponent_name text;
  v_match_name    text;
begin
  if NEW.status = 'accepted' and OLD.status = 'pending' then
    select coalesce(full_name, username) into v_opponent_name
    from profiles where id = NEW.opponent_id;

    select
      coalesce(ht.short_name, ht.name) || ' vs ' || coalesce(at.short_name, at.name)
    into v_match_name
    from matches m
    join teams ht on ht.id = m.home_team_id
    join teams at on at.id = m.away_team_id
    where m.id = NEW.match_id;

    perform send_push_notification(
      NEW.challenger_id,
      'Veðmál samþykkt! ✅',
      v_opponent_name || ' samþykkti veðmálið á ' || coalesce(v_match_name, 'leikinn'),
      jsonb_build_object('type', 'bet_accepted', 'bet_id', NEW.id)
    );
  end if;

  if NEW.status = 'declined' and OLD.status = 'pending' then
    select coalesce(full_name, username) into v_opponent_name
    from profiles where id = NEW.opponent_id;

    perform send_push_notification(
      NEW.challenger_id,
      'Veðmáli hafnað',
      v_opponent_name || ' hafnaði veðmálsbeiðninni.',
      jsonb_build_object('type', 'bet_declined', 'bet_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_bet_updated on bets;
create trigger on_bet_updated
  after update on bets
  for each row execute procedure notify_bet_accepted();

-- ── 5. Trigger: bet settled (won/lost) ───────────────────────
create or replace function notify_bet_settled()
returns trigger as $$
declare
  v_winner_name text;
  v_loser_name  text;
  v_match_name  text;
begin
  if NEW.status = 'settled' and OLD.status != 'settled'
     and NEW.winner_id is not null and NEW.loser_id is not null then

    select coalesce(full_name, username) into v_winner_name from profiles where id = NEW.winner_id;
    select coalesce(full_name, username) into v_loser_name  from profiles where id = NEW.loser_id;

    select
      coalesce(ht.short_name, ht.name) || ' vs ' || coalesce(at.short_name, at.name)
    into v_match_name
    from matches m
    join teams ht on ht.id = m.home_team_id
    join teams at on at.id = m.away_team_id
    where m.id = NEW.match_id;

    -- Notify winner
    perform send_push_notification(
      NEW.winner_id,
      'Þú vannst! 🏆',
      'Spáin þín á ' || coalesce(v_match_name, 'leikinn') || ' var rétt. ' || v_loser_name || ' þarf nú að klára áskorunina!',
      jsonb_build_object('type', 'bet_won', 'bet_id', NEW.id)
    );

    -- Notify loser
    perform send_push_notification(
      NEW.loser_id,
      'Þú tapaðir 😅',
      v_winner_name || ' vann veðmálið. Tíminn er kominn til að klára áskorunina!',
      jsonb_build_object('type', 'bet_lost', 'bet_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_bet_settled on bets;
create trigger on_bet_settled
  after update on bets
  for each row execute procedure notify_bet_settled();

-- ── 6. Trigger: challenge proof submitted ────────────────────
create or replace function notify_challenge_submitted()
returns trigger as $$
declare
  v_loser_name  text;
  v_winner_id   uuid;
begin
  if NEW.status = 'submitted' and OLD.status = 'assigned' then
    select winner_id into v_winner_id from challenges where id = NEW.id;
    select coalesce(full_name, username) into v_loser_name
    from profiles where id = NEW.loser_id;

    perform send_push_notification(
      v_winner_id,
      'Sönnun móttekin! 📸',
      v_loser_name || ' sendi sönnun. Farðu og staðfestu!',
      jsonb_build_object('type', 'challenge_submitted', 'challenge_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_challenge_submitted on challenges;
create trigger on_challenge_submitted
  after update on challenges
  for each row execute procedure notify_challenge_submitted();

-- ── 7. Trigger: proof approved/rejected ─────────────────────
create or replace function notify_proof_reviewed()
returns trigger as $$
declare
  v_winner_name text;
  v_loser_id    uuid;
begin
  if NEW.status in ('approved','rejected') and OLD.status = 'pending' then
    select loser_id into v_loser_id from challenges where id = NEW.challenge_id;
    select coalesce(full_name, username) into v_winner_name
    from profiles where id = NEW.reviewed_by;

    if NEW.status = 'approved' then
      perform send_push_notification(
        v_loser_id,
        'Sönnun samþykkt! 🎉',
        v_winner_name || ' samþykkti sönnunina. Vel gert!',
        jsonb_build_object('type', 'challenge_approved', 'challenge_id', NEW.challenge_id)
      );
    else
      perform send_push_notification(
        v_loser_id,
        'Sönnun hafnað 🔄',
        v_winner_name || ' hafnaði sönnuninni. Reyndu aftur.',
        jsonb_build_object('type', 'challenge_rejected', 'challenge_id', NEW.challenge_id)
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_proof_reviewed on challenge_proofs;
create trigger on_proof_reviewed
  after update on challenge_proofs
  for each row execute procedure notify_proof_reviewed();

-- ── 8. Trigger: friend request ───────────────────────────────
create or replace function notify_friend_request()
returns trigger as $$
declare
  v_requester_name text;
begin
  if NEW.status = 'pending' then
    select coalesce(full_name, username) into v_requester_name
    from profiles where id = NEW.requester_id;

    perform send_push_notification(
      NEW.addressee_id,
      'Vinarbeiðni! 👋',
      v_requester_name || ' vill bæta þér við sem vin.',
      jsonb_build_object('type', 'friend_request', 'friendship_id', NEW.id)
    );
  end if;

  if NEW.status = 'accepted' and OLD.status = 'pending' then
    select coalesce(full_name, username) into v_requester_name
    from profiles where id = NEW.addressee_id;

    perform send_push_notification(
      NEW.requester_id,
      'Vinarbeiðni samþykkt! 🤝',
      v_requester_name || ' er nú vinur þinn.',
      jsonb_build_object('type', 'friend_accepted', 'friendship_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_friendship_changed on friendships;
create trigger on_friendship_changed
  after insert or update on friendships
  for each row execute procedure notify_friend_request();

-- ── 9. Set app config (replace with your values) ─────────────
-- alter database postgres set app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
-- alter database postgres set app.supabase_anon_key = 'YOUR_ANON_KEY';
