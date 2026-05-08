import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MatchResult } from '../types/database';

export function useIncomingBets(userId: string) {
  const [bets, setBets] = useState<any[]>([]);
  const [outgoingBets, setOutgoingBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchSeq = useRef(0);

  const fetchIncomingBets = useCallback(async () => {
    if (!userId) {
      setBets([]);
      setOutgoingBets([]);
      setLoading(false);
      return;
    }

    const seq = ++fetchSeq.current;
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

    if (seq !== fetchSeq.current) return;
    if (!incoming.error) setBets(incoming.data || []);
    if (!outgoing.error) setOutgoingBets(outgoing.data || []);
    setLoading(false);
  }, [userId]);

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

  async function cancelBet(betId: string) {
    const { error } = await supabase
      .from('bets')
      .update({ status: 'cancelled' })
      .eq('id', betId)
      .eq('challenger_id', userId)
      .eq('status', 'pending');

    if (error) return { error };
    await fetchIncomingBets();
    return { error: null };
  }

  useEffect(() => {
    if (!userId) return;
    fetchIncomingBets();

    const channel = supabase
      .channel(`incoming_bets_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `challenger_id=eq.${userId}`,
      }, () => fetchIncomingBets())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bets',
        filter: `opponent_id=eq.${userId}`,
      }, () => fetchIncomingBets())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
      }, () => fetchIncomingBets())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchIncomingBets]);

  return {
    bets,
    outgoingBets,
    loading,
    refetch: fetchIncomingBets,
    respondToBet,
    cancelBet,
  };
}
