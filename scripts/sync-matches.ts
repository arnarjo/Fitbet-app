import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY!;
const FOOTBALL_API_BASE_URL = process.env.FOOTBALL_API_BASE_URL!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase env variables');
}

if (!FOOTBALL_API_KEY || !FOOTBALL_API_BASE_URL) {
  throw new Error('Missing Football API env variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const LEAGUES = [
  { id: 164, name: 'Besta deild karla',      season: 2026 },
  { id: 165, name: 'Lengjudeild karla',      season: 2026 },
  { id: 39,  name: 'Premier League',         season: 2025 },
  { id: 2,   name: 'UEFA Champions League',  season: 2025 },
];

type NormalizedMatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled';

function normalizeMatchStatus(apiStatus: string): NormalizedMatchStatus {
  if (['FT', 'AET', 'PEN'].includes(apiStatus)) return 'finished';
  if (['1H', '2H', 'HT', 'LIVE'].includes(apiStatus)) return 'live';
  if (['CANC', 'PST', 'ABD', 'AWD', 'WO'].includes(apiStatus)) return 'cancelled';
  return 'upcoming';
}

async function fetchMatches(leagueId: number, season: number) {
  const url = `${FOOTBALL_API_BASE_URL}/fixtures?league=${leagueId}&season=${season}`;

  const res = await fetch(url, {
    headers: {
      'x-apisports-key': FOOTBALL_API_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  console.log(`League ${leagueId}: ${json.results ?? 0} matches`);

  if (json.errors && Object.keys(json.errors).length > 0) {
    console.log(`League ${leagueId} API errors:`, json.errors);
  }

  return json.response ?? [];
}

async function upsertTeam(team: any, leagueName: string) {
  const externalId = String(team.id);

  const payload = {
    external_id: externalId,
    name: team.name ?? 'Unknown',
    short_name: team.name ?? null,
    country: 'Iceland',
    league_name: leagueName,
    logo_url: team.logo ?? null,
  };

  const { error: upsertError } = await supabase
    .from('teams')
    .upsert(payload, { onConflict: 'external_id' });

  if (upsertError) {
    throw new Error(`Teams upsert error: ${upsertError.message}`);
  }

  const { data, error: selectError } = await supabase
    .from('teams')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (selectError || !data) {
    throw new Error(
      `Could not fetch team id for ${team.name}: ${selectError?.message ?? 'No data'}`
    );
  }

  return data.id as string;
}

async function syncMatches() {
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const league of LEAGUES) {
    console.log(`\n--- Syncing ${league.name} (${league.id}) ---`);

    const fixtures = await fetchMatches(league.id, league.season);

    for (const item of fixtures) {
      try {
        const homeTeam = item.teams?.home;
        const awayTeam = item.teams?.away;

        if (!homeTeam?.id || !awayTeam?.id) {
          console.log('Skipping fixture with missing team ids:', item.fixture?.id);
          continue;
        }

        const homeTeamId = await upsertTeam(homeTeam, league.name);
        const awayTeamId = await upsertTeam(awayTeam, league.name);

        const apiStatus = item.fixture?.status?.short ?? 'NS';

        const row = {
          external_id: String(item.fixture.id),
          league_name: league.name,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff_time: item.fixture?.date ?? null,
          status: normalizeMatchStatus(apiStatus),
        };

        const { error } = await supabase
          .from('matches')
          .upsert(row, { onConflict: 'external_id' });

        if (error) {
          totalErrors += 1;
          console.error('MATCH INSERT ERROR:', error.message, row);
        } else {
          totalSuccess += 1;
        }
      } catch (err) {
        totalErrors += 1;
        console.error('Error syncing fixture:', item?.fixture?.id, err);
      }
    }
  }

  console.log(`\n✅ TOTAL MATCHES SYNCED: ${totalSuccess}`);
  console.log(`❌ TOTAL ERRORS: ${totalErrors}`);
}

syncMatches().catch((err) => {
  console.error(err);
  process.exit(1);
});