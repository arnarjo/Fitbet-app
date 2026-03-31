import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase env variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Pairs to create markets for ──────────────────────────────
// Format: [teamA, teamB, title]
const BESTA_PAIRS: [string, string, string][] = [
  ['Breiðablik', 'KR',       'Breiðablik vs KR — hvort endar hærra?'],
  ['Breiðablik', 'Víkingur', 'Breiðablik vs Víkingur — hvort endar hærra?'],
  ['KR',         'Víkingur', 'KR vs Víkingur — hvort endar hærra?'],
  ['FH',         'Stjarnan', 'FH vs Stjarnan — hvort endar hærra?'],
  ['Breiðablik', 'Stjarnan', 'Breiðablik vs Stjarnan — hvort endar hærra?'],
  ['KR',         'FH',       'KR vs FH — hvort endar hærra?'],
  ['Fram',       'HK',       'Fram vs HK — hvort endar hærra?'],
  ['IBV',        'ÍA',       'IBV vs ÍA — hvort endar hærra?'],
];

const LENGJU_PAIRS: [string, string, string][] = [
  ['Keflavík',  'Þór',       'Keflavík vs Þór — hvort endar hærra?'],
  ['Grindavík', 'Haukar',    'Grindavík vs Haukar — hvort endar hærra?'],
  ['Keflavík',  'Grindavík', 'Keflavík vs Grindavík — hvort endar hærra?'],
];

async function getTeamNames(leagueName: string): Promise<string[]> {
  const { data } = await supabase
    .from('teams')
    .select('name')
    .eq('league_name', leagueName)
    .order('name');
  return (data ?? []).map((t: any) => t.name);
}

async function seedMarkets() {
  // Print actual team names so you can adjust the pairs above if needed
  console.log('\n📋 Teams in Besta deild karla:');
  const bestaTeams = await getTeamNames('Besta deild karla');
  bestaTeams.forEach(t => console.log(`  - ${t}`));

  console.log('\n📋 Teams in Lengjudeild karla:');
  const lengjuTeams = await getTeamNames('Lengjudeild karla');
  lengjuTeams.forEach(t => console.log(`  - ${t}`));

  console.log('\n');

  let created = 0;
  let skipped = 0;

  const markets = [
    ...BESTA_PAIRS.map(([a, b, title]) => ({
      title,
      league_name: 'Besta deild karla',
      market_type: 'yfir_neðar',
      available_teams: [a, b],
      season_year: 2026,
      status: 'open',
    })),
    ...LENGJU_PAIRS.map(([a, b, title]) => ({
      title,
      league_name: 'Lengjudeild karla',
      market_type: 'yfir_neðar',
      available_teams: [a, b],
      season_year: 2026,
      status: 'open',
    })),
  ];

  for (const market of markets) {
    // Skip if market with same title already exists
    const { data: existing } = await supabase
      .from('season_markets')
      .select('id')
      .eq('title', market.title)
      .single();

    if (existing) {
      console.log(`⏭  Skipping (already exists): ${market.title}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('season_markets').insert(market);

    if (error) {
      console.error(`❌ Error creating: ${market.title}`, error.message);
    } else {
      console.log(`✅ Created: ${market.title}`);
      created++;
    }
  }

  console.log(`\n✅ CREATED: ${created}`);
  console.log(`⏭  SKIPPED: ${skipped}`);
  console.log('\n💡 Tip: Adjust team names in the script to match exactly what was synced from the API (see list above)');
}

seedMarkets().catch(err => {
  console.error(err);
  process.exit(1);
});
