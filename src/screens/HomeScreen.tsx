// src/screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, StatusBar, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import BetModal from '../components/BetModal';
import { useBets } from '../hooks/useBets';
import { usePremium } from '../hooks/usePremium';
import { useLanguage } from '../hooks/useLanguage';
import type { Match, MatchResult } from '../types/database';

// ── Types ────────────────────────────────────────────────────
type FeedItem = {
  id: string;
  type: string;
  actor: string;
  actorInitials: string;
  avatarColor: string;
  message: string;
  highlight: string;
  highlightColor: string;
  time: string;
  canRematch?: boolean;
  betId?: string;
  challengeId?: string;
  proofImageUrl?: string;
};

type QuickMatch = Match & { betCount?: number };

type ActiveBet = {
  id: string;
  status: string;
  challenger_id: string;
  challenger_prediction: string;
  opponent_prediction: string | null;
  exercise: string;
  amount: number;
  unit: string;
  match: { kickoff_time: string; league_name: string; home_team: { name: string } | null; away_team: { name: string } | null } | null;
  challenger: { username: string; full_name: string | null } | null;
  opponent: { username: string; full_name: string | null } | null;
};

const AVATAR_COLORS = ['#21A56A','#47C4EE','#ff4a6e','#FFC845','#a855f7','#ff9f40'];

// ── Component ────────────────────────────────────────────────
export default function HomeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const { createBet } = useBets(profile?.id ?? '');
  const { canAccessLeague } = usePremium();
  const { t, lang } = useLanguage();

  const [feed, setFeed]               = useState<FeedItem[]>([]);
  const [upcomingMatches, setUpcoming]= useState<QuickMatch[]>([]);
  const [activeBets, setActiveBets]   = useState<ActiveBet[]>([]);
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
    fetchUpcoming();
    Animated.stagger(120, [
      Animated.spring(heroAnim,  { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
      Animated.spring(statsAnim, { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
      Animated.spring(feedAnim,  { toValue:1, useNativeDriver:true, damping:18, stiffness:160 }),
    ]).start();
  }, []);

  // Fetch user-specific data once profile is available, and keep in sync via realtime
  useEffect(() => {
    if (!profile?.id) return;
    fetchFeed();
    fetchStats();
    fetchActiveBets();

    const channel = supabase
      .channel(`home_feed_${profile.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications' }, () => fetchFeed())
      .on('postgres_changes', { event:'*', schema:'public', table:'bets' }, () => fetchActiveBets())
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'matches' }, () => {
        fetchUpcoming();
        fetchActiveBets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  async function fetchAll() {
    await Promise.all([fetchFeed(), fetchUpcoming(), fetchStats(), fetchActiveBets()]);
  }

  async function fetchActiveBets() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('bets')
      .select(`
        id, status, challenger_id, challenger_prediction, opponent_prediction, exercise, amount, unit,
        match:matches(kickoff_time, league_name, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)),
        challenger:profiles!challenger_id(username, full_name),
        opponent:profiles!opponent_id(username, full_name)
      `)
      .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setActiveBets(data as unknown as ActiveBet[]);
  }


  async function fetchFeed() {
    if (!profile?.id) return;
    const { data, error: myError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      .eq('status', 'accepted');

    const friendIds = (friendships ?? []).map((f: any) =>
      f.requester_id === profile.id ? f.addressee_id : f.requester_id
    );

    let friendActivity: any[] = [];
    if (friendIds.length > 0) {
      const { data: fa } = await supabase
        .from('notifications')
        .select('*, profile:profiles!user_id(username, full_name)')
        .in('user_id', friendIds)
        .in('type', ['bet_won', 'bet_lost', 'challenge_approved'])
        .order('created_at', { ascending: false })
        .limit(15);
      friendActivity = fa ?? [];
    }

    if (myError) return; // keep existing feed on error

    const allActivity = [
      ...(data ?? []).map((n: any, i: number) => buildFeedItem(n, true, i)),
      ...friendActivity.map((n: any, i: number) => buildFeedItem(n, false, i + 20)),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);

    // Fetch proof photos for challenge_approved items
    const approvedIds = allActivity
      .filter(e => e.type === 'challenge_approved' && e.challengeId)
      .map(e => e.challengeId as string);

    if (approvedIds.length > 0) {
      const { data: proofs } = await supabase
        .from('challenge_proofs')
        .select('challenge_id, file_url')
        .in('challenge_id', approvedIds)
        .eq('proof_type', 'photo')
        .eq('status', 'approved');

      const proofMap = new Map((proofs ?? []).map((p: any) => [p.challenge_id, p.file_url]));
      allActivity.forEach(e => {
        if (e.challengeId && proofMap.has(e.challengeId)) {
          e.proofImageUrl = proofMap.get(e.challengeId);
        }
      });
    }

    setFeed(allActivity);
  }

  function buildFeedItem(n: any, isMe: boolean, idx: number): FeedItem {
    const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    const actor = isMe ? t('home_you') : (n.profile?.full_name ?? n.profile?.username ?? 'Friend');
    const initials = isMe
      ? getInitials(profile?.full_name ?? profile?.username ?? 'ME')
      : getInitials(actor);

    const typeMap: Record<string, { msg: string; hl: string; hlColor: string }> = {
      bet_won:              { msg: t('home_feed_bet_won'),       hl: 'won',      hlColor: '#21A56A' },
      bet_lost:             { msg: t('home_feed_bet_lost'),      hl: 'lost',     hlColor: '#ff4a6e' },
      bet_created:          { msg: t('home_feed_bet_created'),   hl: 'sent',     hlColor: '#47C4EE' },
      bet_received:         { msg: t('home_feed_bet_received'),  hl: 'bet',      hlColor: '#ffc940' },
      bet_accepted:         { msg: t('home_feed_bet_accepted'),  hl: 'accepted', hlColor: '#47C4EE' },
      challenge_assigned:   { msg: t('home_feed_ch_assigned'),   hl: 'challenge',hlColor: '#ff4a6e' },
      challenge_submitted:  { msg: t('home_feed_ch_submitted'),  hl: 'proof',    hlColor: '#ffc940' },
      challenge_approved:   { msg: t('home_feed_ch_approved'),   hl: 'done',     hlColor: '#21A56A' },
      challenge_rejected:   { msg: t('home_feed_ch_rejected'),   hl: 'rejected', hlColor: '#9090aa' },
      friend_request:       { msg: t('home_feed_fr_request'),    hl: 'request',  hlColor: '#a855f7' },
      friend_accepted:      { msg: t('home_feed_fr_accepted'),   hl: 'friend',   hlColor: '#21A56A' },
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
      canRematch:   n.type === 'bet_won' || n.type === 'bet_lost',
      betId:        n.data?.bet_id,
      challengeId:  n.data?.challenge_id ?? null,
      proofImageUrl: undefined,
    };
  }

  async function fetchUpcoming() {
    const { data, error } = await supabase
      .from('matches')
      .select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)')
      .eq('status', 'upcoming')
      .gte('kickoff_time', new Date().toISOString())
      .order('kickoff_time', { ascending: true })
      .limit(8);
    if (!error) setUpcoming((data ?? []) as QuickMatch[]);
  }

  async function fetchStats() {
    if (!profile?.id) return;
    const [ch, bets] = await Promise.all([
      supabase.from('challenges').select('id', { count:'exact', head:true }).eq('loser_id', profile.id).eq('status', 'assigned'),
      supabase.from('bets').select('id', { count:'exact', head:true }).eq('opponent_id', profile.id).eq('status', 'pending'),
    ]);
    if (!ch.error) setOpenCh(ch.count ?? 0);
    if (!bets.error) setPendingBets(bets.count ?? 0);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [profile?.id]);

  function openBet(match: Match, pred: MatchResult) {
    if (!canAccessLeague(match.league_name)) {
      navigation.navigate('Paywall', { feature: 'general' });
      return;
    }
    setSelectedMatch(match);
    setSelectedPred(pred);
    setBetModal(true);
  }

  function handleRematch() {
    navigation.navigate('Main', { screen: 'Challenges' });
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#21A56A" />}
        contentContainerStyle={s.scroll}
      >
        {/* ── Top bar ── */}
        <View style={s.topBar}>
          <View>
            <Text style={s.greeting}>{getGreeting(lang)}</Text>
            <Text style={s.userName}>{profile?.full_name ?? profile?.username ?? 'Player'}</Text>
          </View>
          <View style={s.topBarRight}>
            {(openChallenges > 0 || pendingBets > 0) && (
              <TouchableOpacity style={s.alertPill} onPress={() => navigation.navigate('Main', { screen: 'Challenges' })}>
                <View style={s.alertDot} />
                <Text style={s.alertText}>
                  {openChallenges > 0 ? `${openChallenges} ${t('home_open_challenges')}` : `${pendingBets} ${t('home_pending_bets')}`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
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
              <Text style={s.heroTime}>{formatKickoff(featuredMatch.kickoff_time, lang)}</Text>
            </View>
            <View style={s.heroTeams}>
              <View style={s.heroTeam}>
                <Text style={s.heroTeamName}>{featuredMatch.home_team?.name}</Text>
                <Text style={s.heroTeamSub}>Home</Text>
              </View>
              <View style={s.heroVs}>
                <Text style={s.heroVsText}>VS</Text>
              </View>
              <View style={[s.heroTeam, { alignItems:'flex-end' }]}>
                <Text style={s.heroTeamName}>{featuredMatch.away_team?.name}</Text>
                <Text style={[s.heroTeamSub, { textAlign:'right' }]}>Away</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.heroBtn, !canAccessLeague(featuredMatch.league_name) && s.heroBtnLocked]}
              onPress={() => openBet(featuredMatch, 'home')}
              activeOpacity={0.85}
            >
              <Text style={[s.heroBtnText, !canAccessLeague(featuredMatch.league_name) && { color:'#ffc940' }]}>
                {canAccessLeague(featuredMatch.league_name) ? t('home_bet_on_match') : `👑 ${t('home_premium_to_bet')}`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Stats row ── */}
        <Animated.View style={[s.statsRow, {
          opacity: statsAnim,
          transform: [{ translateY: statsAnim.interpolate({ inputRange:[0,1], outputRange:[20,0] }) }],
        }]}>
          <View style={[s.statBox, s.statBoxAccent]}>
            <Text style={[s.statNum, { color:'#21A56A' }]}>{points}</Text>
            <Text style={s.statLbl}>{t('home_points')}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{wins}</Text>
            <Text style={s.statLbl}>{t('home_wins')}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{losses}</Text>
            <Text style={s.statLbl}>{t('home_losses')}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{winRate}<Text style={{ fontSize:14 }}>%</Text></Text>
            <Text style={s.statLbl}>{t('home_win_rate')}</Text>
          </View>
        </Animated.View>

        {/* ── Season banner ── */}
        <TouchableOpacity
          style={s.seasonBanner}
          onPress={() => navigation.navigate('Season')}
          activeOpacity={0.85}
        >
          <View style={s.seasonBannerLeft}>
            <Text style={s.seasonBannerEmoji}>🏆</Text>
            <View>
              <Text style={s.seasonBannerTitle}>{t('season_title')}</Text>
              <Text style={s.seasonBannerSub}>{t('season_hint')}</Text>
            </View>
          </View>
          <Text style={s.seasonBannerArrow}>›</Text>
        </TouchableOpacity>

        {/* ── Alert banners ── */}
        {openChallenges > 0 && (
          <TouchableOpacity style={s.alertBanner} onPress={() => navigation.navigate('Main', { screen: 'Challenges' })} activeOpacity={0.85}>
            <Text style={s.alertBannerIcon}>⚠️</Text>
            <View style={{ flex:1 }}>
              <Text style={s.alertBannerTitle}>{openChallenges} {t('home_open_challenges')}!</Text>
              <Text style={s.alertBannerSub}>{t('home_complete_proof')}</Text>
            </View>
            <Text style={s.alertBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {pendingBets > 0 && (
          <TouchableOpacity style={[s.alertBanner, s.alertBannerBlue]} onPress={() => navigation.navigate('Main', { screen: 'Challenges' })} activeOpacity={0.85}>
            <Text style={s.alertBannerIcon}>🎯</Text>
            <View style={{ flex:1 }}>
              <Text style={[s.alertBannerTitle, { color:'#47C4EE' }]}>{pendingBets} {pendingBets === 1 ? 'bet' : 'bets'} awaiting response!</Text>
              <Text style={s.alertBannerSub}>A friend challenged you</Text>
            </View>
            <Text style={s.alertBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Active bets ── */}
        {activeBets.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('home_active_bets')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Challenges' })}>
                <Text style={s.sectionLink}>{t('home_view_all')} →</Text>
              </TouchableOpacity>
            </View>
            <View style={s.activeBetsCard}>
              {activeBets.map((bet, idx) => {
                const isChallenger = bet.challenger_id === profile?.id;
                const other = isChallenger ? bet.opponent : bet.challenger;
                const otherName = other?.full_name ?? other?.username ?? 'Vinur';
                const isPending = bet.status === 'pending';
                return (
                  <View key={bet.id} style={[s.activeBetRow, idx === activeBets.length - 1 && s.activeBetRowLast]}>
                    <View style={[s.activeBetDot, { backgroundColor: isPending ? '#ffc940' : '#21A56A' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.activeBetMatch} numberOfLines={1}>
                        {bet.match?.home_team?.name} vs {bet.match?.away_team?.name}
                      </Text>
                      <Text style={s.activeBetSub}>
                        {isChallenger ? `You vs ${otherName}` : `${otherName} vs you`} · {bet.amount} {bet.unit} {bet.exercise}
                      </Text>
                    </View>
                    <View style={[s.activeBetBadge, { backgroundColor: isPending ? 'rgba(255,201,64,0.12)' : 'rgba(33,165,106,0.12)' }]}>
                      <Text style={[s.activeBetBadgeText, { color: isPending ? '#ffc940' : '#21A56A' }]}>
                        {isPending ? t('home_active_bet_pending') : t('home_active_bet_accepted')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Activity feed ── */}
        <Animated.View style={[s.section, {
          opacity: feedAnim,
          transform: [{ translateY: feedAnim.interpolate({ inputRange:[0,1], outputRange:[16,0] }) }],
        }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{t('home_activity')}</Text>
            {feed.length > 0 && (
              <View style={s.liveIndicator}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Live</Text>
              </View>
            )}
          </View>

          <View style={s.feedCard}>
            {feed.length === 0 ? (
              <View style={s.feedEmpty}>
                <Text style={s.feedEmptyIcon}>🏟</Text>
                <Text style={s.feedEmptyTitle}>{t('home_no_activity')}</Text>
                <Text style={s.feedEmptySub}>Place a bet and invite friends!</Text>
              </View>
            ) : (
              feed.map((item, idx) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  isLast={idx === feed.length - 1}
                  onRematch={handleRematch}
                  lang={lang}
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
        onPremiumRequired={() => navigation.navigate('Paywall')}
        onSubmit={async (matchId, opponentId, prediction, exercise, amount, unit) => {
          const { bet, error } = await createBet(matchId, opponentId, prediction, exercise, amount, unit);
          return { error, betId: bet?.id };
        }}
      />
    </SafeAreaView>
  );
}

// ── FeedRow sub-component ────────────────────────────────────
function FeedRow({ item, isLast, onRematch, lang }: { item: FeedItem; isLast: boolean; onRematch: () => void; lang: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, { toValue:1, useNativeDriver:true, damping:20, stiffness:180 }).start();
  }, []);

  async function shareProof() {
    if (!item.proofImageUrl) return;
    await Share.share({
      message: `${item.actor} kláraði áskorun á FitBet! 💪\n${item.proofImageUrl}`,
      url: item.proofImageUrl,
    });
  }

  return (
    <Animated.View style={[s.feedRow, isLast && s.feedRowLast, { opacity: fadeAnim }]}>
      {/* Avatar + text row */}
      <View style={s.feedRowTop}>
        <View style={[s.feedAvatar, { backgroundColor: item.avatarColor + '22' }]}>
          <Text style={[s.feedAvatarText, { color: item.avatarColor }]}>{item.actorInitials}</Text>
        </View>

        <View style={s.feedContent}>
          <Text style={s.feedText} numberOfLines={2}>
            <Text style={s.feedActor}>{item.actor} </Text>
            <Text style={s.feedMessage}>{item.message}</Text>
          </Text>
          <Text style={s.feedTime}>{formatRelativeTime(item.time, lang)}</Text>
        </View>

        {item.canRematch && (
          <TouchableOpacity style={s.rematchBtn} onPress={onRematch} activeOpacity={0.75}>
            <Text style={s.rematchBtnText}>↺</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Proof photo */}
      {item.proofImageUrl && (
        <View style={s.proofWrap}>
          <Image source={{ uri: item.proofImageUrl }} style={s.proofImage} resizeMode="cover" />
          <TouchableOpacity style={s.proofShareBtn} onPress={shareProof} activeOpacity={0.8}>
            <Text style={s.proofShareText}>📤  Deila</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
}

function getGreeting(lang: string): string {
  const h = new Date().getHours();
  if (lang === 'is') {
    if (h < 12) return 'Góðan daginn,';
    if (h < 18) return 'Góðan dag,';
    return 'Gott kvöld,';
  }
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

function formatKickoff(iso: string, lang: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const locale = lang === 'is' ? 'is-IS' : 'en-GB';
  const time = d.toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' });
  if (isToday)    return lang === 'is' ? `Í dag · ${time}` : `Today · ${time}`;
  if (isTomorrow) return lang === 'is' ? `Á morgun · ${time}` : `Tomorrow · ${time}`;
  return d.toLocaleDateString(locale, { weekday:'short', day:'numeric', month:'short' }) + ` · ${time}`;
}

function formatRelativeTime(iso: string, lang: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (lang === 'is') {
    if (mins < 1)  return 'Rétt í þessu';
    if (mins < 60) return `${mins} mín síðan`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs} klst síðan`;
    return `${Math.floor(hrs / 24)} d síðan`;
  }
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
  profileInitials: { fontSize:13, fontWeight:'800', color:'#21A56A' },

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
  heroBadgeText: { fontSize:10, fontWeight:'800', color:'#21A56A', letterSpacing:0.5 },
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
    backgroundColor:'#21A56A', borderRadius:12,
    paddingVertical:12, alignItems:'center',
  },
  heroBtnLocked: { backgroundColor:'rgba(255,201,64,0.15)', borderWidth:1, borderColor:'rgba(255,201,64,0.3)' },
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
  sectionLink:  { fontSize:12, color:'#21A56A', fontWeight:'700' },

  // Live indicator
  liveIndicator:{ flexDirection:'row', alignItems:'center', gap:5 },
  liveDot: {
    width:6, height:6, borderRadius:3, backgroundColor:'#21A56A',
  },
  liveText: { fontSize:10, fontWeight:'700', color:'#21A56A', letterSpacing:0.5 },

  // Quick matches
  quickScroll:  { marginHorizontal:-16 },
  quickContent: { paddingHorizontal:16, gap:10 },
  quickCard: {
    width:130, backgroundColor:'#1a1a24',
    borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    padding:12,
  },
  quickCardLocked: { borderColor:'rgba(255,201,64,0.2)', opacity:0.75 },
  quickLeague:{ fontSize:9, fontWeight:'800', color:'#21A56A', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  quickTeams: { fontSize:13, fontWeight:'800', color:'#f0f0f8', lineHeight:18, marginBottom:6 },
  quickTime:  { fontSize:10, color:'#5a5a72' },

  // Feed
  feedCard: {
    backgroundColor:'#1a1a24',
    borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.07)',
    overflow:'hidden',
  },
  feedRow: {
    flexDirection:'column',
    padding:14,
    borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)',
  },
  feedRowTop:   { flexDirection:'row', alignItems:'flex-start', gap:12 },
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
  proofWrap: { marginTop:10, borderRadius:12, overflow:'hidden' },
  proofImage: { width:'100%', height:200, borderRadius:12 },
  proofShareBtn: {
    marginTop:8, backgroundColor:'rgba(255,255,255,0.08)',
    borderRadius:10, paddingVertical:9, alignItems:'center',
  },
  proofShareText: { fontSize:13, color:'#ccc', fontWeight:'600' },
  feedEmpty: { alignItems:'center', paddingVertical:40, gap:8 },
  feedEmptyIcon:  { fontSize:40 },
  feedEmptyTitle: { fontSize:15, fontWeight:'700', color:'#f0f0f8' },
  feedEmptySub:   { fontSize:13, color:'#5a5a72', textAlign:'center' },

  // Active bets
  activeBetsCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: 4,
  },
  activeBetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  activeBetRowLast: { borderBottomWidth: 0 },
  activeBetDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activeBetMatch: { fontSize: 13, fontWeight: '700', color: '#f0f0f8', marginBottom: 2 },
  activeBetSub: { fontSize: 11, color: '#9090aa' },
  activeBetBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  activeBetBadgeText: { fontSize: 10, fontWeight: '800' },

  seasonBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: 'rgba(255,201,64,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,201,64,0.3)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  seasonBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  seasonBannerEmoji: { fontSize: 28 },
  seasonBannerTitle: { fontSize: 15, fontWeight: '800', color: '#f0f0f8', marginBottom: 2 },
  seasonBannerSub:   { fontSize: 11, color: '#9090aa' },
  seasonBannerArrow: { fontSize: 22, color: '#ffc940', fontWeight: '700' },
});
