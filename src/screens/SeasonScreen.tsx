// src/screens/SeasonScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { usePremium } from '../hooks/usePremium';
import type { SeasonMarket, SeasonBet, Profile } from '../types/database';
import { MARKET_TYPE_LABELS } from '../types/database';

const MARKET_COLORS: Record<string, { accent: string; bg: string }> = {
  meistari:   { accent: '#ffc940', bg: 'rgba(255,201,64,0.12)'  },
  fellur:     { accent: '#ff4a6e', bg: 'rgba(255,74,110,0.12)'  },
  fer_upp:    { accent: '#3d8bff', bg: 'rgba(61,139,255,0.12)'  },
  yfir_neðar: { accent: '#00e5a0', bg: 'rgba(0,229,160,0.1)'    },
};

export default function SeasonScreen() {
  const { profile } = useAuth();
  const { canAccessLeague } = usePremium();
  const navigation = useNavigation<any>();
  const [markets, setMarkets]         = useState<SeasonMarket[]>([]);
  const [myBets, setMyBets]           = useState<SeasonBet[]>([]);
  const [friends, setFriends]         = useState<Profile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [activeTab, setActiveTab]     = useState<'open' | 'mybets'>('open');

  // Bet modal state
  const [betModal, setBetModal]       = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<SeasonMarket | null>(null);
  const [selectedTeam, setSelectedTeam]     = useState<string | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<Profile | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);

  const CHALLENGES = [
    '🏃 5 km hlaup', '🏃 10 km hlaup',
    '💪 50 armbeygjur', '💪 100 armbeygjur',
    '🦵 100 hnébeygjur', '🔥 25 burpees',
  ];

  useEffect(() => {
    fetchAll();
  }, [profile?.id]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchMarkets(), fetchMyBets(), fetchFriends()]);
    setLoading(false);
  }

  async function fetchMarkets() {
    const { data } = await supabase
      .from('season_markets')
      .select('*')
      .in('status', ['open', 'locked'])
      .order('created_at', { ascending: false });
    setMarkets((data ?? []) as SeasonMarket[]);
  }

  async function fetchMyBets() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('season_bets')
      .select('*, market:season_markets(*), challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*)')
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
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [profile?.id]);

  function openBetModal(market: SeasonMarket) {
    if (!canAccessLeague(market.league_name)) {
      navigation.navigate('Paywall', { feature: 'general' });
      return;
    }
    if (market.status === 'locked') {
      Alert.alert('Markaður læstur', 'Þessi markaður tekur ekki við fleiri veðmálum.');
      return;
    }
    setSelectedMarket(market);
    setSelectedTeam(null);
    setSelectedOpponent(null);
    setSelectedChallenge(null);
    setBetModal(true);
  }

  async function submitBet() {
    if (!selectedMarket || !selectedTeam || !selectedOpponent || !selectedChallenge) return;
    setSubmitting(true);

    const { error } = await supabase.from('season_bets').insert({
      market_id: selectedMarket.id,
      challenger_id: profile!.id,
      opponent_id: selectedOpponent.id,
      challenger_pick: selectedTeam,
      status: 'pending',
    });

    if (!error) {
      await supabase.from('notifications').insert({
        user_id: selectedOpponent.id,
        type: 'bet_received',
        title: 'Ný tímabilsveðmálsbeiðni! 📅',
        body: `${profile!.full_name ?? profile!.username} boðar þig í tímabilsveðmál.`,
        data: { market_id: selectedMarket.id },
      });
      setBetModal(false);
      await fetchMyBets();
      Alert.alert('Veðmál sent! 🏆', `Beiðni send til ${selectedOpponent.full_name ?? selectedOpponent.username}`);
    } else {
      Alert.alert('Villa', error.message);
    }
    setSubmitting(false);
  }

  const openMarkets  = markets.filter(m => m.status === 'open');
  const lockedMarkets = markets.filter(m => m.status === 'locked');
  const col = (type: string) => MARKET_COLORS[type] ?? MARKET_COLORS.meistari;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Tímabilsveðmál</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, activeTab==='open' && s.tabActive]} onPress={() => setActiveTab('open')}>
          <Text style={[s.tabText, activeTab==='open' && s.tabTextActive]}>Opnir markaðir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab==='mybets' && s.tabActive]} onPress={() => setActiveTab('mybets')}>
          <Text style={[s.tabText, activeTab==='mybets' && s.tabTextActive]}>
            Veðmál mín ({myBets.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />}
      >
        {loading ? (
          <ActivityIndicator color="#00e5a0" style={{ marginTop: 60 }} />

        ) : activeTab === 'open' ? (
          <>
            {openMarkets.length === 0 && lockedMarkets.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📅</Text>
                <Text style={s.emptyTitle}>Engir markaðir opnir</Text>
                <Text style={s.emptySub}>Admin bætir við tímabilsveðmálum þegar keppnin hefst</Text>
              </View>
            ) : (
              <>
                {openMarkets.length > 0 && (
                  <>
                    <Text style={s.groupLabel}>OPNIR</Text>
                    {openMarkets.map(m => (
                      <MarketCard key={m.id} market={m} premiumLocked={!canAccessLeague(m.league_name)} onBet={() => openBetModal(m)} />
                    ))}
                  </>
                )}
                {lockedMarkets.length > 0 && (
                  <>
                    <Text style={[s.groupLabel, { marginTop: 8 }]}>LÆSTIR — LOKAÐ Á NÝ VEÐMÁL</Text>
                    {lockedMarkets.map(m => (
                      <MarketCard key={m.id} market={m} premiumLocked={!canAccessLeague(m.league_name)} onBet={() => openBetModal(m)} />
                    ))}
                  </>
                )}
              </>
            )}

          </>
        ) : (
          <>
            {myBets.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🎯</Text>
                <Text style={s.emptyTitle}>Engin tímabilsveðmál</Text>
                <Text style={s.emptySub}>Veðjaðu á opna markaði til vinstri</Text>
              </View>
            ) : (
              myBets.map(bet => (
                <SeasonBetRow key={bet.id} bet={bet} myId={profile?.id ?? ''} />
              ))
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Bet Modal ── */}
      <Modal visible={betModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBetModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Veðja á markað</Text>
            <TouchableOpacity onPress={() => setBetModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectedMarket && (
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <View style={[s.marketSummary, { borderColor: col(selectedMarket.market_type).accent + '40' }]}>
                <Text style={[s.marketSummaryType, { color: col(selectedMarket.market_type).accent }]}>
                  {MARKET_TYPE_LABELS[selectedMarket.market_type as keyof typeof MARKET_TYPE_LABELS]}
                </Text>
                <Text style={s.marketSummaryTitle}>{selectedMarket.title}</Text>
                <Text style={s.marketSummaryLeague}>{selectedMarket.league_name} · {selectedMarket.season_year}</Text>
              </View>

              {/* Pick team */}
              {selectedMarket.market_type === 'yfir_neðar' ? (
                <>
                  <Text style={s.fieldLabel}>HVORT LIÐ ENDAR HÆRRA?</Text>
                  <View style={s.h2hPickRow}>
                    {(selectedMarket.available_teams ?? []).slice(0, 2).map((team, idx) => {
                      const isSel = selectedTeam === team;
                      return (
                        <TouchableOpacity
                          key={team}
                          style={[s.h2hPickBtn, isSel && s.h2hPickBtnActive]}
                          onPress={() => setSelectedTeam(team)}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.h2hPickLabel, isSel && { color: '#00e5a0' }]}>{team}</Text>
                          <Text style={s.h2hPickSub}>{idx === 0 ? 'Lið 1' : 'Lið 2'}</Text>
                          {isSel && <View style={s.h2hPickCheck}><Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>✓</Text></View>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.fieldLabel}>VELDU LIÐ</Text>
                  <View style={s.teamGrid}>
                    {(selectedMarket.available_teams ?? []).map(team => (
                      <TouchableOpacity
                        key={team}
                        style={[s.teamChip, selectedTeam === team && {
                          borderColor: col(selectedMarket.market_type).accent,
                          backgroundColor: col(selectedMarket.market_type).bg,
                        }]}
                        onPress={() => setSelectedTeam(team)}
                      >
                        <Text style={[s.teamChipText, selectedTeam === team && {
                          color: col(selectedMarket.market_type).accent,
                        }]}>{team}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Pick opponent */}
              <Text style={s.fieldLabel}>GEGN HVERJUM?</Text>
              {friends.length === 0 ? (
                <Text style={s.noFriends}>Engir vinir — bættu við vinum í Vinir flipanum</Text>
              ) : (
                friends.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.friendRow, selectedOpponent?.id === f.id && s.friendRowActive]}
                    onPress={() => setSelectedOpponent(f)}
                  >
                    <View style={s.friendAvatar}>
                      <Text style={s.friendAvatarText}>
                        {(f.full_name ?? f.username ?? '?').split(' ').map((n: string) => n[0]).slice(0,2).join('').toUpperCase()}
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

              {/* Pick challenge */}
              <Text style={s.fieldLabel}>ÁSKORUN EF TAPARI</Text>
              <View style={s.challengeGrid}>
                {CHALLENGES.map(ch => (
                  <TouchableOpacity
                    key={ch}
                    style={[s.challengeChip, selectedChallenge === ch && s.challengeChipActive]}
                    onPress={() => setSelectedChallenge(ch)}
                  >
                    <Text style={[s.challengeChipText, selectedChallenge === ch && s.challengeChipTextActive]}>
                      {ch}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.submitBtn,
                  (!selectedTeam || !selectedOpponent || !selectedChallenge) && { opacity: 0.4 },
                ]}
                onPress={submitBet}
                disabled={!selectedTeam || !selectedOpponent || !selectedChallenge || submitting}
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

// ── MarketCard ────────────────────────────────────────────────
function MarketCard({ market, premiumLocked, onBet }: { market: SeasonMarket; premiumLocked?: boolean; onBet: () => void }) {
  if (market.market_type === 'yfir_neðar') {
    return <H2HMarketCard market={market} premiumLocked={premiumLocked} onBet={onBet} />;
  }
  const col = MARKET_COLORS[market.market_type] ?? MARKET_COLORS.meistari;
  const isLocked = market.status === 'locked';
  return (
    <View style={[s.marketCard, { borderColor: isLocked ? 'rgba(255,201,64,0.15)' : col.accent + '25' }, premiumLocked && s.marketCardPremium]}>
      <View style={s.marketTop}>
        <View style={[s.marketTypeBadge, { backgroundColor: col.bg }]}>
          <Text style={[s.marketTypeBadgeText, { color: col.accent }]}>
            {MARKET_TYPE_LABELS[market.market_type as keyof typeof MARKET_TYPE_LABELS] ?? market.market_type}
          </Text>
        </View>
        {premiumLocked ? (
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeText}>👑 Premium</Text>
          </View>
        ) : (
          <View style={[s.marketStatusBadge, isLocked
            ? { backgroundColor: 'rgba(255,201,64,0.1)' }
            : { backgroundColor: 'rgba(0,229,160,0.1)' }
          ]}>
            <Text style={[s.marketStatusText, isLocked ? { color: '#ffc940' } : { color: '#00e5a0' }]}>
              {isLocked ? '🔒 Læstur' : 'Opinn'}
            </Text>
          </View>
        )}
      </View>
      <Text style={s.marketTitle}>{market.title}</Text>
      <Text style={s.marketMeta}>{market.league_name} · {market.season_year}</Text>
      <View style={s.teamPills}>
        {(market.available_teams ?? []).slice(0, 6).map(t => (
          <View key={t} style={s.teamPill}><Text style={s.teamPillText}>{t}</Text></View>
        ))}
        {(market.available_teams ?? []).length > 6 && (
          <View style={s.teamPill}>
            <Text style={s.teamPillText}>+{(market.available_teams ?? []).length - 6}</Text>
          </View>
        )}
      </View>
      {premiumLocked ? (
        <TouchableOpacity style={s.premiumBtn} onPress={onBet}>
          <Text style={s.premiumBtnText}>👑 Fá Premium til að veðja →</Text>
        </TouchableOpacity>
      ) : !isLocked ? (
        <TouchableOpacity style={[s.betBtn, { backgroundColor: col.accent }]} onPress={onBet}>
          <Text style={s.betBtnText}>Veðja →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Head-to-head card for yfir_neðar markets ─────────────────
function H2HMarketCard({ market, premiumLocked, onBet }: { market: SeasonMarket; premiumLocked?: boolean; onBet: () => void }) {
  const isLocked = market.status === 'locked';
  const teams = market.available_teams ?? [];
  const teamA = teams[0] ?? '?';
  const teamB = teams[1] ?? '?';
  return (
    <View style={[s.h2hCard, premiumLocked && s.marketCardPremium]}>
      {/* Header row */}
      <View style={s.h2hHeader}>
        <View style={s.h2hBadge}>
          <Text style={s.h2hBadgeText}>⚔ Hvort endar hærra?</Text>
        </View>
        {premiumLocked ? (
          <View style={s.premiumBadge}>
            <Text style={s.premiumBadgeText}>👑 Premium</Text>
          </View>
        ) : (
          <View style={[s.marketStatusBadge, isLocked
            ? { backgroundColor: 'rgba(255,201,64,0.1)' }
            : { backgroundColor: 'rgba(0,229,160,0.1)' }
          ]}>
            <Text style={[s.marketStatusText, isLocked ? { color: '#ffc940' } : { color: '#00e5a0' }]}>
              {isLocked ? '🔒 Læstur' : 'Opinn'}
            </Text>
          </View>
        )}
      </View>

      <Text style={s.h2hTitle}>{market.title}</Text>
      <Text style={s.h2hMeta}>{market.league_name} · {market.season_year}</Text>

      {/* Teams side by side */}
      <View style={s.h2hTeams}>
        <View style={s.h2hTeamBox}>
          <Text style={s.h2hTeamName} numberOfLines={2}>{teamA}</Text>
          <Text style={s.h2hTeamSub}>Lið 1</Text>
        </View>
        <View style={s.h2hVs}>
          <Text style={s.h2hVsText}>VS</Text>
        </View>
        <View style={[s.h2hTeamBox, { alignItems: 'flex-end' }]}>
          <Text style={[s.h2hTeamName, { textAlign: 'right' }]} numberOfLines={2}>{teamB}</Text>
          <Text style={s.h2hTeamSub}>Lið 2</Text>
        </View>
      </View>

      {premiumLocked ? (
        <TouchableOpacity style={s.premiumBtn} onPress={onBet} activeOpacity={0.85}>
          <Text style={s.premiumBtnText}>👑 Fá Premium til að veðja →</Text>
        </TouchableOpacity>
      ) : !isLocked ? (
        <TouchableOpacity style={s.h2hBtn} onPress={onBet} activeOpacity={0.85}>
          <Text style={s.h2hBtnText}>Veðja á hvort endar hærra →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── SeasonBetRow ─────────────────────────────────────────────
function SeasonBetRow({ bet, myId }: { bet: any; myId: string }) {
  const isChallenger = bet.challenger_id === myId;
  const myPick   = isChallenger ? bet.challenger_pick : bet.opponent_pick;
  const col = MARKET_COLORS[bet.market?.market_type] ?? MARKET_COLORS.meistari;
  const statusMap: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: 'Í bið',     color: '#ffc940', bg: 'rgba(255,201,64,0.1)' },
    accepted: { label: 'Virkt',     color: '#3d8bff', bg: 'rgba(61,139,255,0.1)' },
    settled:  { label: 'Gert upp',  color: '#9090aa', bg: 'rgba(255,255,255,0.06)' },
    declined: { label: 'Hafnað',    color: '#ff4a6e', bg: 'rgba(255,74,110,0.1)' },
  };
  const st = statusMap[bet.status] ?? statusMap.pending;
  const won = bet.winner_id === myId;
  const settled = bet.status === 'settled';

  return (
    <View style={[s.betRow, settled && won && s.betRowWon, settled && !won && bet.loser_id === myId && s.betRowLost]}>
      <View style={s.betRowTop}>
        <Text style={s.betRowTitle} numberOfLines={1}>{bet.market?.title ?? 'Markaður'}</Text>
        <View style={[s.betRowStatus, { backgroundColor: st.bg }]}>
          <Text style={[s.betRowStatusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <View style={s.betRowMeta}>
        <View style={[s.betRowPick, { backgroundColor: col.bg }]}>
          <Text style={[s.betRowPickText, { color: col.accent }]}>
            Spá: {myPick ?? '—'}
          </Text>
        </View>
        <Text style={s.betRowOpponent}>
          Gegn: {isChallenger
            ? (bet.opponent?.full_name ?? bet.opponent?.username ?? '?')
            : (bet.challenger?.full_name ?? bet.challenger?.username ?? '?')
          }
        </Text>
      </View>
      {settled && (
        <Text style={[s.betRowResult, { color: won ? '#00e5a0' : '#ff4a6e' }]}>
          {won ? '🏆 +5 stig' : '😅 0 stig'}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f0f0f8' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(0,229,160,0.1)', borderColor: 'rgba(0,229,160,0.3)' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#5a5a72' },
  tabTextActive: { color: '#00e5a0' },
  scroll: { paddingHorizontal: 16 },
  groupLabel: { fontSize: 10, fontWeight: '700', color: '#5a5a72', letterSpacing: 1.5, marginBottom: 8 },
  empty: { alignItems: 'center', paddingTop: 72, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f0f0f8' },
  emptySub: { fontSize: 13, color: '#5a5a72', textAlign: 'center', paddingHorizontal: 24 },
  marketCard: {
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12,
  },
  marketTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  marketTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  marketTypeBadgeText: { fontSize: 10, fontWeight: '800' },
  marketStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  marketStatusText: { fontSize: 10, fontWeight: '700' },
  marketTitle: { fontSize: 16, fontWeight: '800', color: '#f0f0f8', marginBottom: 4 },
  marketMeta: { fontSize: 11, color: '#5a5a72', marginBottom: 10 },
  teamPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  teamPill: { backgroundColor: '#22222f', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  teamPillText: { fontSize: 11, fontWeight: '600', color: '#9090aa' },
  betBtn: { borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  betBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  marketCardPremium: { opacity: 0.75, borderColor: 'rgba(255,201,64,0.2)' },
  premiumBadge: { backgroundColor: 'rgba(255,201,64,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  premiumBadgeText: { fontSize: 10, fontWeight: '800', color: '#ffc940' },
  premiumBtn: {
    backgroundColor: 'rgba(255,201,64,0.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,201,64,0.3)',
    paddingVertical: 11, alignItems: 'center',
  },
  premiumBtnText: { fontSize: 13, fontWeight: '800', color: '#ffc940' },
  betRow: {
    backgroundColor: '#1a1a24', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, marginBottom: 10,
  },
  betRowWon: { borderColor: 'rgba(0,229,160,0.25)', backgroundColor: 'rgba(0,229,160,0.04)' },
  betRowLost: { borderColor: 'rgba(255,74,110,0.15)' },
  betRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  betRowTitle: { fontSize: 14, fontWeight: '700', color: '#f0f0f8', flex: 1, marginRight: 8 },
  betRowStatus: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  betRowStatusText: { fontSize: 10, fontWeight: '700' },
  betRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  betRowPick: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  betRowPickText: { fontSize: 11, fontWeight: '700' },
  betRowOpponent: { fontSize: 11, color: '#5a5a72' },
  betRowResult: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  modal: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#f0f0f8' },
  modalClose: { fontSize: 20, color: '#5a5a72', fontWeight: '700' },
  modalBody: { padding: 20 },
  marketSummary: { backgroundColor: '#1a1a24', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 20 },
  marketSummaryType: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  marketSummaryTitle: { fontSize: 16, fontWeight: '800', color: '#f0f0f8', marginBottom: 2 },
  marketSummaryLeague: { fontSize: 11, color: '#5a5a72' },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#5a5a72', letterSpacing: 1.5, marginBottom: 10 },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  teamChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1a1a24' },
  teamChipText: { fontSize: 13, fontWeight: '700', color: '#9090aa' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a24', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, marginBottom: 8 },
  friendRowActive: { borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.07)' },
  friendAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,229,160,0.15)', alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { fontSize: 13, fontWeight: '800', color: '#00e5a0' },
  friendName: { fontSize: 14, fontWeight: '700', color: '#f0f0f8' },
  friendHandle: { fontSize: 11, color: '#5a5a72' },
  friendCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00e5a0', alignItems: 'center', justifyContent: 'center' },
  friendCheckText: { fontSize: 11, fontWeight: '800', color: '#000' },
  noFriends: { fontSize: 13, color: '#5a5a72', textAlign: 'center', marginBottom: 16 },
  challengeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  challengeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#1a1a24' },
  challengeChipActive: { borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.1)' },
  challengeChipText: { fontSize: 12, fontWeight: '600', color: '#9090aa' },
  challengeChipTextActive: { color: '#00e5a0' },
  submitBtn: { backgroundColor: '#00e5a0', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // H2H card
  h2hCard: {
    backgroundColor: '#1a1a24', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(0,229,160,0.2)',
    padding: 18, marginBottom: 14,
  },
  h2hHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  h2hBadge: { backgroundColor: 'rgba(0,229,160,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  h2hBadgeText: { fontSize: 11, fontWeight: '800', color: '#00e5a0' },
  h2hTitle: { fontSize: 18, fontWeight: '900', color: '#f0f0f8', marginBottom: 3 },
  h2hMeta: { fontSize: 11, color: '#5a5a72', marginBottom: 16 },
  h2hTeams: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111118', borderRadius: 14,
    padding: 16, marginBottom: 16, gap: 8,
  },
  h2hTeamBox: { flex: 1 },
  h2hTeamName: { fontSize: 17, fontWeight: '900', color: '#f0f0f8', lineHeight: 22 },
  h2hTeamSub: { fontSize: 10, color: '#5a5a72', marginTop: 4, fontWeight: '600' },
  h2hVs: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#22222f', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  h2hVsText: { fontSize: 10, fontWeight: '900', color: '#5a5a72' },
  h2hBtn: {
    backgroundColor: '#00e5a0', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  h2hBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },

  // H2H bet modal picker
  h2hPickRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  h2hPickBtn: {
    flex: 1, backgroundColor: '#111118', borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 20, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  h2hPickBtnActive: {
    borderColor: '#00e5a0',
    backgroundColor: 'rgba(0,229,160,0.07)',
  },
  h2hPickLabel: { fontSize: 15, fontWeight: '800', color: '#f0f0f8', textAlign: 'center', marginBottom: 4 },
  h2hPickSub: { fontSize: 10, fontWeight: '600', color: '#5a5a72', textAlign: 'center' },
  h2hPickCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#00e5a0', alignItems: 'center', justifyContent: 'center',
  },
});
