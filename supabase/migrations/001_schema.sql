-- ============================================================
-- FitBet – Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS & PROFILES
-- ============================================================

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  city text,
  strava_connected boolean default false,
  strava_access_token text,
  strava_refresh_token text,
  total_points integer default 0,
  total_wins integer default 0,
  total_losses integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- FRIENDS
-- ============================================================

create table friendships (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text check (status in ('pending','accepted','declined')) default 'pending',
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

alter table friendships enable row level security;
create policy "Users can see their own friendships" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "Users can create friend requests" on friendships
  for insert with check (auth.uid() = requester_id);
create policy "Addressee can update friendship status" on friendships
  for update using (auth.uid() = addressee_id);

-- ============================================================
-- LEAGUES (competitions between friends)
-- ============================================================

create table leagues (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text check (type in ('vinahópur','vinnustaður','annað')) default 'vinahópur',
  created_by uuid references profiles(id) on delete set null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table league_members (
  id uuid default uuid_generate_v4() primary key,
  league_id uuid references leagues(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  role text check (role in ('admin','member')) default 'member',
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

alter table leagues enable row level security;
alter table league_members enable row level security;
create policy "League members can view their league" on leagues
  for select using (
    exists (select 1 from league_members where league_id = leagues.id and user_id = auth.uid())
  );
create policy "Anyone can create a league" on leagues for insert with check (auth.uid() = created_by);
create policy "Members can see league membership" on league_members
  for select using (
    exists (select 1 from league_members lm where lm.league_id = league_members.league_id and lm.user_id = auth.uid())
  );

-- ============================================================
-- MATCHES (admin-managed, real teams only)
-- ============================================================

create table teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  short_name text,
  country text,
  league_name text,
  logo_url text
);

-- Seed real teams
insert into teams (name, short_name, country, league_name) values
  ('Arsenal', 'ARS', 'England', 'Premier League'),
  ('Chelsea', 'CHE', 'England', 'Premier League'),
  ('Manchester City', 'MCI', 'England', 'Premier League'),
  ('Liverpool', 'LIV', 'England', 'Premier League'),
  ('Manchester United', 'MUN', 'England', 'Premier League'),
  ('Tottenham Hotspur', 'TOT', 'England', 'Premier League'),
  ('Newcastle United', 'NEW', 'England', 'Premier League'),
  ('Aston Villa', 'AVL', 'England', 'Premier League'),
  ('Barcelona', 'BAR', 'Spain', 'Champions League'),
  ('Real Madrid', 'RMA', 'Spain', 'Champions League'),
  ('Bayern Munich', 'BAY', 'Germany', 'Champions League'),
  ('PSG', 'PSG', 'France', 'Champions League'),
  ('Inter Milan', 'INT', 'Italy', 'Champions League'),
  ('ÍA', 'ÍA', 'Iceland', 'Besta deild karla'),
  ('FH', 'FH', 'Iceland', 'Besta deild karla'),
  ('Valur', 'VAL', 'Iceland', 'Besta deild karla'),
  ('Breiðablik', 'BRE', 'Iceland', 'Besta deild karla'),
  ('KR', 'KR', 'Iceland', 'Besta deild karla'),
  ('Víkingur', 'VÍK', 'Iceland', 'Besta deild karla'),
  ('Selfoss', 'SEL', 'Iceland', 'Besta deild karla'),
  ('Grindavík', 'GRI', 'Iceland', 'Besta deild karla'),
  ('HK', 'HK', 'Iceland', 'Besta deild karla'),
  ('Þór', 'ÞÓR', 'Iceland', 'Besta deild karla'),
  ('Fjölnir', 'FJÖ', 'Iceland', 'Lengjudeild karla'),
  ('Afturelding', 'AFT', 'Iceland', 'Lengjudeild karla'),
  ('Leiknir', 'LEI', 'Iceland', 'Lengjudeild karla'),
  ('Throttur', 'THR', 'Iceland', '2. deild karla'),
  ('Keflavík', 'KEF', 'Iceland', '2. deild karla');

create table matches (
  id uuid default uuid_generate_v4() primary key,
  home_team_id uuid references teams(id) not null,
  away_team_id uuid references teams(id) not null,
  league_name text not null,
  kickoff_time timestamptz not null,
  status text check (status in ('upcoming','live','finished','cancelled')) default 'upcoming',
  home_score integer,
  away_score integer,
  result text check (result in ('home','draw','away')) ,
  added_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table matches enable row level security;
create policy "Matches are public" on matches for select using (true);
create policy "Only admins can insert matches" on matches
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and id in (
      select id from auth.users where raw_user_meta_data->>'role' = 'admin'
    ))
  );

-- ============================================================
-- BETS (Leikjaveðmál)
-- ============================================================

create table bets (
  id uuid default uuid_generate_v4() primary key,
  match_id uuid references matches(id) on delete cascade not null,
  challenger_id uuid references profiles(id) on delete cascade not null,
  opponent_id uuid references profiles(id) on delete cascade not null,
  challenger_prediction text check (challenger_prediction in ('home','draw','away')) not null,
  opponent_prediction text check (opponent_prediction in ('home','draw','away')),
  status text check (status in ('pending','accepted','declined','settled','cancelled')) default 'pending',
  winner_id uuid references profiles(id),
  loser_id uuid references profiles(id),
  league_id uuid references leagues(id),
  created_at timestamptz default now(),
  settled_at timestamptz
);

alter table bets enable row level security;
create policy "Bet participants can view their bets" on bets
  for select using (auth.uid() = challenger_id or auth.uid() = opponent_id);
create policy "Authenticated users can create bets" on bets
  for insert with check (auth.uid() = challenger_id);
create policy "Opponent can accept/decline" on bets
  for update using (auth.uid() = opponent_id or auth.uid() = challenger_id);

-- ============================================================
-- SEASON MARKETS (Tímabilsveðmál)
-- ============================================================

create table season_markets (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  league_name text not null,
  market_type text check (market_type in ('meistari','fellur','fer_upp','yfir_neðar')) not null,
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  available_teams uuid[],
  status text check (status in ('open','locked','settled')) default 'open',
  winning_team_id uuid references teams(id),
  season_year integer not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  settled_at timestamptz
);

create table season_bets (
  id uuid default uuid_generate_v4() primary key,
  market_id uuid references season_markets(id) on delete cascade not null,
  challenger_id uuid references profiles(id) on delete cascade not null,
  opponent_id uuid references profiles(id) on delete cascade not null,
  challenger_pick uuid references teams(id) not null,
  opponent_pick uuid references teams(id),
  status text check (status in ('pending','accepted','declined','settled')) default 'pending',
  winner_id uuid references profiles(id),
  loser_id uuid references profiles(id),
  league_id uuid references leagues(id),
  created_at timestamptz default now(),
  settled_at timestamptz
);

alter table season_markets enable row level security;
alter table season_bets enable row level security;
create policy "Season markets are public" on season_markets for select using (true);
create policy "Season bet participants can view" on season_bets
  for select using (auth.uid() = challenger_id or auth.uid() = opponent_id);
create policy "Authenticated users can create season bets" on season_bets
  for insert with check (auth.uid() = challenger_id);

-- ============================================================
-- FITNESS CHALLENGES
-- ============================================================

create table challenges (
  id uuid default uuid_generate_v4() primary key,
  bet_id uuid references bets(id),
  season_bet_id uuid references season_bets(id),
  loser_id uuid references profiles(id) on delete cascade not null,
  winner_id uuid references profiles(id) on delete cascade not null,
  exercise text check (exercise in ('hlaup','armbeygjur','hnébeygjur','burpees','hjólreiðar','planki')) not null,
  amount numeric not null,
  unit text not null, -- 'km', 'stk', 'mín'
  status text check (status in ('assigned','submitted','approved','rejected')) default 'assigned',
  strava_activity_id text,
  due_date timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table challenges enable row level security;
create policy "Challenge participants can view" on challenges
  for select using (auth.uid() = loser_id or auth.uid() = winner_id);
create policy "Challenge can be created" on challenges
  for insert with check (auth.uid() = winner_id);
create policy "Loser can submit proof" on challenges
  for update using (auth.uid() = loser_id or auth.uid() = winner_id);

-- ============================================================
-- CHALLENGE PROOFS
-- ============================================================

create table challenge_proofs (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references challenges(id) on delete cascade not null,
  submitted_by uuid references profiles(id) not null,
  proof_type text check (proof_type in ('photo','video','screenshot','strava')) not null,
  file_url text,
  strava_activity_url text,
  notes text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  reviewed_by uuid references profiles(id),
  created_at timestamptz default now()
);

alter table challenge_proofs enable row level security;
create policy "Proof participants can view" on challenge_proofs
  for select using (
    exists (
      select 1 from challenges c
      where c.id = challenge_proofs.challenge_id
      and (c.loser_id = auth.uid() or c.winner_id = auth.uid())
    )
  );
create policy "Loser can submit proof" on challenge_proofs
  for insert with check (auth.uid() = submitted_by);
create policy "Winner can approve/reject" on challenge_proofs
  for update using (auth.uid() = reviewed_by);

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================

create or replace view leaderboard as
select
  p.id,
  p.username,
  p.full_name,
  p.avatar_url,
  p.total_points,
  p.total_wins,
  p.total_losses,
  rank() over (order by p.total_points desc) as rank
from profiles p
order by p.total_points desc;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text check (type in (
    'bet_received','bet_accepted','bet_declined',
    'bet_won','bet_lost',
    'challenge_assigned','challenge_submitted','challenge_approved','challenge_rejected',
    'friend_request','friend_accepted'
  )) not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;
create policy "Users see own notifications" on notifications
  for select using (auth.uid() = user_id);
create policy "System can insert notifications" on notifications
  for insert with check (true);
create policy "Users can mark as read" on notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================

create table achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text check (type in (
    'first_win','ten_wins','first_challenge','challenge_10km',
    'challenge_100_pushups','five_streak','season_bet_win'
  )) not null,
  unlocked_at timestamptz default now(),
  unique(user_id, type)
);

alter table achievements enable row level security;
create policy "Achievements are public" on achievements for select using (true);

-- ============================================================
-- FUNCTIONS: settle bets and award points
-- ============================================================

create or replace function settle_bet(p_bet_id uuid, p_match_result text)
returns void as $$
declare
  v_bet bets%rowtype;
  v_winner_id uuid;
  v_loser_id uuid;
begin
  select * into v_bet from bets where id = p_bet_id;

  if v_bet.challenger_prediction = p_match_result then
    v_winner_id := v_bet.challenger_id;
    v_loser_id := v_bet.opponent_id;
  elsif v_bet.opponent_prediction = p_match_result then
    v_winner_id := v_bet.opponent_id;
    v_loser_id := v_bet.challenger_id;
  else
    return; -- no winner if predictions don't match result
  end if;

  update bets
  set status = 'settled', winner_id = v_winner_id, loser_id = v_loser_id, settled_at = now()
  where id = p_bet_id;

  update profiles set total_points = total_points + 3, total_wins = total_wins + 1
  where id = v_winner_id;

  update profiles set total_losses = total_losses + 1
  where id = v_loser_id;

  insert into notifications (user_id, type, title, body, data)
  values
    (v_winner_id, 'bet_won', 'Þú vannst veðmál! 🏆', 'Til hamingju, spáin þín var rétt!', jsonb_build_object('bet_id', p_bet_id)),
    (v_loser_id, 'bet_lost', 'Þú tapaðir veðmáli 😅', 'Tíminn er kominn til að klára áskorunina!', jsonb_build_object('bet_id', p_bet_id));
end;
$$ language plpgsql security definer;

-- ============================================================
-- STORAGE BUCKETS (run separately in Supabase dashboard)
-- ============================================================
-- Create bucket: challenge-proofs (public: false, max size: 50MB)
-- Create bucket: avatars (public: true, max size: 5MB)
