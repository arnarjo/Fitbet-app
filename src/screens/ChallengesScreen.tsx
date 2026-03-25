// src/screens/ChallengesScreen.tsx
// Shows all challenges - ones to complete and ones to approve

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChallengeCard from '../components/ChallengeCard';
import ProofUploadSheet from '../components/ProofUploadSheet';
import { useChallenges } from '../hooks/useChallenges';
import { useAuth } from '../hooks/useAuth';
import type { Challenge } from '../types/database';

type Tab = 'mine' | 'approve';

export default function ChallengesScreen() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const { challenges, loading, submitPhotoProof, approveProof } = useChallenges(userId);

  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const [refreshing, setRefreshing] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<Challenge | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // useChallenges refetches on mount; trigger manually if needed
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Split challenges into tabs
  const myChallenges  = challenges.filter(c => c.loser_id === userId);
  const toApprove     = challenges.filter(c => c.winner_id === userId && c.status === 'submitted');
  const approveCount  = toApprove.length;

  function handleUploadPress(challengeId: string) {
    const c = challenges.find(ch => ch.id === challengeId) ?? null;
    setUploadTarget(c);
    setSheetVisible(true);
  }

  async function handleProofSubmit(challengeId: string) {
    return submitPhotoProof(challengeId);
  }

  const displayed = activeTab === 'mine' ? myChallenges : toApprove;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Áskoranir</Text>
        {myChallenges.filter(c => c.status === 'assigned').length > 0 && (
          <View style={s.urgentBadge}>
            <Text style={s.urgentText}>
              {myChallenges.filter(c => c.status === 'assigned').length} opin
            </Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'mine' && s.tabActive]}
          onPress={() => setActiveTab('mine')}
        >
          <Text style={[s.tabText, activeTab === 'mine' && s.tabTextActive]}>
            Mínar ({myChallenges.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'approve' && s.tabActive]}
          onPress={() => setActiveTab('approve')}
        >
          <Text style={[s.tabText, activeTab === 'approve' && s.tabTextActive]}>
            Yfirferð {approveCount > 0 ? `(${approveCount})` : ''}
          </Text>
          {approveCount > 0 && <View style={s.tabDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />
        }
      >
        {loading && displayed.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>Hleður...</Text>
          </View>
        ) : displayed.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>
              {activeTab === 'mine' ? '🏆' : '✅'}
            </Text>
            <Text style={s.emptyTitle}>
              {activeTab === 'mine' ? 'Engar áskoranir' : 'Ekkert til að samþykkja'}
            </Text>
            <Text style={s.emptySub}>
              {activeTab === 'mine'
                ? 'Þegar þú tapar veðmáli birtist áskorun hér'
                : 'Þegar vinir skila sönnun þarftu að samþykkja hér'}
            </Text>
          </View>
        ) : (
          displayed.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              currentUserId={userId}
              onSubmitProof={handleUploadPress}
              onApprove={approveProof}
            />
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Proof upload sheet */}
      <ProofUploadSheet
        visible={sheetVisible}
        challenge={uploadTarget}
        currentUserId={userId}
        stravaConnected={profile?.strava_connected ?? false}
        onClose={() => { setSheetVisible(false); setUploadTarget(null); }}
        onSuccess={() => { /* useChallenges listens to realtime */ }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f0f0f8' },
  urgentBadge: {
    backgroundColor: 'rgba(255,74,110,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  urgentText: { fontSize: 12, fontWeight: '700', color: '#ff4a6e' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: 'rgba(0,229,160,0.1)',
    borderColor: 'rgba(0,229,160,0.3)',
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#5a5a72' },
  tabTextActive: { color: '#00e5a0' },
  tabDot: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff4a6e',
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0f0f8' },
  emptySub: { fontSize: 13, color: '#5a5a72', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  emptyText: { color: '#5a5a72', fontSize: 14 },
});
