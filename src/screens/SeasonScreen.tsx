import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Modal, ActivityIndicator, Alert,
  Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { SeasonBet, Profile, Team } from '../types/database';
import { LEAGUE_COLOR } from '../constants/leagues';
import { useLanguage } from '../hooks/useLanguage';

const { width: SCREEN_W } = Dimensions.get('window');

const LEAGUES = [
  { key: 'Besta deild karla',  label: 'Besta deildin'  },
  { key: 'Lengjudeild karla',  label: 'Lengjudeildin'  },
];

const EXERCISE_TYPES = [
  { exercise: 'hlaup',      emoji: '🏃', label: 'Hlaup',      unit: 'km',  amounts: [5, 10, 21, 42]       },
  { exercise: 'hjólreiðar', emoji: '🚴', label: 'Hjólreiðar', unit: 'km',  amounts: [20, 30, 50, 100]     },
  { exercise: 'armbeygjur', emoji: '💪', label: 'Armbeygjur', unit: 'stk', amounts: [50, 100, 150, 200]   },
  { exercise: 'hnébeygjur', emoji: '🦵', label: 'Hnébeygjur', unit: 'stk', amounts: [50, 100, 150, 200]   },
  { exercise: 'burpees',    emoji: '🔥', label: 'Burpees',    unit: 'stk', amounts: [20, 30, 50, 100]     },
];

type ActiveTab = 'besta' | 'lengju' | 'mín';

export default function SeasonScreen() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const [teamsByLeague, setTeamsByLeague]       = useState<Record<string, Team[]>>({});
  const [marketsByLeague, setMarketsByLeague]   = useState<Record<string, string>>({});
  const [myBets, setMyBets]                     = useState<SeasonBet[]>([]);
  const [friendBets, setFriendBets]             = useState<SeasonBet[]>([]);
  const [friends, setFriends]                   = useState<Profile[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [activeTab, setActiveTab]               = useState<ActiveTab>('besta');

  const [betModal, setBetModal]                 = useState(false);
  const [myTeam, setMyTeam]                     = useState<Team | null>(null);
  const [oppTeam, setOppTeam]                   = useState<Team | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<Profile | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<typeof EXERCISE_TYPES[0] | null>(null);
  const [selectedAmount, setSelectedAmount]     = useState<number | null>(null);
  const [submitting, setSubmitting]             = useState(false);

  useEffect(() => { fetchAll(); }, [profile?.id]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchTeams(), fetchMarkets(), fetchMyBets(), fetchFriends()]);
    setLoading(false);
  }

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .in('league_name', LEAGUES.map(l => l.key))
      .order('name');
    const grouped: Record<string, Team[]> = {};
    for (const t of (data ?? []) as Team[]) {
      if (!t.league_name) continue;
      if (!grouped[t.league_name]) grouped[t.league_name] = [];
      grouped[t.league_name].push(t);
    }
    setTeamsByLeague(grouped);
  }

  async function fetchMarkets() {
    const { data } = await supabase
      .from('season_markets')
      .select('id, league_name')
      .eq('market_type', 'yfir_neðar')
      .eq('status', 'open')
      .in('league_name', LEAGUES.map(l => l.key));
    const map: Record<string, string> = {};
    for (const m of (data ?? []) as any[]) {
      if (!map[m.league_name]) map[m.league_name] = m.id;
    }
    setMarketsByLeague(map);
  }

  async function fetchMyBets() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('season_bets')
      .select('*, market:season_markets(*), challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*), challenger_team:teams!challenger_pick(*), opponent_team:teams!opponent_pick(*)')
      .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    setMyBets((data ?? []) as SeasonBet[]);
  }

  async function fetchFriends() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('friendships')
      .select('requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);
    const list = (data ?? []).map((f: any) =>
      f.requester.id === profile.id ? f.addressee : f.requester
    ) as Profile[];
    setFriends(list);

    if (list.length > 0) {
      const friendIds = list.map(f => f.id);
      const { data: fb } = await supabase
        .from('season_bets')
        .select('*, market:season_markets(*), challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
        .in('challenger_id', friendIds)
        .order('created_at', { ascending: false });
      setFriendBets((fb ?? []) as SeasonBet[]);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [profile?.id]);

  function openModal(team: Team) {
    setMyTeam(team);
    setOppTeam(null);
    setSelectedOpponent(null);
    setSelectedExercise(null);
    setSelectedAmount(null);
    setBetModal(true);
  }

  async function submitBet() {
    if (!myTeam || !oppTeam || !selectedOpponent || !selectedExercise || !selectedAmount) return;
    const league = myTeam.league_name ?? '';
    const marketId = marketsByLeague[league];
    if (!marketId) {
      Alert.alert(t('season_market_missing'), t('season_market_missing_msg'));
      return;
    }
    setSubmitting(true);
    const { data: betData, error } = await supabase.from('season_bets').insert({
      market_id: marketId,
      challenger_id: profile!.id,
      opponent_id: selectedOpponent.id,
      challenger_pick: myTeam.id,
      opponent_pick: oppTeam.id,
      status: 'pending',
      exercise: selectedExercise.exercise,
      amount: selectedAmount,
      unit: selectedExercise.unit,
    }).select('id').single();
    if (!error) {
      await supabase.from('notifications').insert([
        {
          user_id: selectedOpponent.id,
          type: 'season_bet_received',
          title: 'Tímabilsspá móttekin! 📅',
          body: `${profile!.full_name ?? profile!.username} spáir: ${myTeam.name} endar ofar en ${oppTeam.name}.`,
          data: { type: 'season_bet_received', season_bet_id: betData?.id, market_id: marketId },
        },
        {
          user_id: profile!.id,
          type: 'season_bet_created',
          title: 'Tímabilsspá send! 📅',
          body: `Þú sendir tímabilsspá á ${selectedOpponent.full_name ?? selectedOpponent.username}. ${myTeam.name} á móti ${oppTeam.name}.`,
          data: { type: 'season_bet_created', season_bet_id: betData?.id, market_id: marketId },
        },
      ]);
      setBetModal(false);
      setActiveTab('mín');
      await fetchMyBets();
      Alert.alert(t('season_bet_sent'), `${t('season_bet_sent_msg')} ${selectedOpponent.full_name ?? selectedOpponent.username}`);
    } else {
      Alert.alert(t('common_error'), error.message);
    }
    setSubmitting(false);
  }

  const activeLeagueKey = activeTab === 'besta' ? 'Besta deild karla' : 'Lengjudeild karla';
  const activeTeams = teamsByLeague[activeLeagueKey] ?? [];
  const oppTeams = myTeam
    ? (teamsByLeague[myTeam.league_name ?? ''] ?? []).filter(t => t.id !== myTeam.id)
    : [];
  const accentColor = LEAGUE_COLOR[activeLeagueKey];

  const allTeams = Object.values(teamsByLeague).flat();
  const teamById: Record<string, string> = {};
  for (const t of allTeams) teamById[t.id] = t.name;

  // Standings: combine my bets + friend bets, deduplicate by id, group by user
  const seenIds = new Set<string>();
  const allBets = [...myBets, ...friendBets].filter(b => {
    if (seenIds.has(b.id)) return false;
    seenIds.add(b.id);
    return true;
  });
  const standingsMap: Record<string, { name: string; picks: { league: string; team: string }[] }> = {};
  for (const bet of allBets) {
    const isMe = bet.challenger_id === profile?.id;
    const userId = bet.challenger_id;
    const userName = isMe
      ? (profile?.full_name ?? profile?.username ?? 'Þú')
      : ((bet as any).challenger?.full_name ?? (bet as any).challenger?.username ?? '?');
    if (!standingsMap[userId]) standingsMap[userId] = { name: userName, picks: [] };
    if (bet.challenger_pick) {
      const teamName = teamById[bet.challenger_pick] ?? bet.challenger_pick;
      standingsMap[userId].picks.push({
        league: (bet as any).market?.league_name ?? '',
        team: teamName,
      });
    }
  }
  const standings = Object.values(standingsMap);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('season_title')}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['besta', 'lengju', 'mín'] as ActiveTab[]).map(tab => {
          const label = tab === 'besta' ? t('season_besta') : tab === 'lengju' ? t('season_lengju') : `${t('season_my_bets')} (${myBets.length})`;
          const color = tab === 'besta' ? '#21A56A' : tab === 'lengju' ? '#47C4EE' : '#FFC845';
          return (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && { borderColor: color, backgroundColor: color + '14' }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[s.tabText, activeTab === tab && { color }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#21A56A" />}
      >
        {loading ? (
          <ActivityIndicator color="#21A56A" style={{ marginTop: 60 }} />

        ) : activeTab === 'mín' ? (
          // ── Veðmál mín + Stigatafla ──────────────────────────
          <>
            {/* Standings */}
            {standings.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{t('season_friend_picks')}</Text>
                <View style={s.standingsCard}>
                  {standings.map((entry, i) => (
                    <View key={i} style={[s.standingsRow, i < standings.length - 1 && s.standingsBorder]}>
                      <View style={[s.standingsAvatar, { backgroundColor: i === 0 ? 'rgba(33,165,106,0.15)' : 'rgba(71,196,238,0.15)' }]}>
                        <Text style={[s.standingsAvatarText, { color: i === 0 ? '#21A56A' : '#47C4EE' }]}>
                          {entry.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.standingsName}>{entry.name}</Text>
                        <View style={s.standingsPicks}>
                          {entry.picks.map((p, j) => (
                            <View key={j} style={[s.pickChip, { backgroundColor: LEAGUE_COLOR[p.league] + '18' }]}>
                              <Text style={[s.pickChipText, { color: LEAGUE_COLOR[p.league] ?? '#7a9aaa' }]}>
                                {p.team}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Incoming pending bets */}
            {myBets.some(b => b.status === 'pending' && b.opponent_id === profile?.id) && (
              <>
                <Text style={s.sectionTitle}>{t('season_awaiting')}</Text>
                {myBets
                  .filter(b => b.status === 'pending' && b.opponent_id === profile?.id)
                  .map(bet => (
                    <SeasonBetRow key={bet.id} bet={bet} myId={profile?.id ?? ''} onRefresh={fetchMyBets} />
                  ))
                }
              </>
            )}

            {/* My bets */}
            <Text style={s.sectionTitle}>{t('season_my_bets_title')}</Text>
            {myBets.filter(b => !(b.status === 'pending' && b.opponent_id === profile?.id)).length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🎯</Text>
                <Text style={s.emptyTitle}>{t('season_empty')}</Text>
                <Text style={s.emptySub}>{t('season_empty_sub')}</Text>
              </View>
            ) : (
              myBets
                .filter(b => !(b.status === 'pending' && b.opponent_id === profile?.id))
                .map(bet => (
                  <SeasonBetRow key={bet.id} bet={bet} myId={profile?.id ?? ''} onRefresh={fetchMyBets} />
                ))
            )}
          </>

        ) : (
          // ── Lið í deild ──────────────────────────────────────
          <>
            {activeTeams.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>⚽</Text>
                <Text style={s.emptyTitle}>{t('season_no_teams')}</Text>
                <Text style={s.emptySub}>{t('season_no_teams_sub')}</Text>
              </View>
            ) : (
              <>
                <Text style={s.leagueHint}>{t('season_hint')}</Text>
                {!marketsByLeague[activeLeagueKey] && (
                  <View style={s.closedBanner}>
                    <Text style={s.closedBannerText}>{t('season_market_closed')}</Text>
                  </View>
                )}
                <View style={s.teamGrid}>
                  {activeTeams.map(team => (
                    <TouchableOpacity
                      key={team.id}
                      style={[s.teamCard, { borderColor: accentColor + '40' }]}
                      onPress={() => openModal(team)}
                      activeOpacity={0.75}
                    >
                      <TeamLogo team={team} accentColor={accentColor} size={48} />
                      <Text style={s.teamName} numberOfLines={2}>{team.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Bet Modal ── */}
      <Modal visible={betModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBetModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('season_modal_title')}</Text>
            <TouchableOpacity onPress={() => setBetModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {myTeam && (
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {/* My pick */}
              <Text style={s.fieldLabel}>{t('season_your_pick')}</Text>
              <View style={[s.myPickBox, { borderColor: (LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A') + '50' }]}>
                <View style={s.myPickInner}>
                  <TeamLogo team={myTeam} accentColor={LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.myPickTeam, { color: LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A' }]}>
                      {myTeam.name}
                    </Text>
                    <Text style={s.myPickSub}>{t('season_finishes_higher')} {myTeam.league_name}</Text>
                  </View>
                </View>
              </View>

              {/* Opponent team */}
              <Text style={[s.fieldLabel, { marginTop: 4 }]}>{t('season_vs_who')}</Text>
              <View style={s.teamGridModal}>
                {oppTeams.map(team => (
                  <TouchableOpacity
                    key={team.id}
                    style={[s.oppChip, oppTeam?.id === team.id && s.oppChipActive]}
                    onPress={() => setOppTeam(team)}
                    activeOpacity={0.75}
                  >
                    <TeamLogo team={team} accentColor={oppTeam?.id === team.id ? '#47C4EE' : '#4a6878'} size={22} />
                    <Text style={[s.oppChipText, oppTeam?.id === team.id && s.oppChipTextActive]}>
                      {team.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Summary */}
              {oppTeam && (
                <View style={s.vsSummary}>
                  <Text style={s.vsSummaryText}>
                    <Text style={{ color: LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A', fontWeight: '800' }}>{myTeam.name}</Text>
                    {' '}{t('season_finishes_above')}{' '}
                    <Text style={{ color: '#47C4EE', fontWeight: '800' }}>{oppTeam.name}</Text>
                  </Text>
                </View>
              )}

              {/* Friend */}
              <Text style={[s.fieldLabel, { marginTop: 8 }]}>{t('season_against')}</Text>
              {friends.length === 0 ? (
                <Text style={s.noFriends}>{t('season_no_friends')}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friendChipRow}>
                  {friends.map(f => {
                    const initials = (f.full_name ?? f.username ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                    const selected = selectedOpponent?.id === f.id;
                    return (
                      <TouchableOpacity
                        key={f.id}
                        style={[s.friendChip, selected && s.friendChipActive]}
                        onPress={() => setSelectedOpponent(f)}
                        activeOpacity={0.75}
                      >
                        <View style={[s.friendChipAvatar, selected && s.friendChipAvatarActive]}>
                          <Text style={[s.friendChipInitials, selected && { color: '#071D2A' }]}>{initials}</Text>
                        </View>
                        <Text style={[s.friendChipName, selected && s.friendChipNameActive]} numberOfLines={1}>
                          {f.full_name ?? f.username}
                        </Text>
                        {selected && <Text style={s.friendChipCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Exercise type */}
              <Text style={[s.fieldLabel, { marginTop: 8 }]}>{t('season_exercise')}</Text>
              <View style={s.challengeGrid}>
                {EXERCISE_TYPES.map(ex => (
                  <TouchableOpacity
                    key={ex.exercise}
                    style={[s.exerciseChip, selectedExercise?.exercise === ex.exercise && s.exerciseChipActive]}
                    onPress={() => { setSelectedExercise(ex); setSelectedAmount(null); }}
                  >
                    <Text style={s.exerciseChipEmoji}>{ex.emoji}</Text>
                    <Text style={[s.exerciseChipText, selectedExercise?.exercise === ex.exercise && s.exerciseChipTextActive]}>
                      {ex.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount */}
              {selectedExercise && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 8 }]}>{t('season_amount')} ({selectedExercise.unit.toUpperCase()})</Text>
                  <View style={s.amountGrid}>
                    {selectedExercise.amounts.map(amt => (
                      <TouchableOpacity
                        key={amt}
                        style={[s.amountChip, selectedAmount === amt && s.amountChipActive]}
                        onPress={() => setSelectedAmount(amt)}
                      >
                        <Text style={[s.amountChipText, selectedAmount === amt && s.amountChipTextActive]}>
                          {amt} {selectedExercise.unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[s.submitBtn, (!oppTeam || !selectedOpponent || !selectedExercise || !selectedAmount || submitting) && { opacity: 0.4 }]}
                onPress={submitBet}
                disabled={!oppTeam || !selectedOpponent || !selectedExercise || !selectedAmount || submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.submitBtnText}>{t('season_send')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── TeamLogo ──────────────────────────────────────────────────
function TeamLogo({ team, accentColor, size }: { team: Team; accentColor: string; size: number }) {
  const [failed, setFailed] = React.useState(false);
  if (team.logo_url && !failed) {
    return (
      <Image
        source={{ uri: team.logo_url }}
        style={{ width: size, height: size, resizeMode: 'contain' }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: accentColor + '18',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.3, fontWeight: '900', color: accentColor }}>
        {team.name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

// ── SeasonBetRow ──────────────────────────────────────────────
function SeasonBetRow({ bet, myId, onRefresh }: { bet: any; myId: string; onRefresh?: () => Promise<void> }) {
  const [responding, setResponding] = React.useState(false);
  const { t } = useLanguage();
  const isChallenger = bet.challenger_id === myId;
  const isIncoming   = bet.status === 'pending' && bet.opponent_id === myId;
  const myTeamName  = isChallenger ? (bet.challenger_team?.name ?? '—') : (bet.opponent_team?.name ?? '—');
  const hisTeamName = isChallenger ? (bet.opponent_team?.name  ?? '—') : (bet.challenger_team?.name ?? '—');
  const league  = bet.market?.league_name ?? '';
  const accent  = LEAGUE_COLOR[league] ?? '#21A56A';
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: t('season_pending'),  color: '#FFC845', bg: 'rgba(255,200,69,0.12)'  },
    accepted: { label: t('season_active'),   color: '#47C4EE', bg: 'rgba(71,196,238,0.12)'  },
    settled:  { label: t('season_settled'),  color: '#7a9aaa', bg: 'rgba(255,255,255,0.06)' },
    declined: { label: t('season_declined'), color: '#ff4a6e', bg: 'rgba(255,74,110,0.12)'  },
  };
  const st = statusMap[bet.status] ?? statusMap.pending;
  const won = bet.winner_id === myId;
  const settled = bet.status === 'settled';
  const oppName = isChallenger
    ? (bet.opponent?.full_name ?? bet.opponent?.username ?? '?')
    : (bet.challenger?.full_name ?? bet.challenger?.username ?? '?');
  const exercise = (bet as any).exercise;
  const amount   = (bet as any).amount;
  const unit     = (bet as any).unit;

  async function respond(accept: boolean) {
    setResponding(true);
    const { error } = await supabase
      .from('season_bets')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', bet.id);
    if (error) {
      setResponding(false);
      Alert.alert(t('common_error'), t('bet_modal_err_msg'));
      return;
    }
    await supabase.from('notifications').insert({
      user_id: bet.challenger_id,
      type: accept ? 'season_bet_accepted' : 'season_bet_declined',
      title: accept ? 'Tímabilsspá samþykkt! ✅' : 'Tímabilsspá hafnað',
      body: accept
        ? `${bet.opponent?.full_name ?? bet.opponent?.username} samþykkti spána þína.`
        : `${bet.opponent?.full_name ?? bet.opponent?.username} hafnaði spánni þinni.`,
      data: { type: accept ? 'season_bet_accepted' : 'season_bet_declined', season_bet_id: bet.id },
    });
    setResponding(false);
    await onRefresh?.();
  }

  return (
    <View style={[s.betCard, settled && won && s.betCardWon, settled && !won && bet.loser_id === myId && s.betCardLost, isIncoming && s.betCardIncoming]}>
      {/* League banner */}
      <View style={[s.betLeagueBanner, { backgroundColor: accent + '18' }]}>
        <Text style={[s.betLeagueText, { color: accent }]}>📅 {league || t('lb_season_bets')}</Text>
        <View style={[s.betStatusPill, { backgroundColor: st.bg }]}>
          <Text style={[s.betStatusPillText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {/* Teams */}
      <View style={s.betTeamsRow}>
        <View style={s.betTeamBox}>
          <Text style={[s.betTeamName, { color: accent }]} numberOfLines={2}>{myTeamName}</Text>
          <Text style={s.betTeamLabel}>{t('season_my_pick')}</Text>
        </View>
        <Text style={s.betTeamVs}>VS</Text>
        <View style={[s.betTeamBox, { alignItems: 'flex-end' }]}>
          <Text style={[s.betTeamName, { color: '#7a9aaa' }]} numberOfLines={2}>{hisTeamName}</Text>
          <Text style={[s.betTeamLabel, { textAlign: 'right' }]}>{t('season_their_pick')}</Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={s.betMetaRow}>
        <Text style={s.betMetaText}>👤 {oppName}</Text>
        {exercise && amount && (
          <View style={s.betExercisePill}>
            <Text style={s.betExercisePillText}>🏋️ {amount} {unit} {exercise}</Text>
          </View>
        )}
      </View>

      {/* Result */}
      {settled && (
        <View style={[s.betResultBanner, { backgroundColor: won ? 'rgba(33,165,106,0.12)' : 'rgba(255,74,110,0.08)' }]}>
          <Text style={[s.betResultText, { color: won ? '#21A56A' : '#ff4a6e' }]}>
            {won ? t('season_won') : t('season_lost')}
          </Text>
        </View>
      )}

      {/* Incoming actions */}
      {isIncoming && (
        <View style={s.betActions}>
          {responding ? <ActivityIndicator color="#21A56A" size="small" style={{ flex: 1, paddingVertical: 6 }} /> : (
            <>
              <TouchableOpacity style={s.betDeclineBtn} onPress={() => respond(false)}>
                <Text style={s.betDeclineBtnText}>{t('season_decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.betAcceptBtn} onPress={() => respond(true)}>
                <Text style={s.betAcceptBtnText}>{t('season_accept')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const CARD_W = (SCREEN_W - 48 - 10) / 2; // 2 columns, 16px padding each side, 10px gap

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#eef4f8' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 14 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  tabText: { fontSize: 11, fontWeight: '700', color: '#4a6878' },

  scroll: { paddingHorizontal: 16 },
  leagueHint: { fontSize: 12, color: '#4a6878', marginBottom: 12, lineHeight: 18 },
  closedBanner: {
    backgroundColor: 'rgba(255,200,69,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,200,69,0.2)',
    padding: 12, marginBottom: 14,
  },
  closedBannerText: { fontSize: 12, color: '#FFC845', fontWeight: '600' },

  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  teamCard: {
    width: CARD_W,
    backgroundColor: '#0d2030', borderRadius: 14,
    borderWidth: 1.5, padding: 14,
    alignItems: 'center', gap: 10,
    minHeight: 90, justifyContent: 'center',
  },
  teamInitials: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  teamInitialsText: { fontSize: 14, fontWeight: '900' },
  teamName: { fontSize: 13, fontWeight: '700', color: '#eef4f8', textAlign: 'center' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#eef4f8', marginBottom: 10 },

  // Standings
  standingsCard: {
    backgroundColor: '#0d2030', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
    marginBottom: 20,
  },
  standingsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  standingsBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  standingsAvatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  standingsAvatarText: { fontSize: 13, fontWeight: '800' },
  standingsName: { fontSize: 13, fontWeight: '700', color: '#eef4f8', marginBottom: 6 },
  standingsPicks: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pickChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  pickChipText: { fontSize: 11, fontWeight: '700' },

  // Bet cards
  betCard: {
    backgroundColor: '#0d2030', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12, overflow: 'hidden',
  },
  betCardWon:      { borderColor: 'rgba(33,165,106,0.35)' },
  betCardLost:     { borderColor: 'rgba(255,74,110,0.2)' },
  betCardIncoming: { borderColor: 'rgba(255,200,69,0.35)' },
  betLeagueBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  betLeagueText:   { fontSize: 11, fontWeight: '700' },
  betStatusPill:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  betStatusPillText: { fontSize: 10, fontWeight: '700' },
  betTeamsRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  betTeamBox:      { flex: 1 },
  betTeamName:     { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  betTeamLabel:    { fontSize: 10, color: '#4a6878' },
  betTeamVs:       { fontSize: 11, fontWeight: '900', color: '#4a6878', paddingHorizontal: 4 },
  betMetaRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  betMetaText:     { fontSize: 11, color: '#4a6878' },
  betExercisePill: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  betExercisePillText: { fontSize: 11, color: '#7a9aaa', fontWeight: '600' },
  betResultBanner: { paddingHorizontal: 14, paddingVertical: 10, marginTop: 2 },
  betResultText:   { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  betActions:      { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  betDeclineBtn:   { flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,74,110,0.3)', alignItems: 'center' },
  betDeclineBtnText: { color: '#ff4a6e', fontWeight: '700', fontSize: 13 },
  betAcceptBtn:    { flex: 2, padding: 11, borderRadius: 12, backgroundColor: '#21A56A', alignItems: 'center' },
  betAcceptBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  empty: { alignItems: 'center', paddingTop: 72, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#eef4f8' },
  emptySub: { fontSize: 13, color: '#4a6878', textAlign: 'center', paddingHorizontal: 24 },

  // Modal
  modal: { flex: 1, backgroundColor: '#071D2A' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#eef4f8' },
  modalClose: { fontSize: 20, color: '#4a6878', fontWeight: '700' },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#4a6878', letterSpacing: 1.5, marginBottom: 10 },

  myPickBox: {
    backgroundColor: 'rgba(33,165,106,0.07)', borderRadius: 14,
    borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 20,
  },
  myPickInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  myPickTeam: { fontSize: 20, fontWeight: '900', marginBottom: 3 },
  myPickSub: { fontSize: 12, color: '#4a6878' },

  teamGridModal: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  oppChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0d2030',
  },
  oppChipActive: { borderColor: '#47C4EE', backgroundColor: 'rgba(71,196,238,0.1)' },
  oppChipText: { fontSize: 13, fontWeight: '700', color: '#7a9aaa' },
  oppChipTextActive: { color: '#47C4EE' },

  vsSummary: {
    backgroundColor: '#071D2A', borderRadius: 12,
    padding: 14, marginBottom: 16, alignItems: 'center',
  },
  vsSummaryText: { fontSize: 15, color: '#7a9aaa', textAlign: 'center', lineHeight: 22 },

  friendChipRow: { flexDirection: 'row', gap: 10, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 8 },
  friendChip: { alignItems: 'center', width: 64 },
  friendChipActive: {},
  friendChipAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  friendChipAvatarActive: { backgroundColor: '#21A56A', borderColor: '#21A56A' },
  friendChipInitials: { fontSize: 14, fontWeight: '800', color: '#7a9aaa' },
  friendChipName: { fontSize: 10, color: '#7a9aaa', textAlign: 'center' },
  friendChipNameActive: { color: '#21A56A', fontWeight: '700' },
  friendChipCheck: { fontSize: 10, color: '#21A56A', fontWeight: '800', marginTop: 1 },
  noFriends: { fontSize: 13, color: '#4a6878', textAlign: 'center', marginBottom: 16 },

  challengeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  exerciseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0d2030',
  },
  exerciseChipActive: { borderColor: '#21A56A', backgroundColor: 'rgba(33,165,106,0.08)' },
  exerciseChipEmoji: { fontSize: 16 },
  exerciseChipText: { fontSize: 13, fontWeight: '700', color: '#7a9aaa' },
  exerciseChipTextActive: { color: '#21A56A' },
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  amountChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#0d2030',
  },
  amountChipActive: { borderColor: '#FFC845', backgroundColor: 'rgba(255,200,69,0.1)' },
  amountChipText: { fontSize: 15, fontWeight: '800', color: '#7a9aaa' },
  amountChipTextActive: { color: '#FFC845' },

  submitBtn: { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
