import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useIncomingBets } from '../hooks/useIncomingBets';
import type { MatchResult } from '../types/database';

function getPredictionLabel(prediction: string) {
  if (prediction === 'home') return 'Heimalið vinnur';
  if (prediction === 'away') return 'Útlið vinnur';
  if (prediction === 'draw') return 'Jafntefli';
  return prediction;
}

type PendingAccept = {
  betId: string;
  homeName: string;
  awayName: string;
  challengerPrediction: MatchResult;
};

export default function ChallengesScreen() {
  const { profile } = useAuth();
  const { bets, outgoingBets, loading, refetch, respondToBet } = useIncomingBets(profile?.id ?? '');

  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [pendingAccept, setPendingAccept] = useState<PendingAccept | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openAcceptModal(item: any) {
    setSelectedPrediction(null);
    setPendingAccept({
      betId: item.id,
      homeName: item.match?.home_team?.name ?? 'Heimalið',
      awayName: item.match?.away_team?.name ?? 'Útlið',
      challengerPrediction: item.challenger_prediction,
    });
  }

  async function confirmAccept() {
    if (!pendingAccept || !selectedPrediction) return;
    setSubmitting(true);
    const { error } = await respondToBet(pendingAccept.betId, 'accepted', selectedPrediction);
    setSubmitting(false);
    setPendingAccept(null);
    if (error) {
      Alert.alert('Villa', 'Ekki tókst að samþykkja áskorun.');
    }
  }

  async function handleDecline(betId: string) {
    const { error } = await respondToBet(betId, 'declined');
    if (error) {
      Alert.alert('Villa', 'Ekki tókst að hafna áskorun.');
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#00e5a0" />
      </View>
    );
  }

  const PREDICTIONS: { key: MatchResult; getLabel: (h: string, a: string) => string; sub: string; color: string }[] = [
    { key: 'home', getLabel: (h) => h, sub: 'Heimalið vinnur', color: '#00e5a0' },
    { key: 'draw', getLabel: () => 'Jafntefli', sub: 'Engin vinnur', color: '#ffc940' },
    { key: 'away', getLabel: (_, a) => a, sub: 'Útlið vinnur', color: '#3d8bff' },
  ];

  const pendingIncoming = bets.filter((b) => b.status === 'pending').length;
  const pendingOutgoing = outgoingBets.filter((b) => b.status === 'pending').length;

  return (
    <>
      <View style={s.container}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Áskoranir</Text>
          <Text style={s.headerSub}>Veðmál og áskoranir þínar</Text>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'incoming' && s.tabActive]}
            onPress={() => setActiveTab('incoming')}
          >
            <Text style={[s.tabText, activeTab === 'incoming' && s.tabTextActive]}>
              Móttekið{pendingIncoming > 0 ? ` (${pendingIncoming})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'outgoing' && s.tabActive]}
            onPress={() => setActiveTab('outgoing')}
          >
            <Text style={[s.tabText, activeTab === 'outgoing' && s.tabTextActive]}>
              Sent{pendingOutgoing > 0 ? ` (${pendingOutgoing})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── List ── */}
        {activeTab === 'incoming' ? (
          <FlatList
            style={s.list}
            contentContainerStyle={s.listContent}
            data={bets}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={loading}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>🎯</Text>
                <Text style={s.emptyTitle}>Engar áskoranir</Text>
                <Text style={s.emptySub}>Þegar einhver skorar á þig birtist það hér.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const challengerName =
                item.challenger?.full_name ?? item.challenger?.username ?? 'Óþekktur';
              const homeName = item.match?.home_team?.name ?? 'Heimalið';
              const awayName = item.match?.away_team?.name ?? 'Útlið';
              const status = item.status ?? 'pending';
              const isPending = status === 'pending';

              return (
                <View style={s.card}>
                  <View style={s.topRow}>
                    <Text style={s.name}>⚔️ {challengerName}</Text>
                    <View style={[s.statusBadge, !isPending && s.statusBadgeDone]}>
                      <Text style={[s.statusText, !isPending && s.statusTextDone]}>
                        {status === 'pending'
                          ? 'Beðið'
                          : status === 'accepted'
                          ? '✓ Samþykkt'
                          : '✕ Hafnað'}
                      </Text>
                    </View>
                  </View>

                  <Text style={s.matchText}>
                    {homeName} vs {awayName}
                  </Text>

                  <View style={s.predRow}>
                    <View>
                      <Text style={s.predLabel}>Spá andstæðings</Text>
                      <Text style={s.predValue}>{getPredictionLabel(item.challenger_prediction)}</Text>
                    </View>
                    {status === 'accepted' && item.opponent_prediction && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.predLabel}>Spá þín</Text>
                        <Text style={[s.predValue, { color: '#3d8bff' }]}>
                          {getPredictionLabel(item.opponent_prediction)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {isPending ? (
                    <View style={s.actionsRow}>
                      <TouchableOpacity
                        style={s.rejectBtn}
                        activeOpacity={0.85}
                        onPress={() => handleDecline(item.id)}
                      >
                        <Text style={s.rejectBtnText}>Hafna</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        activeOpacity={0.85}
                        onPress={() => openAcceptModal(item)}
                      >
                        <Text style={s.acceptBtnText}>Samþykkja →</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={s.doneRow}>
                      <Text style={s.doneText}>
                        {status === 'accepted'
                          ? 'Þú hefur samþykkt þessa áskorun.'
                          : 'Þú hefur hafnað þessari áskorun.'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        ) : (
          <FlatList
            style={s.list}
            contentContainerStyle={s.listContent}
            data={outgoingBets}
            keyExtractor={(item) => item.id}
            onRefresh={refetch}
            refreshing={loading}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>📤</Text>
                <Text style={s.emptyTitle}>Engin sent veðmál</Text>
                <Text style={s.emptySub}>Veðmál sem þú sendir birtast hér.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const opponentName =
                item.opponent?.full_name ?? item.opponent?.username ?? 'Óþekktur';
              const homeName = item.match?.home_team?.name ?? 'Heimalið';
              const awayName = item.match?.away_team?.name ?? 'Útlið';
              const status = item.status ?? 'pending';

              return (
                <View style={s.card}>
                  <View style={s.topRow}>
                    <Text style={s.name}>→ {opponentName}</Text>
                    <View style={[s.statusBadge, status !== 'pending' && s.statusBadgeDone]}>
                      <Text style={[s.statusText, status !== 'pending' && s.statusTextDone]}>
                        {status === 'pending'
                          ? 'Beðið'
                          : status === 'accepted'
                          ? '✓ Samþykkt'
                          : '✕ Hafnað'}
                      </Text>
                    </View>
                  </View>

                  <Text style={s.matchText}>
                    {homeName} vs {awayName}
                  </Text>

                  <View style={s.predRow}>
                    <View>
                      <Text style={s.predLabel}>Spá þín</Text>
                      <Text style={s.predValue}>{getPredictionLabel(item.challenger_prediction)}</Text>
                    </View>
                    {status === 'accepted' && item.opponent_prediction && (
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.predLabel}>Spá andstæðings</Text>
                        <Text style={[s.predValue, { color: '#3d8bff' }]}>
                          {getPredictionLabel(item.opponent_prediction)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={s.doneRow}>
                    <Text style={s.doneText}>
                      {status === 'pending'
                        ? 'Bíður svars frá andstæðingi.'
                        : status === 'accepted'
                        ? 'Andstæðingurinn samþykkti áskorunina.'
                        : 'Andstæðingurinn hafnaði áskoruninni.'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* ── Prediction picker modal ── */}
      <Modal
        visible={!!pendingAccept}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingAccept(null)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />

            <Text style={s.sheetTitle}>Veldu þína spá</Text>
            <Text style={s.sheetSub}>
              Til að samþykkja þarftu að velja hvað þú spáir fyrir leikinn
            </Text>

            <Text style={s.matchLabel}>
              {pendingAccept?.homeName} vs {pendingAccept?.awayName}
            </Text>

            <View style={s.predGrid}>
              {PREDICTIONS.map((p) => {
                const isSel = selectedPrediction === p.key;
                const label = p.getLabel(pendingAccept?.homeName ?? '', pendingAccept?.awayName ?? '');
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      s.predCard,
                      isSel && { borderColor: p.color, backgroundColor: p.color + '14' },
                    ]}
                    onPress={() => setSelectedPrediction(p.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.predCardLabel, isSel && { color: p.color }]}>{label}</Text>
                    <Text style={s.predCardSub}>{p.sub}</Text>
                    {isSel && (
                      <View style={[s.predCheck, { backgroundColor: p.color }]}>
                        <Text style={s.predCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[s.confirmBtn, !selectedPrediction && s.confirmBtnDisabled]}
              onPress={confirmAccept}
              disabled={!selectedPrediction || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.confirmBtnText}>Staðfesta og samþykkja 🏆</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setPendingAccept(null)}>
              <Text style={s.cancelBtnText}>Hætta við</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f0f0f8', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#9090aa' },
  center: {
    flex: 1, backgroundColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#111118', borderRadius: 12, padding: 3,
  },
  tab: {
    flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10,
  },
  tabActive: { backgroundColor: '#1e1e2e' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#5a5a72' },
  tabTextActive: { color: '#f0f0f8' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#f0f0f8', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9090aa', textAlign: 'center' },

  card: {
    backgroundColor: '#151822', borderRadius: 18, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, gap: 10,
  },
  name: { flex: 1, fontSize: 18, fontWeight: '800', color: '#f0f0f8' },
  statusBadge: {
    backgroundColor: 'rgba(255,201,64,0.14)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  statusBadgeDone: { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusText: { color: '#ffc940', fontWeight: '700', fontSize: 12 },
  statusTextDone: { color: '#5a5a72' },
  matchText: { fontSize: 15, fontWeight: '700', color: '#d7d7e5', marginBottom: 10 },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  predLabel: { fontSize: 11, color: '#5a5a72', marginBottom: 3 },
  predValue: { fontSize: 15, fontWeight: '800', color: '#00e5a0' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, backgroundColor: '#222634', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  rejectBtnText: { color: '#c5c8d4', fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 2, backgroundColor: '#00e5a0', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  acceptBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  doneRow: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14 },
  doneText: { color: '#c5c8d4', fontSize: 13 },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111118', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#f0f0f8', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: '#9090aa', marginBottom: 16, lineHeight: 18 },
  matchLabel: {
    fontSize: 15, fontWeight: '700', color: '#f0f0f8',
    backgroundColor: '#1a1a24', borderRadius: 12, padding: 12,
    marginBottom: 18, textAlign: 'center',
  },
  predGrid: { gap: 10, marginBottom: 20 },
  predCard: {
    backgroundColor: '#1a1a24', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    padding: 16, position: 'relative',
  },
  predCardLabel: { fontSize: 16, fontWeight: '800', color: '#f0f0f8', marginBottom: 3 },
  predCardSub: { fontSize: 12, color: '#5a5a72' },
  predCheck: {
    position: 'absolute', top: 14, right: 14,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  predCheckText: { color: '#000', fontSize: 11, fontWeight: '800' },
  confirmBtn: {
    backgroundColor: '#00e5a0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#5a5a72', fontSize: 14, fontWeight: '600' },
});
