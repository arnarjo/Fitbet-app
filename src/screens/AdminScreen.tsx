// src/screens/AdminScreen.tsx
// In-app admin screen for match management (mobile admin)
// Only visible to users with admin role

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Match, Team, SeasonMarket } from '../types/database';

type Tab = 'matches' | 'settle' | 'markets';

const LEAGUES = ['Premier League', 'UEFA Champions League', 'Besta deild karla', 'Lengjudeild karla', '2. deild karla'];
const MARKET_TYPES = [
  { value: 'meistari',   label: '🏆 Meistari' },
  { value: 'fellur',     label: '⬇ Fellur' },
  { value: 'fer_upp',    label: '⬆ Fer upp' },
  { value: 'yfir_neðar', label: '⚔ Hvort lið endar ofar' },
];

export default function AdminScreen() {
  const { profile } = useAuth();
  const [tab, setTab]         = useState<Tab>('matches');

  if (!profile?.is_admin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#071D2A', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#ff4a6e', fontSize: 16, fontWeight: '700' }}>⛔ Aðgangur bannaður</Text>
      </SafeAreaView>
    );
  }
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams]     = useState<Team[]>([]);
  const [markets, setMarkets] = useState<SeasonMarket[]>([]);
  const [loading, setLoading] = useState(true);

  // Add match form
  const [showAddMatch, setShowAddMatch]   = useState(false);
  const [matchLeague, setMatchLeague]     = useState('');
  const [homeTeamId, setHomeTeamId]       = useState('');
  const [awayTeamId, setAwayTeamId]       = useState('');
  const [kickoff, setKickoff]             = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingMatch, setSavingMatch]     = useState(false);

  // Settle form
  const [settleMatch, setSettleMatch]     = useState<Match | null>(null);
  const [settleResult, setSettleResult]   = useState<'home'|'draw'|'away'|null>(null);
  const [homeScore, setHomeScore]         = useState('0');
  const [awayScore, setAwayScore]         = useState('0');
  const [settling, setSettling]           = useState(false);

  // Add market form
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [marketTitle, setMarketTitle]     = useState('');
  const [marketLeague]                    = useState('Besta deild karla');
  const [marketType, setMarketType]       = useState('meistari');
  const [marketYear]                      = useState('2026');
  const [marketTeams, setMarketTeams]     = useState('');
  const [savingMarket, setSavingMarket]   = useState(false);

  // Settle market form
  const [settleMarketData, setSettleMarketData] = useState<SeasonMarket | null>(null);
  const [selectedWinner, setSelectedWinner]     = useState<string | null>(null);
  const [settlingMarket, setSettlingMarket]     = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [m, t, mk] = await Promise.all([
      supabase.from('matches').select('*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)').order('kickoff_time', { ascending: false }).limit(30),
      supabase.from('teams').select('*').order('league_name').order('name'),
      supabase.from('season_markets').select('*').order('created_at', { ascending: false }),
    ]);
    setMatches(m.data as Match[] ?? []);
    setTeams(t.data as Team[] ?? []);
    setMarkets(mk.data as SeasonMarket[] ?? []);
    setLoading(false);
  }

  // ── Add match ──
  const filteredTeams = matchLeague ? teams.filter(t => t.league_name === matchLeague) : teams;

  async function saveMatch() {
    if (!matchLeague || !homeTeamId || !awayTeamId) {
      Alert.alert('Villa', 'Veldu deild, heimalið og útlið'); return;
    }
    if (homeTeamId === awayTeamId) {
      Alert.alert('Villa', 'Heimalið og útlið mega ekki vera sama lið'); return;
    }
    if (kickoff < new Date()) {
      Alert.alert('Villa', 'Upphafstími leiks má ekki vera í fortíðinni'); return;
    }
    setSavingMatch(true);
    const { error } = await supabase.from('matches').insert({
      home_team_id: homeTeamId, away_team_id: awayTeamId,
      league_name: matchLeague, kickoff_time: kickoff.toISOString(), status: 'upcoming',
    });
    setSavingMatch(false);
    if (error) { Alert.alert('Villa', error.message); return; }
    setShowAddMatch(false);
    setMatchLeague(''); setHomeTeamId(''); setAwayTeamId('');
    await fetchAll();
  }

  // ── Settle match ──
  async function confirmSettle() {
    if (!settleMatch || !settleResult) {
      Alert.alert('Villa', 'Veldu niðurstöðu leiks'); return;
    }
    setSettling(true);

    const { error: matchError } = await supabase.from('matches').update({
      status: 'finished', result: settleResult,
      home_score: parseInt(homeScore) || 0,
      away_score: parseInt(awayScore) || 0,
    }).eq('id', settleMatch.id);

    if (matchError) {
      setSettling(false);
      Alert.alert('Villa', `Ekki tókst að uppfæra leik: ${matchError.message}`);
      return;
    }

    const { data: betsToSettle, error: betsError } = await supabase
      .from('bets')
      .select('id, challenger_id, opponent_id, challenger:profiles!challenger_id(username, full_name), opponent:profiles!opponent_id(username, full_name)')
      .eq('match_id', settleMatch.id)
      .eq('status', 'accepted');

    if (betsError) {
      setSettling(false);
      Alert.alert('Villa', `Leikur uppfærður en ekki tókst að sækja veðmál: ${betsError.message}`);
      return;
    }

    const betIds = (betsToSettle ?? []).map(b => b.id);
    const matchName = `${settleMatch.home_team?.name ?? 'Heimalið'} vs ${settleMatch.away_team?.name ?? 'Útlið'}`;

    // Settle all bets in parallel
    const results = await Promise.all(
      betIds.map(id => supabase.rpc('settle_bet', { p_bet_id: id, p_match_result: settleResult }))
    );
    const settled = results.filter(r => !r.error).length;
    const failed  = results.filter(r =>  r.error).length;
    const settledIds = betIds.filter((_, i) => !results[i].error);

    // Fetch all updated bets in one query
    if (settledIds.length > 0) {
      const { data: updatedBets } = await supabase
        .from('bets').select('id, winner_id, loser_id').in('id', settledIds);

      const notifs: any[] = [];
      for (const b of updatedBets ?? []) {
        if (b.winner_id) notifs.push({ user_id: b.winner_id, type: 'bet_won', title: 'Þú vannst veðmálið! 🏆', body: `Leikurinn ${matchName} er búinn. Gangi þér vel!`, data: { type: 'bet_won', bet_id: b.id } });
        if (b.loser_id)  notifs.push({ user_id: b.loser_id,  type: 'bet_lost', title: 'Þú tapað veðmálinu 😅', body: `Leikurinn ${matchName} er búinn. Gangi þér betur næst!`, data: { type: 'bet_lost', bet_id: b.id } });
      }
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs);
    }

    setSettling(false);
    setSettleMatch(null); setSettleResult(null);

    if (failed > 0) {
      Alert.alert('Að hluta gert ⚠️', `${settled} veðmál uppgerð, ${failed} mistókust. Athugaðu handvirkt.`);
    } else {
      Alert.alert('Gert! ✅', `Leikur gerður upp. ${settled} veðmál uppgerð.`);
    }
    await fetchAll();
  }

  // ── Add market ──
  async function saveMarket() {
    const teamList = marketTeams.split(',').map(t => t.trim()).filter(Boolean);
    if (!marketTitle.trim() || teamList.length < 2) {
      Alert.alert('Villa', 'Titill og a.m.k. 2 lið þarf'); return;
    }
    setSavingMarket(true);
    const { error } = await supabase.from('season_markets').insert({
      title: marketTitle, league_name: marketLeague, market_type: marketType,
      season_year: parseInt(marketYear) || 2026,
      available_teams: teamList, status: 'open',
    });
    setSavingMarket(false);
    if (error) { Alert.alert('Villa', error.message); return; }
    setShowAddMarket(false);
    setMarketTitle(''); setMarketTeams('');
    await fetchAll();
  }

  async function lockMarket(id: string) {
    Alert.alert('Læsa markað?', 'Engin ný veðmál verða tekin á móti eftir þetta.', [
      { text: 'Hætta við', style: 'cancel' },
      { text: 'Læsa', onPress: async () => {
        const { error } = await supabase.from('season_markets').update({ status: 'locked' }).eq('id', id);
        if (error) { Alert.alert('Villa', error.message); return; }
        await fetchAll();
      }},
    ]);
  }

  async function confirmSettleMarket() {
    if (!settleMarketData || !selectedWinner) return;
    setSettlingMarket(true);

    const mk = settleMarketData;

    // Look up the winning team's UUID from the name (available_teams stores names,
    // but challenger_pick/opponent_pick store team UUIDs)
    const winningTeam   = teams.find(t => t.name === selectedWinner);
    const winningTeamId = winningTeam?.id ?? null;

    // Fetch all accepted season_bets for this market
    const { data: bets, error: betsError } = await supabase
      .from('season_bets')
      .select('id, challenger_id, opponent_id, challenger_pick, opponent_pick')
      .eq('market_id', mk.id)
      .eq('status', 'accepted');

    if (betsError) {
      setSettlingMarket(false);
      Alert.alert('Villa', betsError.message);
      return;
    }

    const now = new Date().toISOString();

    // Settle each bet — compare by team UUID
    for (const b of bets ?? []) {
      const challengerWins = winningTeamId ? b.challenger_pick === winningTeamId : false;
      const opponentWins   = winningTeamId ? b.opponent_pick   === winningTeamId : false;
      await supabase.from('season_bets').update({
        status:    'settled',
        winner_id: challengerWins ? b.challenger_id : opponentWins ? b.opponent_id : null,
        loser_id:  challengerWins ? b.opponent_id   : opponentWins ? b.challenger_id : null,
        settled_at: now,
      }).eq('id', b.id);
    }

    // Mark market settled (store team UUID in winning_team_id)
    await supabase.from('season_markets').update({
      status: 'settled',
      winning_team_id: winningTeamId,
      settled_at: now,
    }).eq('id', mk.id);

    // Update profile stats for winners and losers
    for (const b of bets ?? []) {
      const challengerWins = winningTeamId ? b.challenger_pick === winningTeamId : false;
      const opponentWins   = winningTeamId ? b.opponent_pick   === winningTeamId : false;
      const winnerId = challengerWins ? b.challenger_id : opponentWins ? b.opponent_id : null;
      const loserId  = challengerWins ? b.opponent_id   : opponentWins ? b.challenger_id : null;
      if (winnerId) await supabase.rpc('increment_wins', { p_user_id: winnerId });
      if (loserId)  await supabase.rpc('increment_losses', { p_user_id: loserId });
    }

    // Send notifications
    const notifs: any[] = [];
    for (const b of bets ?? []) {
      const challengerWins = winningTeamId ? b.challenger_pick === winningTeamId : false;
      const opponentWins   = winningTeamId ? b.opponent_pick   === winningTeamId : false;
      if (challengerWins) {
        notifs.push({ user_id: b.challenger_id, type: 'bet_won',  title: 'Þú vannst tímabilsveðmálið! 🏆', body: `${selectedWinner} vann. ${mk.title}`, data: { type: 'bet_won',  market_id: mk.id } });
        notifs.push({ user_id: b.opponent_id,   type: 'bet_lost', title: 'Þú tapðir tímabilsveðmálinu 😅',  body: `${selectedWinner} vann. ${mk.title}`, data: { type: 'bet_lost', market_id: mk.id } });
      } else if (opponentWins) {
        notifs.push({ user_id: b.opponent_id,   type: 'bet_won',  title: 'Þú vannst tímabilsveðmálið! 🏆', body: `${selectedWinner} vann. ${mk.title}`, data: { type: 'bet_won',  market_id: mk.id } });
        notifs.push({ user_id: b.challenger_id, type: 'bet_lost', title: 'Þú tapðir tímabilsveðmálinu 😅',  body: `${selectedWinner} vann. ${mk.title}`, data: { type: 'bet_lost', market_id: mk.id } });
      }
    }
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs);

    // Award season_bet_win achievement to winners
    const winnerIds = (bets ?? [])
      .map(b => {
        const cw = winningTeamId ? b.challenger_pick === winningTeamId : false;
        const ow = winningTeamId ? b.opponent_pick   === winningTeamId : false;
        return cw ? b.challenger_id : ow ? b.opponent_id : null;
      })
      .filter(Boolean) as string[];
    const uniqueWinners = [...new Set(winnerIds)];
    await Promise.all(uniqueWinners.map(id => supabase.rpc('award_achievement', { p_user_id: id, p_type: 'season_bet_win' })));

    setSettlingMarket(false);
    setSettleMarketData(null);
    setSelectedWinner(null);
    Alert.alert('Gert! ✅', `Markaðurinn „${mk.title}" gerður upp. ${(bets ?? []).length} veðmál uppgerð.`);
    await fetchAll();
  }

  async function deleteMarket(id: string, title: string) {
    Alert.alert(`Eyða „${title}"?`, 'Þetta eyðir markaðinum og öllum veðmálum á honum.', [
      { text: 'Hætta við', style: 'cancel' },
      { text: 'Eyða', style: 'destructive', onPress: async () => {
        await supabase.from('season_bets').delete().eq('market_id', id);
        const { error } = await supabase.from('season_markets').delete().eq('id', id);
        if (error) { Alert.alert('Villa', error.message); return; }
        await fetchAll();
      }},
    ]);
  }

  const pendingSettle = matches.filter(m => m.status === 'upcoming' && new Date(m.kickoff_time) < new Date());

  if (!profile || !profile.is_admin) return null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Admin</Text>
        <View style={[s.adminBadge]}>
          <Text style={s.adminBadgeText}>⚙ ADMIN</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['matches','settle','markets'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab===t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab===t && s.tabTextActive]}>
              {t==='matches' ? '⚽ Leikir' : t==='settle' ? `🏁 Uppgjör${pendingSettle.length>0 ? ` (${pendingSettle.length})` : ''}` : '📅 Markaðir'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingState}><ActivityIndicator color="#21A56A" size="large" /></View>
      ) : (
        <ScrollView style={s.list} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}>

          {/* ── MATCHES TAB ── */}
          {tab === 'matches' && (
            <>
              <TouchableOpacity style={s.addBtn} onPress={() => setShowAddMatch(true)}>
                <Text style={s.addBtnText}>+ Bæta við leik</Text>
              </TouchableOpacity>
              {matches.map(m => (
                <View key={m.id} style={s.matchRow}>
                  <View style={s.matchRowLeft}>
                    <Text style={s.matchRowTeams}>
                      {m.home_team?.short_name ?? '?'} vs {m.away_team?.short_name ?? '?'}
                    </Text>
                    <Text style={s.matchRowMeta}>{m.league_name} · {fmtDate(m.kickoff_time)}</Text>
                  </View>
                  <View style={[s.matchStatus, { backgroundColor: statusColor(m.status) + '20' }]}>
                    <Text style={[s.matchStatusText, { color: statusColor(m.status) }]}>
                      {m.status === 'finished' ? `${m.home_score}–${m.away_score}` : m.status === 'upcoming' ? 'Ókominn' : 'LIVE'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── SETTLE TAB ── */}
          {tab === 'settle' && (
            <>
              {pendingSettle.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyIcon}>✅</Text>
                  <Text style={s.emptyTitle}>Engir leikir bíða uppgjörs</Text>
                </View>
              ) : pendingSettle.map(m => (
                <View key={m.id} style={[s.matchRow, s.settleRow]}>
                  <View style={s.matchRowLeft}>
                    <Text style={s.matchRowTeams}>{m.home_team?.name ?? '?'} vs {m.away_team?.name ?? '?'}</Text>
                    <Text style={s.matchRowMeta}>{m.league_name} · {fmtDate(m.kickoff_time)}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.settleBtn}
                    onPress={() => { setSettleMatch(m); setSettleResult(null); setHomeScore('0'); setAwayScore('0'); }}
                  >
                    <Text style={s.settleBtnText}>Gera upp</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── MARKETS TAB ── */}
          {tab === 'markets' && (
            <>
              <TouchableOpacity style={s.addBtn} onPress={() => setShowAddMarket(true)}>
                <Text style={s.addBtnText}>+ Nýr markaður</Text>
              </TouchableOpacity>
              {markets.map(mk => (
                <View key={mk.id} style={s.marketRow}>
                  <View style={s.marketTop}>
                    <Text style={s.marketTitle}>{mk.title}</Text>
                    <View style={[s.marketStatus, { backgroundColor: mk.status==='open' ? 'rgba(33,165,106,0.12)' : mk.status==='locked' ? 'rgba(255,200,69,0.12)' : 'rgba(255,255,255,0.07)' }]}>
                      <Text style={[s.marketStatusText, { color: mk.status==='open' ? '#21A56A' : mk.status==='locked' ? '#FFC845' : '#7a9aaa' }]}>
                        {mk.status==='open' ? 'Opinn' : mk.status==='locked' ? 'Læstur' : 'Gert upp'}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.marketMeta}>{mk.league_name} · {mk.season_year}</Text>
                  <View style={s.marketActions}>
                    {mk.status === 'open' && (
                      <TouchableOpacity style={s.marketBtn} onPress={() => lockMarket(mk.id)}>
                        <Text style={[s.marketBtnText, { color: '#FFC845' }]}>🔒 Læsa</Text>
                      </TouchableOpacity>
                    )}
                    {mk.status === 'locked' && (
                      <TouchableOpacity style={s.marketBtn} onPress={() => { setSettleMarketData(mk); setSelectedWinner(null); }}>
                        <Text style={[s.marketBtnText, { color: '#21A56A' }]}>🏆 Gera upp</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.marketBtn} onPress={() => deleteMarket(mk.id, mk.title)}>
                      <Text style={[s.marketBtnText, { color: '#ff4a6e' }]}>🗑 Eyða</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── ADD MATCH MODAL ── */}
      <Modal visible={showAddMatch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMatch(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Bæta við leik</Text>
            <TouchableOpacity onPress={() => setShowAddMatch(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>DEILD</Text>
            <View style={s.optRow}>
              {LEAGUES.map(l => (
                <TouchableOpacity key={l} style={[s.optChip, matchLeague===l && s.optChipActive]} onPress={() => { setMatchLeague(l); setHomeTeamId(''); setAwayTeamId(''); }}>
                  <Text style={[s.optChipText, matchLeague===l && s.optChipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {matchLeague && (<>
              <Text style={s.fieldLabel}>HEIMALIÐ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={s.teamRow}>
                  {filteredTeams.map(t => (
                    <TouchableOpacity key={t.id} style={[s.teamChip, homeTeamId===t.id && s.teamChipActive, awayTeamId===t.id && s.teamChipDisabled]} onPress={() => homeTeamId===t.id ? setHomeTeamId('') : setHomeTeamId(t.id)} disabled={awayTeamId===t.id}>
                      <Text style={[s.teamChipText, homeTeamId===t.id && s.teamChipTextActive]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={s.fieldLabel}>ÚTLIÐ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={s.teamRow}>
                  {filteredTeams.map(t => (
                    <TouchableOpacity key={t.id} style={[s.teamChip, awayTeamId===t.id && s.teamChipActive, homeTeamId===t.id && s.teamChipDisabled]} onPress={() => awayTeamId===t.id ? setAwayTeamId('') : setAwayTeamId(t.id)} disabled={homeTeamId===t.id}>
                      <Text style={[s.teamChipText, awayTeamId===t.id && s.teamChipTextActive]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>)}
            <Text style={s.fieldLabel}>UPPSPRETTUTÍMI</Text>
            <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={s.dateBtnText}>{kickoff.toLocaleString('is-IS')}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={kickoff} mode="datetime" display="spinner" minimumDate={new Date()} onChange={(_, d) => { setShowDatePicker(false); if (d) setKickoff(d); }} />
            )}
            <TouchableOpacity style={[s.saveBtn, savingMatch && { opacity: 0.6 }]} onPress={saveMatch} disabled={savingMatch}>
              {savingMatch ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Vista leik ⚽</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── SETTLE MODAL ── */}
      <Modal visible={!!settleMatch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettleMatch(null)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Gera upp leik</Text>
            <TouchableOpacity onPress={() => setSettleMatch(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.settleMatchName}>
              {settleMatch?.home_team?.name} vs {settleMatch?.away_team?.name}
            </Text>
            <Text style={s.fieldLabel}>NIÐURSTAÐA</Text>
            <View style={s.resultRow}>
              {[
                { key:'home', label: settleMatch?.home_team?.name ?? 'Heimalið', selClass:'sel-home' },
                { key:'draw', label:'Jafntefli', selClass:'sel-draw' },
                { key:'away', label: settleMatch?.away_team?.name ?? 'Útlið', selClass:'sel-away' },
              ].map(r => (
                <TouchableOpacity key={r.key} style={[s.resultBtn, settleResult===r.key && (r.key==='home' ? s.resultBtnHome : r.key==='draw' ? s.resultBtnDraw : s.resultBtnAway)]} onPress={() => setSettleResult(r.key as any)}>
                  <Text style={[s.resultBtnText, settleResult===r.key && { color: r.key==='home'?'#21A56A':r.key==='draw'?'#FFC845':'#47C4EE' }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.scoreRow}>
              <View style={{ flex:1 }}>
                <Text style={s.fieldLabel}>HEIMAMARKAR</Text>
                <TextInput style={s.scoreInput} keyboardType="number-pad" value={homeScore} onChangeText={setHomeScore} maxLength={2} />
              </View>
              <Text style={s.scoreDash}>–</Text>
              <View style={{ flex:1 }}>
                <Text style={s.fieldLabel}>ÚTMARKAR</Text>
                <TextInput style={s.scoreInput} keyboardType="number-pad" value={awayScore} onChangeText={setAwayScore} maxLength={2} />
              </View>
            </View>
            <TouchableOpacity style={[s.saveBtn, settling && { opacity:0.6 }]} onPress={confirmSettle} disabled={settling}>
              {settling ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Gera upp og senda tilkynningar 🏆</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── SETTLE MARKET MODAL ── */}
      <Modal visible={!!settleMarketData} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSettleMarketData(null)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Gera upp markað</Text>
            <TouchableOpacity onPress={() => setSettleMarketData(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody}>
            <Text style={s.settleMatchName}>{settleMarketData?.title}</Text>
            <Text style={s.fieldLabel}>SIGURLIÐ / SIGURMAÐUR</Text>
            <View style={s.optRow}>
              {(settleMarketData?.available_teams ?? []).map(team => (
                <TouchableOpacity
                  key={team}
                  style={[s.optChip, selectedWinner === team && s.optChipActive]}
                  onPress={() => setSelectedWinner(team)}
                >
                  <Text style={[s.optChipText, selectedWinner === team && s.optChipTextActive]}>{team}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.saveBtn, (!selectedWinner || settlingMarket) && { opacity: 0.5 }]}
              onPress={confirmSettleMarket}
              disabled={!selectedWinner || settlingMarket}
            >
              {settlingMarket
                ? <ActivityIndicator color="#000" />
                : <Text style={s.saveBtnText}>Staðfesta og gera upp 🏆</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── ADD MARKET MODAL ── */}
      <Modal visible={showAddMarket} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMarket(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nýr markaður</Text>
            <TouchableOpacity onPress={() => setShowAddMarket(false)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>TITILL</Text>
            <TextInput style={s.textInput} value={marketTitle} onChangeText={setMarketTitle} placeholder="t.d. Besta deild 2026 – Meistari" placeholderTextColor="#2a4050" />
            <Text style={s.fieldLabel}>TEGUND</Text>
            <View style={s.optRow}>
              {MARKET_TYPES.map(mt => (
                <TouchableOpacity key={mt.value} style={[s.optChip, marketType===mt.value && s.optChipActive]} onPress={() => setMarketType(mt.value)}>
                  <Text style={[s.optChipText, marketType===mt.value && s.optChipTextActive]}>{mt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>LIÐ (aðskilið með kommu)</Text>
            <TextInput style={[s.textInput, { height: 60 }]} value={marketTeams} onChangeText={setMarketTeams} placeholder="ÍA, FH, Valur, Breiðablik, KR" placeholderTextColor="#2a4050" multiline />
            <TouchableOpacity style={[s.saveBtn, savingMarket && { opacity:0.6 }]} onPress={saveMarket} disabled={savingMarket}>
              {savingMarket ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>Búa til markað 📅</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('is-IS', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
function statusColor(s: string) {
  return s==='finished'?'#7a9aaa':s==='live'?'#ff4a6e':'#47C4EE';
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#071D2A' },
  header:{ flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:20, paddingTop:4, paddingBottom:10 },
  headerTitle:{ fontSize:28, fontWeight:'800', color:'#eef4f8' },
  adminBadge:{ backgroundColor:'rgba(168,85,247,0.15)', paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  adminBadgeText:{ fontSize:11, fontWeight:'800', color:'#a855f7' },
  tabRow:{ flexDirection:'row', paddingHorizontal:16, gap:8, marginBottom:12 },
  tab:{ flex:1, paddingVertical:9, borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', alignItems:'center' },
  tabActive:{ backgroundColor:'rgba(33,165,106,0.1)', borderColor:'rgba(33,165,106,0.3)' },
  tabText:{ fontSize:11, fontWeight:'700', color:'#4a6878' },
  tabTextActive:{ color:'#21A56A' },
  list:{ flex:1 },
  listContent:{ paddingHorizontal:16 },
  loadingState:{ flex:1, alignItems:'center', justifyContent:'center' },
  addBtn:{ backgroundColor:'#21A56A', borderRadius:12, padding:13, alignItems:'center', marginBottom:14 },
  addBtnText:{ color:'#000', fontWeight:'800', fontSize:14 },
  matchRow:{ flexDirection:'row', alignItems:'center', backgroundColor:'#0d2030', borderRadius:12, padding:14, marginBottom:8, gap:10 },
  settleRow:{ borderColor:'rgba(255,200,69,0.2)', borderWidth:1 },
  matchRowLeft:{ flex:1 },
  matchRowTeams:{ fontSize:14, fontWeight:'700', color:'#eef4f8' },
  matchRowMeta:{ fontSize:11, color:'#4a6878', marginTop:3 },
  matchStatus:{ paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  matchStatusText:{ fontSize:11, fontWeight:'700' },
  settleBtn:{ backgroundColor:'rgba(255,200,69,0.12)', borderWidth:1, borderColor:'rgba(255,200,69,0.25)', paddingHorizontal:14, paddingVertical:8, borderRadius:10 },
  settleBtnText:{ color:'#FFC845', fontWeight:'700', fontSize:12 },
  marketRow:{ backgroundColor:'#0d2030', borderRadius:12, padding:14, marginBottom:8 },
  marketTop:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  marketTitle:{ fontSize:14, fontWeight:'700', color:'#eef4f8', flex:1, marginRight:8 },
  marketStatus:{ paddingHorizontal:9, paddingVertical:3, borderRadius:20 },
  marketStatusText:{ fontSize:10, fontWeight:'700' },
  marketMeta:{ fontSize:11, color:'#4a6878', marginBottom:8 },
  marketActions:{ flexDirection:'row', gap:8 },
  marketBtn:{ backgroundColor:'rgba(255,200,69,0.08)', borderWidth:1, borderColor:'rgba(255,200,69,0.2)', paddingHorizontal:12, paddingVertical:7, borderRadius:10 },
  marketBtnText:{ fontSize:12, fontWeight:'700' },
  emptyState:{ alignItems:'center', paddingTop:60, gap:12 },
  emptyIcon:{ fontSize:44 },
  emptyTitle:{ fontSize:16, fontWeight:'700', color:'#eef4f8' },
  modal:{ flex:1, backgroundColor:'#071D2A' },
  modalHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.07)' },
  modalTitle:{ fontSize:20, fontWeight:'800', color:'#eef4f8' },
  modalClose:{ fontSize:20, color:'#4a6878', fontWeight:'700' },
  modalBody:{ padding:20 },
  fieldLabel:{ fontSize:10, fontWeight:'700', color:'#4a6878', letterSpacing:1.5, marginBottom:8 },
  optRow:{ flexDirection:'row', flexWrap:'wrap', gap:7, marginBottom:16 },
  optChip:{ backgroundColor:'#0d2030', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  optChipActive:{ backgroundColor:'rgba(33,165,106,0.1)', borderColor:'#21A56A' },
  optChipText:{ fontSize:12, fontWeight:'600', color:'#7a9aaa' },
  optChipTextActive:{ color:'#21A56A' },
  teamRow:{ flexDirection:'row', gap:7, paddingBottom:4 },
  teamChip:{ backgroundColor:'#0d2030', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', borderRadius:20, paddingHorizontal:14, paddingVertical:8 },
  teamChipActive:{ backgroundColor:'rgba(33,165,106,0.12)', borderColor:'#21A56A' },
  teamChipDisabled:{ opacity:0.3 },
  teamChipText:{ fontSize:13, fontWeight:'600', color:'#7a9aaa' },
  teamChipTextActive:{ color:'#21A56A' },
  dateBtn:{ backgroundColor:'#0d2030', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:12, padding:14, marginBottom:16 },
  dateBtnText:{ fontSize:14, color:'#eef4f8', fontWeight:'600' },
  saveBtn:{ backgroundColor:'#21A56A', borderRadius:14, padding:15, alignItems:'center', marginTop:8 },
  saveBtnText:{ color:'#000', fontWeight:'800', fontSize:15 },
  settleMatchName:{ fontSize:18, fontWeight:'800', color:'#eef4f8', marginBottom:18 },
  resultRow:{ gap:10, marginBottom:18 },
  resultBtn:{ backgroundColor:'#0d2030', borderWidth:1.5, borderColor:'rgba(255,255,255,0.08)', borderRadius:12, padding:14, alignItems:'center' },
  resultBtnHome:{ borderColor:'#21A56A', backgroundColor:'rgba(33,165,106,0.08)' },
  resultBtnDraw:{ borderColor:'#FFC845', backgroundColor:'rgba(255,200,69,0.08)' },
  resultBtnAway:{ borderColor:'#47C4EE', backgroundColor:'rgba(71,196,238,0.08)' },
  resultBtnText:{ fontSize:14, fontWeight:'700', color:'#7a9aaa' },
  scoreRow:{ flexDirection:'row', alignItems:'center', gap:14, marginBottom:18 },
  scoreDash:{ fontSize:24, color:'#4a6878', fontWeight:'800', marginTop:16 },
  scoreInput:{ backgroundColor:'#0d2030', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:12, padding:14, color:'#eef4f8', fontSize:22, fontWeight:'800', textAlign:'center' },
  textInput:{ backgroundColor:'#0d2030', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', borderRadius:12, padding:14, color:'#eef4f8', fontSize:14, marginBottom:14 },
});
