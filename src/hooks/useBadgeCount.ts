import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useBadgeCount(userId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) { setCount(0); return; }

    fetchCount();

    const betSub = supabase
      .channel('badge_bets_' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetchCount)
      .subscribe();

    const chSub = supabase
      .channel('badge_challenges_' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, fetchCount)
      .subscribe();

    return () => {
      supabase.removeChannel(betSub);
      supabase.removeChannel(chSub);
    };
  }, [userId]);

  async function fetchCount() {
    if (!userId) return;

    const [betsRes, loserRes, winnerRes] = await Promise.all([
      // Bets waiting for my response
      supabase.from('bets').select('id', { count: 'exact', head: true })
        .eq('opponent_id', userId).eq('status', 'pending'),
      // Challenges I need to complete
      supabase.from('challenges').select('id', { count: 'exact', head: true })
        .eq('loser_id', userId).eq('status', 'assigned'),
      // Proofs I need to review
      supabase.from('challenges').select('id', { count: 'exact', head: true })
        .eq('winner_id', userId).eq('status', 'submitted'),
    ]);

    const total = (betsRes.count ?? 0) + (loserRes.count ?? 0) + (winnerRes.count ?? 0);
    setCount(total);
  }

  return count;
}
