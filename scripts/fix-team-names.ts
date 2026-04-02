import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Map of API duplicates → correct name to keep
// Format: 'wrong name': 'correct name'
const NAME_FIXES: Record<string, string> = {
  'KR Reykjavik':        'KR',
  'FH hafnarfjordur':    'FH',
  'Fram Reykjavik':      'Fram',
  'IA Akranes':          'ÍA',
  'IBV Vestmannaeyjar':  'IBV',
  'KA Akureyri':         'KA',
  'Valur Reykjavik':     'Valur',
  'Vikingur Reykjavik':  'Víkingur',
  'Thor Akureyri':       'Þór',
  'Keflavik':            'Keflavík',
  'Fjolnir':             'Fjölnir',
  'Grindavik':           'Grindavík',
  'Throttur Reykjavik':  'Þróttur',
  'Njardvik':            'Njarðvík',
};

async function fixTeamNames() {
  console.log('🔧 Fixing team name duplicates...\n');
  let fixed = 0;

  for (const [wrong, correct] of Object.entries(NAME_FIXES)) {
    // Check if the wrong name exists
    const { data: wrongTeam } = await supabase
      .from('teams')
      .select('id, name, league_name')
      .eq('name', wrong)
      .single();

    if (!wrongTeam) {
      console.log(`⏭  "${wrong}" not found — skipping`);
      continue;
    }

    // Check if the correct name also exists (real duplicate)
    const { data: correctTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('name', correct)
      .single();

    if (correctTeam) {
      // Both exist — delete the wrong one (update matches first to avoid FK issues)
      console.log(`🗑  Merging "${wrong}" → "${correct}"`);

      // Update matches that reference the wrong team
      await supabase.from('matches')
        .update({ home_team_id: correctTeam.id })
        .eq('home_team_id', wrongTeam.id);
      await supabase.from('matches')
        .update({ away_team_id: correctTeam.id })
        .eq('away_team_id', wrongTeam.id);

      // Delete the duplicate
      const { error } = await supabase.from('teams').delete().eq('id', wrongTeam.id);
      if (error) console.error(`  ❌ Error deleting: ${error.message}`);
      else { console.log(`  ✅ Deleted duplicate "${wrong}"`); fixed++; }
    } else {
      // Only wrong name exists — rename it
      console.log(`✏️  Renaming "${wrong}" → "${correct}"`);
      const { error } = await supabase.from('teams').update({ name: correct }).eq('id', wrongTeam.id);
      if (error) console.error(`  ❌ Error renaming: ${error.message}`);
      else { console.log(`  ✅ Renamed`); fixed++; }
    }
  }

  console.log(`\n✅ Done — ${fixed} teams fixed`);

  // Print final state
  console.log('\n📋 Final team list:');
  const { data: teams } = await supabase.from('teams').select('name, league_name').order('league_name').order('name');
  const byLeague: Record<string, string[]> = {};
  for (const t of (teams ?? []) as any[]) {
    if (!byLeague[t.league_name]) byLeague[t.league_name] = [];
    byLeague[t.league_name].push(t.name);
  }
  for (const [league, names] of Object.entries(byLeague)) {
    console.log(`\n  ${league}:`);
    names.forEach(n => console.log(`    - ${n}`));
  }
}

fixTeamNames().catch(err => { console.error(err); process.exit(1); });
