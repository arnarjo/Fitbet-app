import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchResult } from '../types/database';

export function useIncomingBets(userId: string) {
  const [bets, setBets] = useState<any[]>([]);
  const [outgoingBets, setOutgoingBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchIncomingBets() {
    if (!userId) {
      setBets([]);
      setOutgoingBets([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [incoming, outgoing] = await Promise.all([
      supabase
        .from('bets')
        .select(`
          *,
          challenger:profiles!challenger_id(*),
          match:matches(
            *,
            home_team:teams!home_team_id(*),
            away_team:teams!away_team_id(*)
          )
        `)
        .eq('opponent_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('bets')
        .select(`
          *,
          opponent:profiles!opponent_id(*),
          match:matches(
            *,
            home_team:teams!home_team_id(*),
            away_team:teams!away_team_id(*)
          )
        `)
        .eq('challenger_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    setBets(incoming.data || []);
    setOutgoingBets(outgoing.data || []);
    setLoading(false);
  }

  async function respondToBet(
    betId: string,
    status: 'accepted' | 'declined',
    prediction?: MatchResult,
  ) {
    const update: Record<string, unknown> = { status };
    if (status === 'accepted' && prediction) {
      update.opponent_prediction = prediction;
    }

    const { error } = await supabase
      .from('bets')
      .update(update)
      .eq('id', betId);

    if (error) return { error };

    await fetchIncomingBets();
    return { error: null };
  }

  useEffect(() => {
    fetchIncomingBets();
  }, [userId]);

  return {
    bets,
    outgoingBets,
    loading,
    refetch: fetchIncomingBets,
    respondToBet,
  };
}
