// src/screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import BetModal from '../components/BetModal';
import { useBets } from '../hooks/useBets';
import type { Match, MatchResult } from '../types/database';

// ── Types ────────────────────────────────────────────────────
type FeedItem = {
  id: string;
  type: 'bet_won' | 'bet_lost' | 'challenge_done' | 'challenge_assigned' | 'bet_created' | 'rematch';
  actor: string;
  actorInitials: string;
  avatarColor: string;
  message: string;
  highlight: string;
  highlightColor: string;
  time: string;
  canRematch?: boolean;
  betId?: string;
};

type QuickMatch = Match & { betCount?: number };

const AVATAR_COLORS = ['#00e5a0','#3d8bff','#ff4a6e','#ffc940','#a855f7','#ff9f40'];

// ── Component ────────────────────────────────────────────────
export default function HomeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { createBet } = useBets(profile?.id ?? '');

  const [feed, setFeed]               = useState<FeedItem[]>([]);
  const [upcomingMatches, setUpcoming]= useState<QuickMatch[]>([]);
  const [openChallenges, setOpenCh]   = useState(0);
  const [pendingBets, setPendingBets] = useState(0);
  const [refreshing, setRefreshing]   = useState(false);
  const [betModal, setBetModal]       = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPred, setSelectedPred]   = useState<MatchResult | null>(null);

  // Hero animation
  const heroAnim  = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const feedAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAll();
    Animated.stagger(120, [
      Animated.spring(heroAnim,  { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
      Animated.spring(statsAnim, { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
      Animated.spring(feedAnim,  { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
    ]).start();

    // Realtime feed subscription
    const channel = supabase
      .channel('home_feed')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, () => fetchFeed())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAll() {
    await Promise.all([fetchFeed(), fetchUpcoming(), fetchStats()]);
  }

  async function fetchFeed() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Also fetch friends' activity
    const { data: friendActivity } = await supabase
      .from('notifications')
      .select('*, profile:profiles!user_id(username, full_name)')
      .neq('user_id', profile.id)
      .in('type', ['bet_won','bet_lost','challenge_approved'])
      .order('created_at', { ascending: false })
      .limit(15);

    const allActivity = [
      ...(data ?? []).map((n: any, i: number) => buildFeedItem(n, true, i)),
      ...(friendActivity ?? []).map((n: any, i: number) => buildFeedItem(n, false, i + 20)),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);

    setFeed(allActivity);
  }

  function buildFeedItem(n: any, isMe: boolean, idx: number): FeedItem {
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const actor = isMe ? 'Þú' : (n.profile?.full_name ?? n.profile?.username ?? 'Vinur');
    const initials = actor === 'Þú'
      ? getInitials(profile?.full_name ?? profile?.username ?? 'MÉR')
      : getInitials(actor);

    const typeMap: Record<string, { msg: string; hl: string; hlColor: string }> = {
      bet_won:              { msg: 'vannst veðmál 🏆',              hl: 'vann',         hlColor: '#00e5a0' },
      bet_lost:             { msg: 'tapaðir veðmáli',               hl: 'tapaði',       hlColor: '#ff4a6e' },
      bet_received:         { msg: 'fékk veðmálsbeiðni',            hl: 'beiðni',       hlColor: '#ffc940' },
      bet_accepted:         { msg: 'samþykkti veðmál',              hl: 'samþykkt',     hlColor: '#3d8bff' },
      challenge_assigned:   { msg: 'tapaðir og þarft að klára áskorun', hl: 'áskorun', hlColor: '#ff4a6e' },
      challenge_submitted:  { msg: 'sendi sönnun',                  hl: 'sönnun',       hlColor: '#ffc940' },
      challenge_approved:   { msg: 'kláraði áskorun ✓',            hl: 'klárað',       hlColor: '#00e5a0' },
      challenge_rejected:   { msg: 'sönnun hafnað — reyndu aftur', hl: 'hafnað',       hlColor: '#9090aa' },
      friend_request:       { msg: 'sendi þér vinarbeiðni',         hl: 'beiðni',       hlColor: '#a855f7' },
      friend_accepted:      { msg: 'samþykkti vinarbeiðni',         hl: 'vinur',        hlColor: '#00e5a0' },
    };

    const cfg = typeMap[n.type] ?? { msg: n.body ?? '', hl: '', hlColor: '#9090aa' };
    return {
      id:             n.id,
      type:           n.type,
      actor,
      actorInitials:  initials,
      avatarColor:    color,
      message:        cfg.msg,
      highlight:      cfg.hl,
      highlightColor: cfg.hlColor,
      time:           n.created_at,
      canRematch:     n.type === 'bet_won' || n.type === 'bet_lost',
      betId:          n.data?.bet_id,
    };
  }

  async function fetchUpcoming() {
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('status', 'upcoming')
      .gte('kickoff_time', new Date().toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(8);
    setUpcoming((data ?? []) as QuickMatch[]);
  }

  async function fetchStats() {
    if (!profile?.id) return;
    const [ch, bets] = await Promise.all([
      supabase.from('challenges').select('id', { count:'exact', head:true }).eq('loser_id', profile.id).eq('status', 'assigned'),
      supabase.from('bets').select('id', { count:'exact', head:true }).eq('opponent_id', profile.id).eq('status', 'pending'),
    ]);
    setOpenCh(ch.count ?? 0);
    setPendingBets(bets.count ?? 0);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [profile?.id]);

  function openBet(match: Match, pred: MatchResult) {
    setSelectedMatch(match);
    setSelectedPred(pred);
    setBetModal(true);
  }

  async function handleRematch(betId: string) {
    // Navigate to the bet and offer rematch
    navigation.navigate('Veðmál');
  }

  // ── Render ───────────────────────────────────────────────
  const wins   = profile?.total_wins   ?? 0;
  const losses = profile?.total_losses ?? 0;
  const points = profile?.total_points ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const featuredMatch = upcomingMatches[0] ?? null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />}
        contentContainerStyle={s.scroll}
      >
        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <View>
            <Text style={s.greeting}>{getGreeting()}</Text>
            <Text style={s.userName}>{profile?.full_name ?? profile?.username ?? 'Leikmaður'}</Text>
          </View>
          <View style={s.topBarRight}>
            {(openChallenges > 0 || pendingBets > 0) && (
              <TouchableOpacity style={s.alertPill} onPress={() => navigation.navigate('Veðmál')}>
                <View style={s.alertDot} />
                <Text style={s.alertText}>
                  {openChallenges > 0 ? `${openChallenges} áskorun` : `${pendingBets} veðmál`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Prófíll')}>
              <View style={s.profileCircle}>
                <Text style={s.profileInitials}>
                  {getInitials(profile?.full_name ?? profile?.username ?? 'MÉR')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero featured match ── */}
        {featuredMatch && (
          <Animated.View style={[s.heroCard, {
            opacity: heroAnim,
            transform: [{ translateY: heroAnim.interpolate({ inputRange:[0,1], outputRange:[24,0] }) }],
          }]}>
            <View style={s.heroTop}>
              <View style={s.heroBadge}>
                <Text style={s.heroBadgeText}>{featuredMatch.league_name}</Text>
              </View>
              <Text style={s.heroTime}>{formatKickoff(featuredMatch.kickoff_time)}</Text>
            </View>
            <View style={s.heroTeams}>
              <View style={s.heroTeam}>
                <Text style={s.heroTeamName}>{featuredMatch.home_team?.name}</Text>
                <Text style={s.heroTeamSub}>Heimalið</Text>
              </View>
              <View style={s.heroVs}>
                <Text style={s.heroVsText}>VS</Text>
              </View>
              <View style={[s.heroTeam, { alignItems:'flex-end' }]}>
                <Text style={s.heroTeamName}>{featuredMatch.away_team?.name}</Text>
                <Text style={[s.heroTeamSub, { textAlign:'right' }]}>Útlið</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.heroBtn}
              onPress={() => openBet(featuredMatch, 'home')}
              activeOpacity={0.85}
            >
              <Text style={s.heroBtnText}>Veðja á þennan leik →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Stats row ── */}
        <Animated.View style={[s.statsRow, {
          opacity: statsAnim,
          transform: [{ translateY: statsAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }],
        }]}>
          <View style={[s.statBox, s.statBoxAccent]}>
            <Text style={[s.statNum, { color:'#00e5a0' }]}>{points}</Text>
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
            <Text style={s.statNum}>{winRate}<Text style={{ fontSize:14 }}>%</Text></Text>
            <Text style={s.statLbl}>Hlutfall</Text>
          </View>
        </Animated.View>

        {/* ── Alert banners ── */}
        {openChallenges > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('Veðmál')} activeOpacity={0.85}>
            <Text style={s.alertBannerIcon}>⚠️</Text>
            <View style={{ flex:1 }}>
              <Text style={s.alertBannerTitle}>{openChallenges} áskorun bíður!</Text>
              <Text style={s.alertBannerSub}>Smelltu til að klára og senda sönnun</Text>
            </View>
            <Text style={s.alertBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {pendingBets > 0 && (
          <TouchableOpacity style={[s.alertBanner, s.alertBannerBlue]} onPress={() => navigation.navigate('Veðmál')} activeOpacity={0.85}>
            <Text style={s.alertBannerIcon}>🎯</Text>
            <View style={{ flex:1 }}>
              <Text style={[s.alertBannerTitle, { color:'#3d8bff' }]}>{pendingBets} veðmál bíður svars!</Text>
              <Text style={s.alertBannerSub}>Vinur sendi þér veðmálsbeiðni</Text>
            </View>
            <Text style={s.alertBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick matches ── */}
        {upcomingMatches.length > 1 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Næstu leikir</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Leikir')}>
                <Text style={s.sectionLink}>Sjá alla →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickScroll} contentContainerStyle={s.quickContent}>
              {upcomingMatches.slice(1, 6).map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={s.quickCard}
                  onPress={() => openBet(m, 'home')}
                  activeOpacity={0.8}
                >
                  <Text style={s.quickLeague} numberOfLines={1}>{m.league_name}</Text>
                  <Text style={s.quickTeams} numberOfLines={2}>
                    {m.home_team?.short_name ?? m.home_team?.name}{'\n'}{m.away_team?.short_name ?? m.away_team?.name}
                  </Text>
                  <Text style={s.quickTime}>{formatKickoff(m.kickoff_time)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Activity feed ── */}
        <Animated.View style={[s.section, {
          opacity: feedAnim,
          transform: [{ translateY: feedAnim.interpolate({ inputRange:[0,1], outputRange:[16,0] }) }],
        }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Virknistraumur</Text>
            {feed.length > 0 && (
              <View style={s.liveIndicator}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Beint</Text>
              </View>
            )}
          </View>

          <View style={s.feedCard}>
            {feed.length === 0 ? (
              <View style={s.feedEmpty}>
                <Text style={s.feedEmptyIcon}>🏟</Text>
                <Text style={s.feedEmptyTitle}>Straumurinn er tómur</Text>
                <Text style={s.feedEmptySub}>Bíddu þar til vinir fara að veðja!</Text>
              </View>
            ) : (
              feed.map((item, idx) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  isLast={idx === feed.length - 1}
                  onRematch={() => handleRematch(item.betId ?? '')}
                />
              ))
            )}
          </View>
        </Animated.View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Bet modal */}
      <BetModal
        visible={betModal}
        match={selectedMatch}
        initialPrediction={selectedPred}
        currentUserId={profile?.id ?? ''}
        onClose={() => { setBetModal(false); setSelectedMatch(null); setSelectedPred(null); }}
        onSubmit={async (matchId, opponentId, prediction, exercise, amount, unit) =>
          createBet(matchId, opponentId, prediction, exercise, amount, unit)
        }
      />
    </SafeAreaView>
  );
}

// ── FeedRow sub-component ────────────────────────────────────
function FeedRow({ item, isLast, onRematch }: { item: FeedItem; isLast: boolean; onRematch: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, { toValue:1, useNativeDriver:true, damping:20, stiffness:180 }).start();
  }, []);

  return (
    <Animated.View style={[s.feedRow, isLast && s.feedRowLast, { opacity: fadeAnim }]}>
      {/* Avatar */}
      <View style={[s.feedAvatar, { backgroundColor: item.avatarColor + '22' }]}>
        <Text style={[s.feedAvatarText, { color: item.avatarColor }]}>{item.actorInitials}</Text>
      </View>

      {/* Content */}
      <View style={s.feedContent}>
        <Text style={s.feedText} numberOfLines={2}>
          <Text style={s.feedActor}>{item.actor} </Text>
          <Text style={s.feedMessage}>{item.message}</Text>
        </Text>
        <Text style={s.feedTime}>{formatRelativeTime(item.time)}</Text>
      </View>

      {/* Rematch button */}
      {item.canRematch && (
        <TouchableOpacity style={s.rematchBtn} onPress={onRematch} activeOpacity={0.75}>
          <Text style={s.rematchBtnText}>↺</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'Góða nótt,';
  if (h < 12) return 'Góðan daginn,';
  if (h < 18) return 'Góðan dag,';
  return 'Gott kvöld,';
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString('is-IS', { hour:'2-digit', minute:'2-digit' });
  if (isToday)    return `Í dag · ${time}`;
  if (isTomorrow) return `Á morgun · ${time}`;
  return d.toLocaleDateString('is-IS', { weekday:'short', day:'numeric', month:'short' }) + ` · ${time}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Rétt í þessu';
  if (mins < 60) return `${mins} mín síðan`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} klst síðan`;
  return `${Math.floor(hrs / 24)} d síðan`;
}

// ── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:'#0a0a0f' },
  scroll:     { paddingBottom: 24 },

  topBar: {
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingHorizontal:20, paddingTop:8, paddingBottom:14,
  },
  greeting:   { fontSize:12, color:'#5a5a72', fontWeight:'600' },
  userName:   { fontSize:22, fontWeight:'800', color:'#f0f0f8', marginTop:1 },
  topBarRight:{ flexDirection:'row', alignItems:'center', gap:10 },
  alertPill: {
    flexDirection:'row', alignItems:'center', gap:5,
    backgroundColor:'rgba(255,74,110,0.1)',
    borderWidth:1, borderColor:'rgba(255,74,110,0.2)',
    paddingHorizontal:10, paddingVertical:5, borderRadius:20,
  },
  alertDot:   { width:6, height:6, borderRadius:3, backgroundColor:'#ff4a6e' },
  alertText:  { fontSize:11, fontWeight:'700', color:'#ff4a6e' },
  profileCircle: {
    width:38, height:38, borderRadius:19,
    backgroundColor:'rgba(0,229,160,0.15)',
    borderWidth:2, borderColor:'rgba(0,229,160,0.3)',
    alignItems:'center', justifyContent:'center',
  },
  profileInitials: { fontSize:13, fontWeight:'800', color:'#00e5a0' },

  // Hero card
  heroCard: {
    marginHorizontal:16, marginBottom:16,
    backgroundColor:'#1a1a24',
    borderRadius:18,
    borderWidth:1, borderColor:'rgba(255,255,255,0.08)',
    padding:18,
    overflow:'hidden',
  },
  heroTop:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:14 },
  heroBadge: {
    backgroundColor:'rgba(0,229,160,0.12)',
    paddingHorizontal:10, paddingVertical:4, borderRadius:20,
  },
  heroBadgeText: { fontSize:10, fontWeight:'800', color:'#00e5a0', letterSpacing:0.5 },
  heroTime:   { fontSize:12, color:'#9090aa', fontWeight:'600' },
  heroTeams:  { flexDirection:'row', alignItems:'center', gap:12, marginBottom:16 },
  heroTeam:   { flex:1 },
  heroTeamName: { fontSize:18, fontWeight:'900', color:'#f0f0f8', lineHeight:22 },
  heroTeamSub:  { fontSize:11, color:'#5a5a72', marginTop:3 },
  heroVs: {
    width:40, height:40, borderRadius:20,
    backgroundColor:'#22222f', borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
    alignItems:'center', justifyContent:'center',
  },
  heroVsText: { fontSize:10, fontWeight:'900', color:'#5a5a72' },
  heroBtn: {
    backgroundColor:'#00e5a0', borderRadius:12,
    paddingVertical:12, alignItems:'center',
  },
  heroBtnText: { color:'#000', fontWeight:'800', fontSize:14, letterSpacing:0.2 },

  // Stats
  statsRow: {
    flexDirection:'row', gap:10,
    paddingHorizontal:16, marginBottom:14,
  },
  statBox: {
    flex:1, backgroundColor:'#1a1a24',
    borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    padding:12, alignItems:'center',
  },
  statBoxAccent: { borderColor:'rgba(0,229,160,0.2)' },
  statNum: { fontSize:22, fontWeight:'900', color:'#f0f0f8', lineHeight:26 },
  statLbl: { fontSize:10, color:'#5a5a72', fontWeight:'600', marginTop:2, textTransform:'uppercase', letterSpacing:0.3 },

  // Alert banners
  alertBanner: {
    flexDirection:'row', alignItems:'center', gap:12,
    marginHorizontal:16, marginBottom:10,
    backgroundColor:'rgba(255,74,110,0.07)',
    borderWidth:1, borderColor:'rgba(255,74,110,0.18)',
    borderRadius:14, padding:14,
  },
  alertBannerBlue: {
    backgroundColor:'rgba(61,139,255,0.07)',
    borderColor:'rgba(61,139,255,0.18)',
  },
  alertBannerIcon:  { fontSize:22 },
  alertBannerTitle: { fontSize:14, fontWeight:'800', color:'#ff4a6e' },
  alertBannerSub:   { fontSize:11, color:'#9090aa', marginTop:2 },
  alertBannerArrow: { fontSize:22, color:'rgba(255,255,255,0.2)', fontWeight:'300' },

  // Section
  section:      { paddingHorizontal:16, marginBottom:4 },
  sectionHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  sectionTitle: { fontSize:14, fontWeight:'800', color:'#f0f0f8' },
  sectionLink:  { fontSize:12, color:'#00e5a0', fontWeight:'700' },

  // Live indicator
  liveIndicator:{ flexDirection:'row', alignItems:'center', gap:5 },
  liveDot: {
    width:6, height:6, borderRadius:3, backgroundColor:'#00e5a0',
  },
  liveText: { fontSize:10, fontWeight:'700', color:'#00e5a0', letterSpacing:0.5 },

  // Quick matches
  quickScroll:  { marginHorizontal:-16 },
  quickContent: { paddingHorizontal:16, gap:10 },
  quickCard: {
    width:130, backgroundColor:'#1a1a24',
    borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    padding:12,
  },
  quickLeague:{ fontSize:9, fontWeight:'800', color:'#00e5a0', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  quickTeams: { fontSize:13, fontWeight:'800', color:'#f0f0f8', lineHeight:18, marginBottom:6 },
  quickTime:  { fontSize:10, color:'#5a5a72' },

  // Feed
  feedCard: {
    backgroundColor:'#1a1a24',
    borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    overflow:'hidden',
  },
  feedRow: {
    flexDirection:'row', alignItems:'flex-start', gap:12,
    padding:14,
    borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)',
  },
  feedRowLast:  { borderBottomWidth:0 },
  feedAvatar: {
    width:36, height:36, borderRadius:18,
    alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  feedAvatarText:   { fontSize:12, fontWeight:'800' },
  feedContent:      { flex:1 },
  feedText:         { fontSize:13, color:'#f0f0f8', lineHeight:19 },
  feedActor:        { fontWeight:'800' },
  feedMessage:      { color:'#9090aa', fontWeight:'400' },
  feedTime:         { fontSize:11, color:'#3a3a52', marginTop:3 },
  rematchBtn: {
    width:30, height:30, borderRadius:15,
    backgroundColor:'rgba(255,255,255,0.06)',
    borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
    alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  rematchBtnText: { fontSize:16, color:'#9090aa' },
  feedEmpty: { alignItems:'center', paddingVertical:40, gap:8 },
  feedEmptyIcon:  { fontSize:40 },
  feedEmptyTitle: { fontSize:15, fontWeight:'700', color:'#f0f0f8' },
  feedEmptySub:   { fontSize:13, color:'#5a5a72', textAlign:'center' },
});
