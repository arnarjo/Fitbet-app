import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function mergeDuplicate(name: string) {
  const { data } = await supabase.from('teams').select('id').eq('name', name);
  if (!data || data.length < 2) { console.log(`⏭  "${name}" — no duplicate`); return; }
  const keep = data[0].id;
  const del = data[1].id;
  await supabase.from('matches').update({ home_team_id: keep }).eq('home_team_id', del);
  await supabase.from('matches').update({ away_team_id: keep }).eq('away_team_id', del);
  const { error } = await supabase.from('teams').delete().eq('id', del);
  console.log(error ? `❌ ${name}: ${error.message}` : `✅ "${name}" duplicate removed`);
}

async function mergeInto(wrongName: string, correctName: string) {
  const { data: wrong } = await supabase.from('teams').select('id').eq('name', wrongName).single();
  const { data: correct } = await supabase.from('teams').select('id').eq('name', correctName).single();
  if (!wrong || !correct) { console.log(`⏭  "${wrongName}" → "${correctName}" — not found`); return; }
  await supabase.from('matches').update({ home_team_id: correct.id }).eq('home_team_id', wrong.id);
  await supabase.from('matches').update({ away_team_id: correct.id }).eq('away_team_id', wrong.id);
  const { error } = await supabase.from('teams').delete().eq('id', wrong.id);
  console.log(error ? `❌ ${wrongName}: ${error.message}` : `✅ "${wrongName}" merged into "${correctName}"`);
}

async function main() {
  console.log('🔧 Fixing remaining duplicates...\n');

  await mergeDuplicate('Afturelding');
  await mergeDuplicate('Manchester United');
  await mergeDuplicate('Aston Villa');
  await mergeInto('Leiknir R.', 'Leiknir');

  console.log('\n✅ Done');
}

main().catch(console.error);
