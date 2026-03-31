// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Alert, Switch, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Achievement } from '../types/database';

type AchievementDef = {
  type: string;
  emoji: string;
  title: string;
  desc: string;
  points: number;
};

const ALL_ACHIEVEMENTS: AchievementDef[] = [
  { type: 'first_win',          emoji: '🏆', title: 'Fyrsti sigur',        desc: 'Vann fyrsta veðmálið',             points: 1  },
  { type: 'ten_wins',           emoji: '🔟', title: '10 sigrar',           desc: 'Vann 10 veðmál',                   points: 10 },
  { type: 'first_challenge',    emoji: '💪', title: 'Fyrsta áskorun',      desc: 'Kláraðir fyrstu áskorunina',       points: 1  },
  { type: 'challenge_10km',     emoji: '🏃', title: '10 km hlaup',         desc: 'Hljóp 10 km í áskorun',           points: 1  },
  { type: 'challenge_100_pushups', emoji: '🔥', title: '100 armbeygjur',  desc: 'Kláraði 100 armbeygjur',           points: 1  },
  { type: 'five_streak',        emoji: '🔥', title: '5 sigrar í röð',      desc: 'Vann 5 veðmál í röð',             points: 5  },
  { type: 'season_bet_win',     emoji: '📅', title: 'Tímabilsspá',         desc: 'Vann tímabilsveðmál',              points: 1  },
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [recentBets, setRecentBets] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.id) return;
    fetchAchievements();
    fetchRecentBets();
    setStravaConnected(profile.strava_connected ?? false);
  }, [profile?.id]);

  async function fetchAchievements() {
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', profile!.id);
    setAchievements(data ?? []);
  }

  async function fetchRecentBets() {
    const { data } = await supabase
      .from('bets')
      .select('*, match:matches(*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*))')
      .or(`challenger_id.eq.${profile!.id},opponent_id.eq.${profile!.id}`)
      .eq('status', 'settled')
      .order('settled_at', { ascending: false })
      .limit(5);
    setRecentBets(data ?? []);
  }

  async function handleSignOut() {
    Alert.alert('Útskrá', 'Ertu viss um að þú viljir skrá þig út?', [
      { text: 'Hætta við', style: 'cancel' },
      { text: 'Útskrá', style: 'destructive', onPress: signOut },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Eyða reikningi',
      'Þetta eyðir reikningnum þínum og öllum gögnum að fullu. Þetta er óafturkræft.',
      [
        { text: 'Hætta við', style: 'cancel' },
        {
          text: 'Eyða', style: 'destructive',
          onPress: async () => {
            await supabase.from('profiles').delete().eq('id', profile!.id);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  async function handleStravaToggle() {
    if (stravaConnected) {
      Alert.alert('Aftengja Strava', 'Viltu aftengja Strava reikninginn?', [
        { text: 'Hætta við', style: 'cancel' },
        {
          text: 'Aftengja', onPress: async () => {
            await supabase.from('profiles').update({
              strava_connected: false, strava_access_token: null,
            }).eq('id', profile!.id);
            setStravaConnected(false);
          },
        },
      ]);
    } else {
      // Open Strava OAuth — in production use expo-web-browser + deep link
      Alert.alert('Tengja Strava', 'Opnar Strava til að heimila aðgang...', [
        { text: 'Hætta við', style: 'cancel' },
        { text: 'Halda áfram', onPress: () => Linking.openURL('https://www.strava.com/oauth/authorize') },
      ]);
    }
  }

  const wins    = profile?.total_wins   ?? 0;
  const losses  = profile?.total_losses ?? 0;
  const points  = profile?.total_points ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
  const unlockedTypes = achievements.map(a => a.type);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Profile header ── */}
        <View style={s.profileHeader}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {getInitials(profile?.full_name ?? profile?.username ?? 'MÉR')}
              </Text>
            </View>
            {stravaConnected && (
              <View style={s.stravaIndicator}>
                <Text style={{ fontSize: 10 }}>⚡</Text>
              </View>
            )}
          </View>
          <Text style={s.profileName}>{profile?.full_name ?? profile?.username}</Text>
          <Text style={s.profileHandle}>@{profile?.username}</Text>
          {profile?.city && <Text style={s.profileCity}>{profile.city}</Text>}
        </View>

        {/* ── Stats grid ── */}
        <View style={s.statsGrid}>
          <View style={[s.statBox, s.statBoxAccent]}>
            <Text style={[s.statNum, { color: '#00e5a0' }]}>{points}</Text>
            <Text style={s.statLbl}>Stig</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{wins}</Text>
            <Text style={s.statLbl}>Sigrar</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{losses}</Text>
            <Text style={s.statLbl}>Töp</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{winRate}<Text style={{ fontSize: 14 }}>%</Text></Text>
            <Text style={s.statLbl}>Hlutfall</Text>
          </View>
        </View>

        {/* ── Win rate bar ── */}
        <View style={s.section}>
          <View style={s.winRateRow}>
            <Text style={s.winRateLabel}>Sigrar</Text>
            <Text style={s.winRateLabel}>Töp</Text>
          </View>
          <View style={s.winRateBar}>
            <View style={[s.winRateFill, { flex: wins || 1 }]} />
            <View style={[s.winRateLoss, { flex: losses || 0 }]} />
          </View>
          <View style={s.winRateRow}>
            <Text style={[s.winRateNum, { color: '#00e5a0' }]}>{wins}</Text>
            <Text style={[s.winRateNum, { color: '#ff4a6e' }]}>{losses}</Text>
          </View>
        </View>

        {/* ── Achievements ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            Verðlaun ({unlockedTypes.length}/{ALL_ACHIEVEMENTS.length})
          </Text>
          <View style={s.achievementGrid}>
            {ALL_ACHIEVEMENTS.map(ach => {
              const unlocked = unlockedTypes.includes(ach.type);
              return (
                <View
                  key={ach.type}
                  style={[s.achievementCard, unlocked && s.achievementCardUnlocked]}
                >
                  <Text style={[s.achievementEmoji, !unlocked && s.locked]}>
                    {ach.emoji}
                  </Text>
                  <Text style={[s.achievementTitle, !unlocked && s.lockedText]}>
                    {ach.title}
                  </Text>
                  <Text style={s.achievementDesc} numberOfLines={2}>
                    {unlocked ? ach.desc : '?????'}
                  </Text>
                  {unlocked && (
                    <View style={s.unlockedBadge}>
                      <Text style={s.unlockedBadgeText}>✓</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Recent results ── */}
        {recentBets.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nýlegar niðurstöður</Text>
            <View style={s.recentCard}>
              {recentBets.map(bet => {
                const won = bet.winner_id === profile?.id;
                return (
                  <View key={bet.id} style={s.recentRow}>
                    <View style={[s.recentDot, { backgroundColor: won ? '#00e5a0' : '#ff4a6e' }]} />
                    <Text style={s.recentMatch} numberOfLines={1}>
                      {bet.match?.home_team?.short_name} vs {bet.match?.away_team?.short_name}
                    </Text>
                    <Text style={[s.recentResult, { color: won ? '#00e5a0' : '#ff4a6e' }]}>
                      {won ? '+3 stig' : '0 stig'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Settings ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Stillingar</Text>
          <View style={s.settingsCard}>
            <View style={s.settingRow}>
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>⚡</Text>
                <View>
                  <Text style={s.settingTitle}>Strava</Text>
                  <Text style={s.settingSub}>
                    {stravaConnected ? 'Tengt — hlaup staðfest sjálfkrafa' : 'Tengdu til að staðfesta sjálfkrafa'}
                  </Text>
                </View>
              </View>
              <Switch
                value={stravaConnected}
                onValueChange={handleStravaToggle}
                trackColor={{ false: '#22222f', true: 'rgba(0,229,160,0.3)' }}
                thumbColor={stravaConnected ? '#00e5a0' : '#5a5a72'}
              />
            </View>

            <View style={s.settingDivider} />

            <View style={s.settingRow}>
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>🔔</Text>
                <View>
                  <Text style={s.settingTitle}>Push tilkynningar</Text>
                  <Text style={s.settingSub}>Fáðu tilkynningar um veðmál og áskoranir</Text>
                </View>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: '#22222f', true: 'rgba(0,229,160,0.3)' }}
                thumbColor={notifEnabled ? '#00e5a0' : '#5a5a72'}
              />
            </View>

            <View style={s.settingDivider} />

            <TouchableOpacity
              style={s.settingRow}
              onPress={() => Linking.openURL('https://fitbet.is/privacy')}
            >
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>🔒</Text>
                <Text style={s.settingTitle}>Persónuverndarstefna</Text>
              </View>
              <Text style={s.settingArrow}>›</Text>
            </TouchableOpacity>

            <View style={s.settingDivider} />

            <TouchableOpacity
              style={s.settingRow}
              onPress={() => Linking.openURL('https://fitbet.is/terms')}
            >
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>📄</Text>
                <Text style={s.settingTitle}>Notkunarskilmálar</Text>
              </View>
              <Text style={s.settingArrow}>›</Text>
            </TouchableOpacity>

            <View style={s.settingDivider} />

            <TouchableOpacity
              style={s.settingRow}
              onPress={() => Linking.openURL('mailto:support@fitbet.is')}
            >
              <View style={s.settingLeft}>
                <Text style={s.settingIcon}>✉️</Text>
                <Text style={s.settingTitle}>Hafa samband</Text>
              </View>
              <Text style={s.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Admin ── */}
        {profile?.is_admin && (
          <View style={s.section}>
            <TouchableOpacity
              style={s.adminBtn}
              onPress={() => navigation.navigate('Admin')}
              activeOpacity={0.85}
            >
              <Text style={s.adminBtnIcon}>⚙</Text>
              <Text style={s.adminBtnText}>Admin — Stjórna leikjum</Text>
              <Text style={s.settingArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
            <Text style={s.signOutText}>Útskrá</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={s.deleteText}>Eyða reikningi</Text>
          </TouchableOpacity>
          <Text style={s.versionText}>FitBet v1.0.0 · is.fitbet.app</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingBottom: 24 },
  profileHeader: {
    alignItems: 'center', paddingTop: 16, paddingBottom: 20,
    backgroundColor: 'rgba(0,229,160,0.04)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,229,160,0.15)',
    borderWidth: 3, borderColor: 'rgba(0,229,160,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#00e5a0' },
  stravaIndicator: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#00e5a0',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0a0a0f',
  },
  profileName: { fontSize: 22, fontWeight: '800', color: '#f0f0f8', marginBottom: 4 },
  profileHandle: { fontSize: 13, color: '#9090aa', marginBottom: 2 },
  profileCity: { fontSize: 12, color: '#5a5a72' },
  statsGrid: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, marginBottom: 16,
  },
  statBox: {
    flex: 1, backgroundColor: '#1a1a24',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, alignItems: 'center',
  },
  statBoxAccent: { borderColor: 'rgba(0,229,160,0.2)' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#f0f0f8', lineHeight: 26 },
  statLbl: { fontSize: 9, color: '#5a5a72', fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#f0f0f8', marginBottom: 12 },
  winRateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  winRateLabel: { fontSize: 11, color: '#5a5a72', fontWeight: '600' },
  winRateNum: { fontSize: 13, fontWeight: '800' },
  winRateBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6, backgroundColor: '#22222f' },
  winRateFill: { backgroundColor: '#00e5a0' },
  winRateLoss: { backgroundColor: '#ff4a6e' },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievementCard: {
    width: '30%', backgroundColor: '#1a1a24',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, alignItems: 'center', gap: 4, position: 'relative',
    minHeight: 90,
  },
  achievementCardUnlocked: { borderColor: 'rgba(0,229,160,0.25)', backgroundColor: 'rgba(0,229,160,0.04)' },
  achievementEmoji: { fontSize: 26 },
  achievementTitle: { fontSize: 10, fontWeight: '800', color: '#f0f0f8', textAlign: 'center' },
  achievementDesc: { fontSize: 9, color: '#5a5a72', textAlign: 'center', lineHeight: 13 },
  locked: { opacity: 0.3 },
  lockedText: { color: '#5a5a72' },
  unlockedBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#00e5a0',
    alignItems: 'center', justifyContent: 'center',
  },
  unlockedBadgeText: { fontSize: 9, fontWeight: '800', color: '#000' },
  recentCard: {
    backgroundColor: '#1a1a24', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  recentDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  recentMatch: { flex: 1, fontSize: 13, fontWeight: '600', color: '#f0f0f8' },
  recentResult: { fontSize: 12, fontWeight: '800' },
  settingsCard: {
    backgroundColor: '#1a1a24', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#f0f0f8' },
  settingSub: { fontSize: 11, color: '#5a5a72', marginTop: 1 },
  settingArrow: { fontSize: 20, color: '#3a3a52' },
  settingDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(0,229,160,0.06)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,229,160,0.2)',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  adminBtnIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  adminBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#00e5a0' },
  signOutBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#f0f0f8' },
  deleteBtn: {
    backgroundColor: 'rgba(255,74,110,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,74,110,0.2)',
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  deleteText: { fontSize: 15, fontWeight: '700', color: '#ff4a6e' },
  versionText: { fontSize: 11, color: '#3a3a52', textAlign: 'center' },
});
