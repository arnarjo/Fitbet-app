import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

export function useMatches(leagueName?: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Hide matches that kicked off more than 3 hours ago but aren't marked finished yet
    // (sync may have run while the match was live; they'll disappear until next sync settles them)
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*)
      `)
      .not('status', 'in', '("finished","FT","AET","PEN","cancelled","live","1H","2H","HT","ET","BT","P","INT","SUSP","PST","CANC","ABD","AWD","WO")')
      .gt('kickoff_time', cutoff)
      .order('kickoff_time', { ascending: true });

    if (leagueName) {
      query = query.eq('league_name', leagueName);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError('Ekki tókst að sækja leiki. Athugaðu netsamband og reyndu aftur.');
      setMatches([]);
    } else {
      setMatches((data as Match[]) ?? []);
    }

    setLoading(false);
  }, [leagueName]);

  useEffect(() => {
    fetchMatches();

    // Realtime: refresh when any match status/score changes
    const channel = supabase
      .channel('matches_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
      }, () => fetchMatches())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchMatches]);

  return { matches, loading, error, refetch: fetchMatches };
}