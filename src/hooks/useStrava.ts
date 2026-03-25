// src/hooks/useStrava.ts
// React hook for Strava integration
// Handles connect, disconnect, activity sync and auto-approval

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  connectStrava,
  disconnectStrava,
  getRecentActivities,
  tryAutoApproveChallenge,
  type StravaActivity,
} from '../lib/strava';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Challenge } from '../types/database';

export function useStrava() {
  const { profile, } = useAuth();
  const userId = profile?.id ?? '';

  const [connected, setConnected]     = useState(profile?.strava_connected ?? false);
  const [activities, setActivities]   = useState<StravaActivity[]>([]);
  const [syncing, setSyncing]         = useState(false);
  const [connecting, setConnecting]   = useState(false);

  useEffect(() => {
    setConnected(profile?.strava_connected ?? false);
  }, [profile?.strava_connected]);

  // ── Connect ──────────────────────────────────────────────
  async function connect() {
    if (!userId) return;
    setConnecting(true);

    const { error, tokens } = await connectStrava(userId);

    setConnecting(false);

    if (error === 'cancelled') return;

    if (error) {
      Alert.alert(
        'Strava villa',
        error === 'missing_scope'
          ? 'Vinsamlegast leyfðu FitBet að lesa æfingagögn til að Strava tenging virki.'
          : 'Ekki tókst að tengja Strava. Reyndu aftur.',
      );
      return;
    }

    setConnected(true);
    Alert.alert(
      'Strava tengt! ⚡',
      'Hlaup og hjólreiðar verða nú sjálfkrafa staðfest þegar þú klárar áskorun.',
    );

    // Immediately sync activities
    await syncActivities();
  }

  // ── Disconnect ───────────────────────────────────────────
  async function disconnect() {
    Alert.alert(
      'Aftengja Strava?',
      'Þú verður að senda sönnunarmyndir handvirkt eftir þetta.',
      [
        { text: 'Hætta við', style: 'cancel' },
        {
          text: 'Aftengja',
          onPress: async () => {
            await disconnectStrava(userId);
            setConnected(false);
            setActivities([]);
          },
        },
      ]
    );
  }

  // ── Sync activities ──────────────────────────────────────
  async function syncActivities() {
    if (!connected || !userId) return;
    setSyncing(true);
    const acts = await getRecentActivities(userId);
    setActivities(acts);
    setSyncing(false);
    return acts;
  }

  // ── Auto-approve open challenges ─────────────────────────
  /**
   * Check all open (assigned) challenges against Strava activities.
   * Auto-approves any that match. Returns count of auto-approved.
   */
  async function checkAndAutoApprove(): Promise<number> {
    if (!connected || !userId) return 0;

    const { data: openChallenges } = await supabase
      .from('challenges')
      .select('*')
      .eq('loser_id', userId)
      .eq('status', 'assigned')
      .in('exercise', ['hlaup', 'hjólreiðar']);

    if (!openChallenges || openChallenges.length === 0) return 0;

    let approved = 0;

    for (const ch of openChallenges as Challenge[]) {
      const wasApproved = await tryAutoApproveChallenge(
        userId,
        ch.id,
        ch.exercise,
        ch.amount,
        ch.unit,
        ch.created_at,
        ch.winner_id,
      );
      if (wasApproved) approved++;
    }

    return approved;
  }

  // ── Format activity for display ──────────────────────────
  function formatActivity(act: StravaActivity): string {
    const km    = (act.distance / 1000).toFixed(1);
    const mins  = Math.floor(act.moving_time / 60);
    const date  = new Date(act.start_date_local).toLocaleDateString('is-IS', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    const typeMap: Record<string, string> = {
      Run:        '🏃 Hlaup',
      VirtualRun: '🏃 Hlaup (Strava)',
      Ride:       '🚴 Hjólreiðar',
      VirtualRide:'🚴 Hjólreiðar (Strava)',
      EBikeRide:  '🚴 Rafhjól',
      Walk:       '🚶 Göngutúr',
      Hike:       '🥾 Gönguferð',
      Swim:       '🏊 Sund',
    };
    const label = typeMap[act.sport_type] ?? act.sport_type;
    return `${label} · ${km} km · ${mins} mín · ${date}`;
  }

  return {
    connected,
    connecting,
    syncing,
    activities,
    connect,
    disconnect,
    syncActivities,
    checkAndAutoApprove,
    formatActivity,
  };
}
