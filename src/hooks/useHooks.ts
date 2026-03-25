// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import type { Session } from '@supabase/supabase-js';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  async function signUp(email: string, password: string, username: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });
    return { error };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { session, profile, loading, signUp, signIn, signOut };
}


// ============================================================
// src/hooks/useMatches.ts
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

export function useMatches(leagueName?: string) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('matches')
      .select(`
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*)
      `)
      .in('status', ['upcoming', 'live'])
      .order('kickoff_time', { ascending: true });

    if (leagueName) query = query.eq('league_name', leagueName);

    const { data } = await query;
    setMatches((data as Match[]) ?? []);
    setLoading(false);
  }, [leagueName]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}


// ============================================================
// src/hooks/useBets.ts
// ============================================================
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Bet, MatchResult } from '../types/database';

export function useBets(userId: string) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchBets();

    // Realtime subscription
    const channel = supabase
      .channel('bets_changes')
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
    const { data } = await supabase
      .from('bets')
      .select(`
        *,
        match:matches(*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)),
        challenger:profiles!challenger_id(*),
        opponent:profiles!opponent_id(*)
      `)
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    setBets((data as Bet[]) ?? []);
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
    // 1. Create the bet
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        match_id: matchId,
        challenger_id: userId,
        opponent_id: opponentId,
        challenger_prediction: prediction,
        league_id: leagueId ?? null,
      })
      .select()
      .single();

    if (betError) return { error: betError };

    // 2. Notify opponent
    await supabase.from('notifications').insert({
      user_id: opponentId,
      type: 'bet_received',
      title: 'Nýtt veðmál! 🎯',
      body: `Þú fékkst veðmálsbeiðni. Áskorun: ${amount} ${unit} ${exercise}`,
      data: { bet_id: bet.id },
    });

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


// ============================================================
// src/hooks/useChallenges.ts
// ============================================================
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Challenge } from '../types/database';
import * as ImagePicker from 'expo-image-picker';

export function useChallenges(userId: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchChallenges();
  }, [userId]);

  async function fetchChallenges() {
    const { data } = await supabase
      .from('challenges')
      .select('*, loser:profiles!loser_id(*), winner:profiles!winner_id(*), proofs:challenge_proofs(*)')
      .or(`loser_id.eq.${userId},winner_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    setChallenges((data as Challenge[]) ?? []);
    setLoading(false);
  }

  async function submitPhotoProof(challengeId: string) {
    // Pick image from library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });

    if (result.canceled) return { error: 'cancelled' };

    const asset = result.assets[0];
    const fileExt = asset.uri.split('.').pop();
    const fileName = `${challengeId}_${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('challenge-proofs')
      .upload(fileName, blob, { contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('challenge-proofs')
      .getPublicUrl(fileName);

    // Insert proof record
    const { error } = await supabase.from('challenge_proofs').insert({
      challenge_id: challengeId,
      submitted_by: userId,
      proof_type: asset.type === 'video' ? 'video' : 'photo',
      file_url: publicUrl,
    });

    if (!error) {
      await supabase.from('challenges').update({ status: 'submitted' }).eq('id', challengeId);
      await fetchChallenges();
    }

    return { error };
  }

  async function approveProof(challengeId: string, proofId: string, approved: boolean) {
    const status = approved ? 'approved' : 'rejected';

    await supabase.from('challenge_proofs').update({ status, reviewed_by: userId }).eq('id', proofId);

    if (approved) {
      await supabase.from('challenges')
        .update({ status: 'approved', completed_at: new Date().toISOString() })
        .eq('id', challengeId);
    }

    await fetchChallenges();
  }

  return { challenges, loading, submitPhotoProof, approveProof };
}
