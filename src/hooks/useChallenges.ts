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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
    });

    if (result.canceled) return { error: 'cancelled' };

    const asset = result.assets[0];
    const fileExt = asset.uri.split('.').pop();
    const fileName = `${challengeId}_${Date.now()}.${fileExt}`;

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from('challenge-proofs')
      .upload(fileName, blob, { contentType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg' });

    if (uploadError) return { error: uploadError };

    const { data: urlData } = supabase.storage
      .from('challenge-proofs')
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { error: new Error('Ekki tókst að fá slóð á skrána. Reyndu aftur.') };
    }

    const { error } = await supabase.from('challenge_proofs').insert({
      challenge_id: challengeId,
      submitted_by: userId,
      proof_type: asset.type === 'video' ? 'video' : 'photo',
      file_url: urlData.publicUrl,
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