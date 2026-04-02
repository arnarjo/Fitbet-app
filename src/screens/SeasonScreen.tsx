// src/screens/SeasonScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Modal, ActivityIndicator, Alert,
  Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { SeasonBet, Profile, Team } from '../types/database';

const { width: SCREEN_W } = Dimensions.get('window');

// Exact league names as stored in DB
const LEAGUES = [
  { key: 'Besta deild karla',  label: 'Besta deildin'  },
  { key: 'Lengjudeild karla',  label: 'Lengjudeildin'  },
];

const LEAGUE_COLOR: Record<string, string> = {
  'Besta deild karla': '#21A56A',
  'Lengjudeild karla': '#47C4EE',
};

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
  const navigation = useNavigation<any>();

  const [teamsByLeague, setTeamsByLeague]       = useState<Record<string, Team[]>>({});
  const [marketsByLeague, setMarketsByLeague]   = useState<Record<string, string>>({});
  const [myBets, setMyBets]                     = useState<SeasonBet[]>([]);
  const [friendBets, setFriendBets]             = useState<SeasonBet[]>([]);
  const [friends, setFriends]                   = useState<Profile[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [activeTab, setActiveTab]               = useState<ActiveTab>('besta');

  // Modal
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

    // Fetch friend bets for standings
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
      Alert.alert('Markaður vantar', 'Enginn opinn markaður er í þessari deild. Hafðu samband við admin.');
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
      await supabase.from('notifications').insert({
        user_id: selectedOpponent.id,
        type: 'bet_received',
        title: 'Tímabilsspá móttekin! 📅',
        body: `${profile!.full_name ?? profile!.username} spáir: ${myTeam.name} endar ofar en ${oppTeam.name}.`,
        data: { market_id: marketId },
      });
      setBetModal(false);
      await fetchMyBets();
      Alert.alert('Veðmál sent! 🏆', `Beiðni send til ${selectedOpponent.full_name ?? selectedOpponent.username}`);
    } else {
      Alert.alert('Villa', error.message);
    }
    setSubmitting(false);
  }

  const activeLeagueKey = activeTab === 'besta' ? 'Besta deild karla' : 'Lengjudeild karla';
  const activeTeams = teamsByLeague[activeLeagueKey] ?? [];
  const oppTeams = myTeam
    ? (teamsByLeague[myTeam.league_name ?? ''] ?? []).filter(t => t.id !== myTeam.id)
    : [];
  const accentColor = LEAGUE_COLOR[activeLeagueKey];

  // Flat team lookup by ID
  const allTeams = Object.values(teamsByLeague).flat();
  const teamById: Record<string, string> = {};
  for (const t of allTeams) teamById[t.id] = t.name;

  // Standings: combine my bets + friend bets, group by user
  const allBets = [...myBets, ...friendBets];
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
        <Text style={s.headerTitle}>Tímabilsveðmál</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['besta', 'lengju', 'mín'] as ActiveTab[]).map(tab => {
          const label = tab === 'besta' ? 'Besta deildin' : tab === 'lengju' ? 'Lengjudeildin' : `Veðmál (${myBets.length})`;
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
                <Text style={s.sectionTitle}>Spár vina</Text>
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

            {/* My bets */}
            <Text style={s.sectionTitle}>Veðmál mín</Text>
            {myBets.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🎯</Text>
                <Text style={s.emptyTitle}>Engin tímabilsveðmál</Text>
                <Text style={s.emptySub}>Veldu lið í flipunum til vinstri</Text>
              </View>
            ) : (
              myBets.map(bet => (
                <SeasonBetRow key={bet.id} bet={bet} myId={profile?.id ?? ''} />
              ))
            )}
          </>

        ) : (
          // ── Lið í deild ──────────────────────────────────────
          <>
            {activeTeams.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>⚽</Text>
                <Text style={s.emptyTitle}>Engin lið</Text>
                <Text style={s.emptySub}>Lið hafa ekki verið skráð í þessa deild</Text>
              </View>
            ) : (
              <>
                <Text style={s.leagueHint}>Veldu liðið sem þú heldur að muni enda hærra</Text>
                {!marketsByLeague[activeLeagueKey] && (
                  <View style={s.closedBanner}>
                    <Text style={s.closedBannerText}>⏳ Veðmál eru ekki opin í þessari deild ennþá</Text>
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
            <Text style={s.modalTitle}>Tímabilsspá</Text>
            <TouchableOpacity onPress={() => setBetModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {myTeam && (
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {/* My pick */}
              <Text style={s.fieldLabel}>ÞÍN SPÁ</Text>
              <View style={[s.myPickBox, { borderColor: (LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A') + '50' }]}>
                <View style={s.myPickInner}>
                  <TeamLogo team={myTeam} accentColor={LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A'} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.myPickTeam, { color: LEAGUE_COLOR[myTeam.league_name ?? ''] ?? '#21A56A' }]}>
                      {myTeam.name}
                    </Text>
                    <Text style={s.myPickSub}>endar hærra í {myTeam.league_name}</Text>
                  </View>
                </View>
              </View>

              {/* Opponent team */}
              <Text style={[s.fieldLabel, { marginTop: 4 }]}>Á MÓT HVAÐA LIÐI?</Text>
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
                    {' '}endar ofar en{' '}
                    <Text style={{ color: '#47C4EE', fontWeight: '800' }}>{oppTeam.name}</Text>
                  </Text>
                </View>
              )}

              {/* Friend */}
              <Text style={[s.fieldLabel, { marginTop: 8 }]}>GEGN HVERJUM?</Text>
              {friends.length === 0 ? (
                <Text style={s.noFriends}>Engir vinir — bættu við í Prófíl flipanum</Text>
              ) : (
                friends.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.friendRow, selectedOpponent?.id === f.id && s.friendRowActive]}
                    onPress={() => setSelectedOpponent(f)}
                  >
                    <View style={s.friendAvatar}>
                      <Text style={s.friendAvatarText}>
                        {(f.full_name ?? f.username ?? '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{f.full_name ?? f.username}</Text>
                      <Text style={s.friendHandle}>@{f.username}</Text>
                    </View>
                    {selectedOpponent?.id === f.id && (
                      <View style={s.friendCheck}><Text style={s.friendCheckText}>✓</Text></View>
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* Exercise type */}
              <Text style={[s.fieldLabel, { marginTop: 8 }]}>ÆFING EF TAP</Text>
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
                  <Text style={[s.fieldLabel, { marginTop: 8 }]}>MAGN ({selectedExercise.unit.toUpperCase()})</Text>
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
                  : <Text style={s.submitBtnText}>Senda veðmál 🏆</Text>
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
function SeasonBetRow({ bet, myId }: { bet: any; myId: string }) {
  const isChallenger = bet.challenger_id === myId;
  const myPick  = isChallenger ? (bet.challenger_team?.name ?? bet.challenger_pick) : (bet.opponent_team?.name ?? bet.opponent_pick);
  const hisPick = isChallenger ? (bet.opponent_team?.name  ?? bet.opponent_pick)    : (bet.challenger_team?.name ?? bet.challenger_pick);
  const league  = bet.market?.league_name ?? '';
  const accent  = LEAGUE_COLOR[league] ?? '#21A56A';
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'Í bið',    color: '#FFC845', bg: 'rgba(255,200,69,0.1)'  },
    accepted: { label: 'Virkt',    color: '#47C4EE', bg: 'rgba(71,196,238,0.1)'  },
    settled:  { label: 'Gert upp', color: '#7a9aaa', bg: 'rgba(255,255,255,0.06)' },
    declined: { label: 'Hafnað',   color: '#ff4a6e', bg: 'rgba(255,74,110,0.1)'  },
  };
  const st = statusMap[bet.status] ?? statusMap.pending;
  const won = bet.winner_id === myId;
  const settled = bet.status === 'settled';
  const oppName = isChallenger
    ? (bet.opponent?.full_name ?? bet.opponent?.username ?? '?')
    : (bet.challenger?.full_name ?? bet.challenger?.username ?? '?');

  return (
    <View style={[s.betRow, settled && won && s.betRowWon, settled && !won && bet.loser_id === myId && s.betRowLost]}>
      <View style={s.betRowTop}>
        <View style={s.betRowTeams}>
          <Text style={[s.betRowMyPick, { color: accent }]}>{myPick ?? '—'}</Text>
          <Text style={s.betRowVs}>vs</Text>
          <Text style={s.betRowHisPick}>{hisPick ?? '—'}</Text>
        </View>
        <View style={[s.betStatus, { backgroundColor: st.bg }]}>
          <Text style={[s.betStatusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={s.betMeta}>{league} · Gegn: {oppName}</Text>
      {settled && (
        <Text style={[s.betResult, { color: won ? '#21A56A' : '#ff4a6e' }]}>
          {won ? '🏆 +5 stig' : '😅 0 stig'}
        </Text>
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

  // Bets
  betRow: {
    backgroundColor: '#0d2030', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, marginBottom: 10,
  },
  betRowWon: { borderColor: 'rgba(33,165,106,0.25)', backgroundColor: 'rgba(33,165,106,0.04)' },
  betRowLost: { borderColor: 'rgba(255,74,110,0.15)' },
  betRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  betRowTeams: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
  betRowMyPick: { fontSize: 14, fontWeight: '800' },
  betRowVs: { fontSize: 11, color: '#4a6878' },
  betRowHisPick: { fontSize: 14, fontWeight: '800', color: '#47C4EE' },
  betStatus: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  betStatusText: { fontSize: 10, fontWeight: '700' },
  betMeta: { fontSize: 11, color: '#4a6878' },
  betResult: { fontSize: 13, fontWeight: '800', marginTop: 6 },

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

  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d2030', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  friendRowActive: { borderColor: '#21A56A', backgroundColor: 'rgba(33,165,106,0.07)' },
  friendAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(33,165,106,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 13, fontWeight: '800', color: '#21A56A' },
  friendName: { fontSize: 14, fontWeight: '700', color: '#eef4f8' },
  friendHandle: { fontSize: 11, color: '#4a6878' },
  friendCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#21A56A', alignItems: 'center', justifyContent: 'center',
  },
  friendCheckText: { fontSize: 11, fontWeight: '800', color: '#000' },
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
