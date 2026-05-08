import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Bet, MatchResult } from '../types/database';

export function useBets(userId: string) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchBets();

    const channel = supabase
      .channel(`bets_changes_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `challenger_id=eq.${userId}`,
      }, () => fetchBets())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `opponent_id=eq.${userId}`,
      }, () => fetchBets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function fetchBets() {
    const { data, error } = await supabase
      .from('bets')
      .select(`
        *,
        match:matches(*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)),
        challenger:profiles!challenger_id(*),
        opponent:profiles!opponent_id(*)
      `)
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!error) setBets((data as Bet[]) ?? []);
    setLoading(false);
  }

async function createBet(
  matchId: string,
  opponentId: string,
  prediction: MatchResult,
  exercise: string,
  amount: number,
  unit: string,
  leagueId?: string
) {
  const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        match_id: matchId,
        challenger_id: userId,
        opponent_id: opponentId,
        challenger_prediction: prediction,
        league_id: leagueId ?? null,
        exercise,
        amount,
        unit,
      })
      .select()
      .single();

    if (betError) {
      return { error: betError };
    }

    await fetchBets();
    return { bet, error: null };
  }

  async function respondToBet(betId: string, prediction: MatchResult, accepted: boolean) {
    const status = accepted ? 'accepted' : 'declined';
    const { error } = await supabase
      .from('bets')
      .update({ status, opponent_prediction: accepted ? prediction : null })
      .eq('id', betId);

    if (!error) await fetchBets();
    return { error };
  }

  return { bets, loading, createBet, respondToBet };
}