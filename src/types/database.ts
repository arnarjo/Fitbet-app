// src/types/database.ts
// Auto-generate updated types with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID

export type Exercise =
  | 'hlaup' | 'armbeygjur' | 'hnébeygjur' | 'burpees' | 'hjólreiðar' | 'planki'
  | 'sund' | 'pullups' | 'hiit' | 'interval_run'
  | 'jump_rope' | 'box_jumps' | 'stairmaster' | 'rowing'
  // Legacy: kept for historical challenge data, not available for new bets
  | 'gongutur' | 'situps' | 'dips' | 'mountain_climbers';

export const PREMIUM_EXERCISES: Exercise[] = [
  'sund', 'pullups', 'hiit', 'interval_run',
  'jump_rope', 'box_jumps', 'stairmaster', 'rowing',
];

// Exercises available for new bets (excludes legacy removed exercises)
export const AVAILABLE_EXERCISES: Exercise[] = [
  'hlaup', 'armbeygjur', 'hnébeygjur', 'burpees', 'hjólreiðar', 'planki',
  'sund', 'pullups', 'hiit', 'interval_run',
  'jump_rope', 'box_jumps', 'stairmaster', 'rowing',
];

export type BetStatus = 'pending' | 'accepted' | 'declined' | 'settled' | 'cancelled';
export type MatchResult = 'home' | 'draw' | 'away';
export type MarketType = 'meistari' | 'fellur' | 'fer_upp' | 'yfir_neðar';
export type ChallengeStatus = 'assigned' | 'submitted' | 'approved' | 'rejected';
export type NotificationType =
  | 'bet_received' | 'bet_accepted' | 'bet_declined'
  | 'bet_won' | 'bet_lost'
  | 'challenge_assigned' | 'challenge_submitted'
  | 'challenge_approved' | 'challenge_rejected'
  | 'friend_request' | 'friend_accepted';

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  strava_connected: boolean;
  is_admin: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  total_points: number;
  total_wins: number;
  total_losses: number;
  win_streak: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  short_name: string | null;
  country: string | null;
  league_name: string | null;
  logo_url: string | null;
}

export type MatchStatus =
  | 'upcoming'
  | 'live'
  | 'finished'
  | 'cancelled'
  | 'FT'
  | 'AET'
  | 'PEN'
  | '1H'
  | '2H'
  | 'HT';

export interface Match {
  id: string;
  home_team_id: string;
  away_team_id: string;
  league_name: string;
  kickoff_time: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  result: MatchResult | null;
  home_team?: Team;
  away_team?: Team;
  created_at: string;
}

export interface Bet {
  id: string;
  match_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_prediction: MatchResult;
  opponent_prediction: MatchResult | null;
  status: BetStatus;
  winner_id: string | null;
  loser_id: string | null;
  league_id: string | null;
  exercise: string | null;
  amount: number | null;
  unit: string | null;
  match?: Match;
  challenger?: Profile;
  opponent?: Profile;
  challenge?: Challenge;
  created_at: string;
  settled_at: string | null;
}

export interface SeasonMarket {
  id: string;
  title: string;
  league_name: string;
  market_type: MarketType;
  team_a_id: string | null;
  team_b_id: string | null;
  available_teams: string[];
  status: 'open' | 'locked' | 'settled';
  winning_team_id: string | null;
  season_year: number;
  created_at: string;
}

export interface SeasonBet {
  id: string;
  market_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_pick: string;
  opponent_pick: string | null;
  status: BetStatus;
  winner_id: string | null;
  loser_id: string | null;
  amount: number | null;
  unit: string | null;
  exercise: string | null;
  market?: SeasonMarket;
  challenger?: Profile;
  opponent?: Profile;
  challenger_team?: Team;
  opponent_team?: Team;
  created_at: string;
}

export interface Challenge {
  id: string;
  bet_id: string | null;
  season_bet_id: string | null;
  loser_id: string;
  winner_id: string;
  exercise: Exercise;
  amount: number;
  unit: string;
  status: ChallengeStatus;
  strava_activity_id: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  loser?: Profile;
  winner?: Profile;
  proofs?: ChallengeProof[];
  bet?: {
    match?: {
      home_team: { name: string } | null;
      away_team: { name: string } | null;
    } | null;
  } | null;
}

export interface ChallengeProof {
  id: string;
  challenge_id: string;
  submitted_by: string;
  proof_type: 'photo' | 'video' | 'screenshot' | 'strava';
  file_url: string | null;
  strava_activity_url: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  type: 'vinahópur' | 'vinnustaður' | 'annað';
  created_by: string;
  invite_code: string;
  created_at: string;
  members?: LeagueMember[];
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  type: string;
  unlocked_at: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number;
  total_wins: number;
  total_losses: number;
  rank: number;
}

// Helper: label mappings for Icelandic UI
export const EXERCISE_LABELS: Record<Exercise, string> = {
  hlaup:             '🏃 Hlaup',
  armbeygjur:        '💪 Armbeygjur',
  hnébeygjur:        '🦵 Hnébeygjur',
  burpees:           '🔥 Burpees',
  hjólreiðar:        '🚴 Hjólreiðar',
  planki:            '🧱 Planki',
  sund:              '🏊 Sund',
  pullups:           '🏋️ Pull-ups',
  hiit:              '⚡ HIIT',
  interval_run:      '🏃 Interval run',
  jump_rope:         '🪢 Jump rope',
  box_jumps:         '🦘 Box jumps',
  stairmaster:       '🪜 Stairmaster',
  rowing:            '🚣 Rowing',
  // Legacy
  gongutur:          '🚶 Göngutúr',
  situps:            '🪑 Sit-ups',
  dips:              '💺 Dips',
  mountain_climbers: '🧗 Mountain Climbers',
};

export const EXERCISE_OPTIONS: Record<Exercise, { label: string; amounts: number[]; unit: string }> = {
  hlaup:             { label: 'Hlaup',           amounts: [3, 5, 10],          unit: 'km'  },
  armbeygjur:        { label: 'Armbeygjur',      amounts: [25, 50, 100],       unit: 'stk' },
  hnébeygjur:        { label: 'Hnébeygjur',      amounts: [50, 100, 200],      unit: 'stk' },
  burpees:           { label: 'Burpees',          amounts: [10, 25, 50],        unit: 'stk' },
  hjólreiðar:        { label: 'Hjólreiðar',      amounts: [10, 20, 50],        unit: 'km'  },
  planki:            { label: 'Planki',           amounts: [1, 3, 5],           unit: 'mín' },
  sund:              { label: 'Sund',             amounts: [1, 3, 5],           unit: 'km'  },
  pullups:           { label: 'Pull-ups',         amounts: [10, 25, 50],        unit: 'stk' },
  hiit:              { label: 'HIIT',             amounts: [20, 30, 45],        unit: 'mín' },
  interval_run:      { label: 'Interval run',     amounts: [3, 5, 10],          unit: 'km'  },
  jump_rope:         { label: 'Jump rope',        amounts: [5, 10, 20],         unit: 'mín' },
  box_jumps:         { label: 'Box jumps',        amounts: [20, 40, 60],        unit: 'stk' },
  stairmaster:       { label: 'Stairmaster',      amounts: [10, 20, 30],        unit: 'mín' },
  rowing:            { label: 'Rowing',           amounts: [2000, 5000, 10000], unit: 'm'   },
  // Legacy: not shown in new bet UI, kept for history display
  gongutur:          { label: 'Göngutúr',         amounts: [3, 5, 10],          unit: 'km'  },
  situps:            { label: 'Sit-ups',          amounts: [25, 50, 100],       unit: 'stk' },
  dips:              { label: 'Dips',             amounts: [10, 20, 50],        unit: 'stk' },
  mountain_climbers: { label: 'Mountain Climbers',amounts: [20, 50, 100],       unit: 'stk' },
};

export const LEAGUE_NAMES = [
  'Premier League',
  'UEFA Champions League',
  'FIFA World Cup',
  'Besta deild karla',
  'Lengjudeild karla',
  '2. deild karla',
];

export const PREDICTION_LABELS: Record<MatchResult, string> = {
  home: 'Heimalið vinnur',
  draw: 'Jafntefli',
  away: 'Útlið vinnur',
};

export const MARKET_TYPE_LABELS: Record<MarketType, string> = {
  meistari: '🏆 Meistari',
  fellur: '⬇ Fellur',
  fer_upp: '⬆ Fer upp',
  yfir_neðar: '⚔ Hvort lið endar ofar',
};
