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

    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*)
      `)
      .not('status', 'in', '("finished","FT","AET","PEN","cancelled")')
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
  }, [fetchMatches]);

  return { matches, loading, error, refetch: fetchMatches };
}