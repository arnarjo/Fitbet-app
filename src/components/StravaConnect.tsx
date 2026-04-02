// src/components/StravaConnect.tsx
// Drop-in component for Strava connect/disconnect UI
// Use in ProfileScreen or Settings

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native';
import { useStrava } from '../hooks/useStrava';

type Props = {
  onConnected?: () => void;
};

export default function StravaConnect({ onConnected }: Props) {
  const {
    connected, connecting, syncing,
    activities, connect, disconnect,
    syncActivities, formatActivity,
  } = useStrava();

  async function handleConnect() {
    await connect();
    onConnected?.();
  }

  return (
    <View style={s.container}>

      {/* Header row */}
      <View style={s.headerRow}>
        <View style={s.logoArea}>
          <View style={s.stravaLogo}>
            <Text style={s.stravaLogoText}>S</Text>
          </View>
          <View>
            <Text style={s.title}>Strava</Text>
            <Text style={s.sub}>
              {connected ? 'Tengt — æfingar staðfestar sjálfkrafa' : 'Tengdu til að staðfesta sjálfkrafa'}
            </Text>
          </View>
        </View>

        {connected ? (
          <TouchableOpacity style={s.disconnectBtn} onPress={disconnect}>
            <Text style={s.disconnectText}>Aftengja</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.connectBtn, connecting && s.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={connecting}
          >
            {connecting
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.connectText}>Tengja</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Connected state — show recent activities */}
      {connected && (
        <>
          <View style={s.divider} />

          <View style={s.syncRow}>
            <Text style={s.syncLabel}>Síðustu 7 dagar ({activities.length} æfingar)</Text>
            <TouchableOpacity onPress={syncActivities} disabled={syncing}>
              {syncing
                ? <ActivityIndicator color="#21A56A" size="small" />
                : <Text style={s.syncBtn}>↻ Uppfæra</Text>
              }
            </TouchableOpacity>
          </View>

          {activities.slice(0, 4).map(act => (
            <TouchableOpacity
              key={act.id}
              style={s.activityRow}
              onPress={() => Linking.openURL(`https://www.strava.com/activities/${act.id}`)}
            >
              <Text style={s.activityIcon}>
                {act.sport_type === 'Run' || act.sport_type === 'VirtualRun' ? '🏃'
                  : act.sport_type === 'Ride' || act.sport_type === 'VirtualRide' ? '🚴'
                  : act.sport_type === 'Walk' ? '🚶' : '⚡'}
              </Text>
              <View style={s.activityInfo}>
                <Text style={s.activityName} numberOfLines={1}>{act.name}</Text>
                <Text style={s.activityMeta}>
                  {(act.distance / 1000).toFixed(1)} km · {Math.floor(act.moving_time / 60)} mín
                </Text>
              </View>
              <Text style={s.activityDate}>
                {new Date(act.start_date_local).toLocaleDateString('is-IS', { day: 'numeric', month: 'short' })}
              </Text>
            </TouchableOpacity>
          ))}

          {activities.length === 0 && !syncing && (
            <View style={s.noActivities}>
              <Text style={s.noActivitiesText}>Engar æfingar fundust síðustu 7 daga</Text>
            </View>
          )}

          <View style={s.infoBox}>
            <Text style={s.infoText}>
              ⚡ Þegar þú klárar hlaup eða hjólreiðar á Strava, staðfestir FitBet áskorunina sjálfkrafa — engin mynd þarf.
            </Text>
          </View>
        </>
      )}

      {/* Disconnected — show benefits */}
      {!connected && (
        <View style={s.benefitsList}>
          {[
            'Hlaup staðfest sjálfkrafa ✓',
            'Hjólreiðar staðfestar sjálfkrafa ✓',
            'Engin sönnunarmynd þarf ✓',
            'Virkar með Apple Watch og Garmin ✓',
          ].map(b => (
            <View key={b} style={s.benefit}>
              <Text style={s.benefitText}>{b}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#0d2030',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  logoArea: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stravaLogo: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FC4C02',
    alignItems: 'center', justifyContent: 'center',
  },
  stravaLogoText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  title: { fontSize: 15, fontWeight: '800', color: '#eef4f8' },
  sub: { fontSize: 11, color: '#7a9aaa', marginTop: 2, maxWidth: 180 },
  connectBtn: {
    backgroundColor: '#21A56A', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, minWidth: 70, alignItems: 'center',
  },
  connectBtnDisabled: { opacity: 0.6 },
  connectText: { fontSize: 13, fontWeight: '800', color: '#000' },
  disconnectBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  disconnectText: { fontSize: 12, fontWeight: '700', color: '#7a9aaa' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  syncRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  syncLabel: { fontSize: 11, color: '#4a6878', fontWeight: '600' },
  syncBtn: { fontSize: 12, color: '#21A56A', fontWeight: '700' },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  activityIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  activityInfo: { flex: 1 },
  activityName: { fontSize: 13, fontWeight: '700', color: '#eef4f8' },
  activityMeta: { fontSize: 11, color: '#4a6878', marginTop: 2 },
  activityDate: { fontSize: 11, color: '#2a4050' },
  noActivities: { padding: 16, alignItems: 'center' },
  noActivitiesText: { fontSize: 13, color: '#4a6878' },
  infoBox: {
    margin: 12, padding: 12,
    backgroundColor: 'rgba(33,165,106,0.07)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(33,165,106,0.15)',
  },
  infoText: { fontSize: 12, color: '#7a9aaa', lineHeight: 18 },
  benefitsList: { padding: 14, gap: 0 },
  benefit: {
    paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  benefitText: { fontSize: 13, color: '#7a9aaa' },
});


// ── Supabase schema additions ────────────────────────────────
// Run this SQL in Supabase to add Strava fields to profiles:
/*
alter table profiles
  add column if not exists strava_athlete_id   bigint,
  add column if not exists strava_expires_at   bigint,
  add column if not exists strava_refresh_token text;

-- Index for quick token lookup
create index if not exists idx_profiles_strava
  on profiles(strava_connected) where strava_connected = true;
*/
