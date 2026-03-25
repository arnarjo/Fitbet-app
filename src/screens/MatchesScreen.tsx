// src/screens/MatchesScreen.tsx
// Full matches screen wiring MatchCard + BetModal together

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MatchCard from '../components/MatchCard';
import BetModal from '../components/BetModal';
import { useMatches } from '../hooks/useMatches';
import { useBets } from '../hooks/useBets';
import { useAuth } from '../hooks/useAuth';
import type { Match, MatchResult } from '../types/database';

const LEAGUES = [
  { key: 'all', label: 'Allir' },
  { key: 'Premier League', label: 'Premier League' },
  { key: 'UEFA Champions League', label: 'Champions Lg' },
  { key: 'Besta deild karla', label: 'Besta deild' },
  { key: 'Lengjudeild karla', label: 'Lengjudeild' },
  { key: '2. deild karla', label: '2. deild' },
];

export default function MatchesScreen() {
  const { profile } = useAuth();
  const [activeLeague, setActiveLeague] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // BetModal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);

  const league = activeLeague === 'all' ? undefined : activeLeague;
  const { matches, loading, refetch } = useMatches(league);
  const { createBet } = useBets(profile?.id ?? '');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function handleBetPress(match: Match, prediction: MatchResult) {
    setSelectedMatch(match);
    setSelectedPrediction(prediction);
    setModalVisible(true);
  }

  async function handleSubmitBet(
    matchId: string,
    opponentId: string,
    prediction: MatchResult,
    exercise: string,
    amount: number,
    unit: string,
  ) {
    return createBet(matchId, opponentId, prediction, exercise, amount, unit);
  }

  // Group matches by date
  const today = new Date().toDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toDateString();

  const todayMatches = matches.filter(m => new Date(m.kickoff_time).toDateString() === today);
  const tomorrowMatches = matches.filter(m => new Date(m.kickoff_time).toDateString() === tomorrowStr);
  const laterMatches = matches.filter(m => {
    const d = new Date(m.kickoff_time).toDateString();
    return d !== today && d !== tomorrowStr;
  });

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Leikir</Text>
      </View>

      {/* League filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContent}
      >
        {LEAGUES.map((lg) => (
          <TouchableOpacity
            key={lg.key}
            style={[s.tab, activeLeague === lg.key && s.tabActive]}
            onPress={() => setActiveLeague(lg.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, activeLeague === lg.key && s.tabTextActive]}>
              {lg.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Matches list */}
      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />
        }
      >
        {loading && matches.length === 0 ? (
          <View style={s.loadingState}>
            <Text style={s.loadingText}>Hleður leikjum...</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>Engir leikir í boði</Text>
            <Text style={s.emptySub}>Admin bætir við leikjum í stjórnborðinu</Text>
          </View>
        ) : (
          <>
            {todayMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>Í DAG</Text>
                {todayMatches.map(m => (
                  <MatchCard key={m.id} match={m} onBetPress={handleBetPress} />
                ))}
              </View>
            )}
            {tomorrowMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>Á MORGUN</Text>
                {tomorrowMatches.map(m => (
                  <MatchCard key={m.id} match={m} onBetPress={handleBetPress} />
                ))}
              </View>
            )}
            {laterMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>SÍÐAR</Text>
                {laterMatches.map(m => (
                  <MatchCard key={m.id} match={m} onBetPress={handleBetPress} />
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bet Modal */}
      <BetModal
        visible={modalVisible}
        match={selectedMatch}
        initialPrediction={selectedPrediction}
        currentUserId={profile?.id ?? ''}
        onClose={() => { setModalVisible(false); setSelectedMatch(null); setSelectedPrediction(null); }}
        onSubmit={handleSubmitBet}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f0f0f8',
  },
  tabsScroll: { flexGrow: 0 },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: {
    backgroundColor: '#00e5a0',
    borderColor: '#00e5a0',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9090aa',
  },
  tabTextActive: { color: '#000' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5a5a72',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  loadingState: { alignItems: 'center', paddingTop: 80 },
  loadingText: { color: '#5a5a72', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0f0f8' },
  emptySub: { fontSize: 13, color: '#5a5a72', textAlign: 'center' },
});
