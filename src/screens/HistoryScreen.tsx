import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import BetReactions from '../components/BetReactions';

type HistoryBet = {
  id: string;
  status: string;
  winner_id: string | null;
  loser_id: string | null;
  challenger_id: string | null;
  exercise: string;
  amount: number;
  unit: string;
  settled_at: string | null;
  created_at: string;
  match: {
    kickoff_time: string;
    league_name: string;
    home_team: { name: string } | null;
    away_team: { name: string } | null;
    home_score: number | null;
    away_score: number | null;
  } | null;
  challenger: { username: string; full_name: string | null } | null;
  opponent:   { username: string; full_name: string | null } | null;
};

const PAGE = 20;

export default function HistoryScreen() {
  const { profile } = useAuth();
  const navigation  = useNavigation<any>();
  const { t }       = useLanguage();

  const [bets, setBets]       = useState<HistoryBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'won' | 'lost'>('all');

  useEffect(() => {
    setBets([]);
    setHasMore(true);
    fetchBets(0, true);
  }, [filter]);

  async function fetchBets(offset = 0, reset = false) {
    if (!profile?.id) return;
    if (offset === 0) setLoading(true); else setLoadingMore(true);

    let query = supabase
      .from('bets')
      .select(`
        id, status, winner_id, loser_id, challenger_id, exercise, amount, unit, settled_at, created_at,
        match:matches(kickoff_time, league_name, home_score, away_score,
          home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)),
        challenger:profiles!challenger_id(username, full_name),
        opponent:profiles!opponent_id(username, full_name)
      `)
      .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .eq('status', 'settled')
      .order('settled_at', { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (filter === 'won')  query = query.eq('winner_id', profile.id);
    if (filter === 'lost') query = query.eq('loser_id',  profile.id);

    const { data } = await query;
    const rows = (data as unknown as HistoryBet[]) ?? [];
    setBets(prev => reset ? rows : [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
    if (offset === 0) setLoading(false); else setLoadingMore(false);
  }

  function renderItem({ item }: { item: HistoryBet }) {
    const won  = item.winner_id === profile?.id;
    const other = item.challenger_id === profile?.id ? item.opponent : item.challenger;
    const otherName = (other as any)?.full_name ?? (other as any)?.username ?? '?';
    const matchName = item.match
      ? `${item.match.home_team?.name} – ${item.match.away_team?.name}`
      : '–';
    const score = item.match?.home_score != null && item.match?.away_score != null
      ? ` (${item.match.home_score}–${item.match.away_score})`
      : '';
    const date = item.settled_at
      ? new Date(item.settled_at).toLocaleDateString('is-IS', { day: 'numeric', month: 'short' })
      : '';

    return (
      <View style={s.row}>
        <View style={s.rowTop}>
          <View style={[s.resultDot, { backgroundColor: won ? '#21A56A' : '#ff4a6e' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.matchName} numberOfLines={1}>{matchName}{score}</Text>
            <Text style={s.subLine} numberOfLines={1}>
              vs {otherName} · {item.amount} {item.unit} {item.exercise}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.result, { color: won ? '#21A56A' : '#ff4a6e' }]}>
              {won ? t('profile_won') : t('profile_lost')}
            </Text>
            <Text style={s.date}>{date}</Text>
          </View>
        </View>
        {profile?.id && <BetReactions betId={item.id} userId={profile.id} />}
      </View>
    );
  }

  const wins   = bets.filter(b => b.winner_id === profile?.id).length;
  const losses = bets.filter(b => b.loser_id  === profile?.id).length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>← {t('common_back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('profile_recent')}</Text>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {(['all', 'won', 'lost'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f === 'all' ? t('matches_filter_all') : f === 'won' ? t('profile_wins') : t('profile_losses')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#21A56A" /></View>
      ) : (
        <FlatList
          data={bets}
          keyExtractor={b => b.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>{t('history_empty')}</Text>
            </View>
          }
          onEndReached={() => {
            if (hasMore && !loadingMore) fetchBets(bets.length);
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#21A56A" style={{ margin: 16 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  header:    { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn:   { marginBottom: 8 },
  backText:  { color: '#21A56A', fontSize: 14, fontWeight: '600' },
  title:     { fontSize: 28, fontWeight: '900', color: '#eef4f8' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#0d2030', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filterBtnActive: { backgroundColor: '#21A56A', borderColor: '#21A56A' },
  filterText:      { color: '#4a6878', fontSize: 13, fontWeight: '600' },
  filterTextActive:{ color: '#000' },
  list:      { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  matchName: { fontSize: 14, fontWeight: '700', color: '#eef4f8', marginBottom: 2 },
  subLine:   { fontSize: 12, color: '#4a6878' },
  result:    { fontSize: 13, fontWeight: '800' },
  date:      { fontSize: 11, color: '#4a6878', marginTop: 2 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:     { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#4a6878', fontSize: 15 },
});
