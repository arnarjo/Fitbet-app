import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MatchCard from '../components/MatchCard';
import BetModal from '../components/BetModal';
import { useMatches } from '../hooks/useMatches';
import { useBets } from '../hooks/useBets';
import { useAuth } from '../hooks/useAuth';
import { usePremium, PREMIUM_LEAGUES } from '../hooks/usePremium';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../hooks/useLanguage';
import type { Match, MatchResult, Exercise } from '../types/database';

const LEAGUES = [
  { key: 'all', label: 'Allir' },
  { key: 'Besta deild karla', label: 'Besta deildin' },
  { key: 'Lengjudeild karla', label: 'Lengjudeildin' },
  { key: 'Premier League', label: 'Premier League' },
  { key: 'UEFA Champions League', label: 'Champions Lg' },
  { key: 'FIFA World Cup', label: 'World Cup' },
];

export default function MatchesScreen() {
  const { profile } = useAuth();
  const { canAccessLeague } = usePremium();
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [activeLeague, setActiveLeague] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);

  const league = activeLeague === 'all' ? undefined : activeLeague;
  const { matches, loading, error, refetch } = useMatches(league);
  const { createBet } = useBets(profile?.id ?? '');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  function handleOpenBet(match: Match) {
    if (new Date() >= new Date(match.kickoff_time)) {
      Alert.alert(t('matches_started'), t('matches_started_msg'));
      return;
    }
    if (!canAccessLeague(match.league_name)) {
      navigation.navigate('Paywall', { feature: 'general' });
      return;
    }
    setSelectedMatch(match);
    setSelectedPrediction(null);
    setModalVisible(true);
  }

  async function handleSubmitBet(
    matchId: string,
    opponentId: string,
    prediction: MatchResult,
    exercise: Exercise,
    amount: number,
    unit: string,
  ) {
    if (selectedMatch && PREMIUM_LEAGUES.includes(selectedMatch.league_name)) {
      const { data: opp } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', opponentId)
        .single();
      if (!opp?.is_admin) {
        Alert.alert(
          'Vinurinn þinn er ekki með premium 🔒',
          'Báðir þurfa að vera með premium áskrift til að geta veðjað á þessa deild.',
        );
        return { error: new Error('opponent_not_premium') };
      }
    }
    const { bet, error } = await createBet(matchId, opponentId, prediction, exercise, amount, unit);
    return { error, betId: bet?.id };
  }

  // Use UTC date strings for bucketing — kickoff_time from Supabase is always UTC ISO
  const todayUTC    = new Date().toISOString().slice(0, 10);
  const tomorrowUTC = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const todayMatches    = matches.filter((m) => m.kickoff_time.slice(0, 10) === todayUTC);
  const tomorrowMatches = matches.filter((m) => m.kickoff_time.slice(0, 10) === tomorrowUTC);
  const laterMatches    = matches.filter((m) => {
    const d = m.kickoff_time.slice(0, 10);
    return d !== todayUTC && d !== tomorrowUTC;
  });

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <Text style={s.headerTitle}>{t('matches_title')}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContent}
      >
        {LEAGUES.map((lg) => {
          const locked = lg.key !== 'all' && !canAccessLeague(lg.key);
          return (
            <TouchableOpacity
              key={lg.key}
              style={[s.tab, activeLeague === lg.key && s.tabActive, locked && s.tabLocked]}
              onPress={() => {
                if (locked) {
                  navigation.navigate('Paywall', { feature: 'general' });
                } else {
                  setActiveLeague(lg.key);
                }
              }}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeLeague === lg.key && s.tabTextActive, locked && s.tabTextLocked]}>
                {locked ? '🔒 ' : ''}{lg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#21A56A"
          />
        }
      >
        {loading && matches.length === 0 ? (
          <View style={s.loadingState}>
            <Text style={s.loadingText}>{t('common_loading')}</Text>
          </View>
        ) : error ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>⚠️</Text>
            <Text style={s.emptyTitle}>{t('matches_no_matches')}</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : matches.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>{t('matches_no_matches')}</Text>
            <Text style={s.emptySub}>{t('matches_no_matches_sub')}</Text>
          </View>
        ) : (
          <>
            {todayMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>{t('matches_today')}</Text>
                {todayMatches.map((m) => (
                  <MatchCard key={m.id} match={m} onOpenBet={handleOpenBet} />
                ))}
              </View>
            )}

            {tomorrowMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>{t('matches_tomorrow')}</Text>
                {tomorrowMatches.map((m) => (
                  <MatchCard key={m.id} match={m} onOpenBet={handleOpenBet} />
                ))}
              </View>
            )}

            {laterMatches.length > 0 && (
              <View>
                <Text style={s.dateLabel}>{t('matches_later')}</Text>
                {laterMatches.map((m) => (
                  <MatchCard key={m.id} match={m} onOpenBet={handleOpenBet} />
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <BetModal
        visible={modalVisible}
        match={selectedMatch}
        initialPrediction={selectedPrediction}
        currentUserId={profile?.id ?? ''}
        onClose={() => {
          setModalVisible(false);
          setSelectedMatch(null);
          setSelectedPrediction(null);
        }}
        onPremiumRequired={() => navigation.navigate('Paywall')}
        onSubmit={handleSubmitBet}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#eef4f8',
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
    backgroundColor: '#21A56A',
    borderColor: '#21A56A',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7a9aaa',
  },
  tabTextActive: { color: '#000' },
  tabLocked: { borderColor: 'rgba(255,200,69,0.2)', borderStyle: 'dashed' },
  tabTextLocked: { color: '#4a6878' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a6878',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
  },
  loadingState: { alignItems: 'center', paddingTop: 80 },
  loadingText: { color: '#4a6878', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#eef4f8' },
  emptySub: { fontSize: 13, color: '#4a6878', textAlign: 'center' },
});