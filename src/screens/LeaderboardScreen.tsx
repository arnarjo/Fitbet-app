// src/screens/LeaderboardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { LeaderboardEntry } from '../types/database';

type Tab = 'global' | 'friends';

const MEDAL = ['🥇', '🥈', '🥉'];
const AVATAR_COLORS = ['#21A56A','#47C4EE','#ff4a6e','#FFC845','#a855f7','#ff9f40'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const [tab, setTab]               = useState<Tab>('global');
  const [global, setGlobal]         = useState<LeaderboardEntry[]>([]);
  const [friendsBoard, setFriendsBoard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const podiumAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (profile?.id) fetchAll();
  }, [profile?.id]);

  useEffect(() => {
    if (global.length > 0) {
      Animated.spring(podiumAnim, {
        toValue: 1, useNativeDriver: true, damping: 16, stiffness: 140,
      }).start();
    }
  }, [global]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchGlobal(), fetchFriendsBoard()]);
    setLoading(false);
  }

  async function fetchFriendsBoard() {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);
    const friendIds = (data ?? []).map((f: any) =>
      f.requester_id === profile.id ? f.addressee_id : f.requester_id
    );
    const ids = [profile.id, ...friendIds];
    const { data: board } = await supabase
      .from('leaderboard')
      .select('*')
      .in('id', ids);
    setFriendsBoard((board ?? []) as LeaderboardEntry[]);
  }

  async function fetchGlobal() {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(50);
    setGlobal((data ?? []) as LeaderboardEntry[]);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [profile?.id]);

  const displayBoard = tab === 'global' ? global : friendsBoard;
  const myRank = displayBoard.findIndex(e => e.id === profile?.id) + 1;
  const myEntry = displayBoard.find(e => e.id === profile?.id);

  const top3 = displayBoard.slice(0, 3);
  const showPodium = top3.length >= 3;
  const rest = showPodium ? displayBoard.slice(3) : displayBoard;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Stigatafla</Text>
        {myRank > 0 && (
          <View style={s.myRankPill}>
            <Text style={s.myRankText}>#{myRank} staður</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, tab === 'global' && s.tabActive]}
          onPress={() => setTab('global')}
        >
          <Text style={[s.tabText, tab === 'global' && s.tabTextActive]}>Heimur</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'friends' && s.tabActive]}
          onPress={() => setTab('friends')}
        >
          <Text style={[s.tabText, tab === 'friends' && s.tabTextActive]}>
            Vinir ({friendsBoard.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />}
        contentContainerStyle={s.scroll}
      >
        {/* ── Podium top 3 ── */}
        {showPodium && (
          <Animated.View style={[s.podiumWrap, {
            opacity: podiumAnim,
            transform: [{ scale: podiumAnim.interpolate({ inputRange:[0,1], outputRange:[0.92,1] }) }],
          }]}>
            {/* 2nd */}
            <View style={[s.podiumSlot, s.podiumSecond]}>
              <View style={[s.podiumAvatar, { backgroundColor: AVATAR_COLORS[1] + '22', borderColor: AVATAR_COLORS[1] + '55' }]}>
                <Text style={[s.podiumAvatarText, { color: AVATAR_COLORS[1] }]}>
                  {getInitials(top3[1]?.full_name ?? top3[1]?.username ?? '')}
                </Text>
              </View>
              <Text style={s.podiumMedal}>🥈</Text>
              <Text style={s.podiumName} numberOfLines={1}>{top3[1]?.full_name?.split(' ')[0] ?? top3[1]?.username}</Text>
              <View style={[s.podiumPts, { backgroundColor: '#c0c0c022' }]}>
                <Text style={[s.podiumPtsText, { color: '#c0c0c0' }]}>{top3[1]?.total_points} stig</Text>
              </View>
              <View style={[s.podiumBlock, s.podiumBlock2]} />
            </View>

            {/* 1st */}
            <View style={[s.podiumSlot, s.podiumFirst]}>
              <View style={[s.podiumCrown]}>
                <Text style={s.podiumCrownText}>👑</Text>
              </View>
              <View style={[s.podiumAvatar, s.podiumAvatarLarge, { backgroundColor: '#ffc94022', borderColor: '#ffc94055' }]}>
                <Text style={[s.podiumAvatarText, s.podiumAvatarTextLarge, { color: '#ffc940' }]}>
                  {getInitials(top3[0]?.full_name ?? top3[0]?.username ?? '')}
                </Text>
              </View>
              <Text style={s.podiumMedal}>🥇</Text>
              <Text style={[s.podiumName, s.podiumNameFirst]} numberOfLines={1}>
                {top3[0]?.full_name?.split(' ')[0] ?? top3[0]?.username}
              </Text>
              <View style={[s.podiumPts, { backgroundColor: '#ffc94022' }]}>
                <Text style={[s.podiumPtsText, { color: '#ffc940' }]}>{top3[0]?.total_points} stig</Text>
              </View>
              <View style={[s.podiumBlock, s.podiumBlock1]} />
            </View>

            {/* 3rd */}
            <View style={[s.podiumSlot, s.podiumThird]}>
              <View style={[s.podiumAvatar, { backgroundColor: AVATAR_COLORS[4] + '22', borderColor: AVATAR_COLORS[4] + '55' }]}>
                <Text style={[s.podiumAvatarText, { color: AVATAR_COLORS[4] }]}>
                  {getInitials(top3[2]?.full_name ?? top3[2]?.username ?? '')}
                </Text>
              </View>
              <Text style={s.podiumMedal}>🥉</Text>
              <Text style={s.podiumName} numberOfLines={1}>{top3[2]?.full_name?.split(' ')[0] ?? top3[2]?.username}</Text>
              <View style={[s.podiumPts, { backgroundColor: '#cd7c3622' }]}>
                <Text style={[s.podiumPtsText, { color: '#cd7c36' }]}>{top3[2]?.total_points} stig</Text>
              </View>
              <View style={[s.podiumBlock, s.podiumBlock3]} />
            </View>
          </Animated.View>
        )}

        {/* ── My position highlight ── */}
        {myEntry && myRank > 3 && (
          <View style={s.myRow}>
            <Text style={s.myRowLabel}>Staða þín</Text>
            <BoardRow entry={myEntry} rank={myRank} isMe highlight />
          </View>
        )}

        {/* ── Rest of board ── */}
        {rest.length > 0 && (
          <View style={s.boardCard}>
            {rest.map((entry, idx) => (
              <BoardRow
                key={entry.id}
                entry={entry}
                rank={showPodium ? idx + 4 : idx + 1}
                isMe={entry.id === profile?.id}
              />
            ))}
          </View>
        )}

        {displayBoard.length === 0 && !loading && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>🏆</Text>
            <Text style={s.emptyTitle}>Engar færslur ennþá</Text>
            <Text style={s.emptySub}>
              {tab === 'friends' ? 'Bættu við vinum í Prófíl flipanum' : 'Farðu og veðjaðu!'}
            </Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── BoardRow sub-component ───────────────────────────────────
function BoardRow({ entry, rank, isMe, highlight }: {
  entry: LeaderboardEntry; rank: number; isMe: boolean; highlight?: boolean;
}) {
  const color = AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
  return (
    <View style={[s.boardRow, isMe && s.boardRowMe, highlight && s.boardRowHighlight]}>
      <Text style={[s.boardRank, rank <= 3 && { color: '#ffc940' }]}>
        {rank <= 3 ? MEDAL[rank - 1] : `#${rank}`}
      </Text>
      <View style={[s.boardAvatar, { backgroundColor: color + '20' }]}>
        <Text style={[s.boardAvatarText, { color }]}>
          {getInitials(entry.full_name ?? entry.username)}
        </Text>
      </View>
      <View style={s.boardInfo}>
        <Text style={s.boardName}>
          {entry.full_name ?? entry.username}
          {isMe && <Text style={s.boardMeTag}> (þú)</Text>}
        </Text>
        <Text style={s.boardSub}>{entry.total_wins}S · {entry.total_losses}T</Text>
      </View>
      <Text style={s.boardPts}>{entry.total_points}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f0f0f8' },
  myRankPill: {
    backgroundColor: 'rgba(0,229,160,0.12)',
    borderWidth: 1, borderColor: 'rgba(0,229,160,0.25)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  myRankText: { fontSize: 12, fontWeight: '800', color: '#00e5a0' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(0,229,160,0.1)', borderColor: 'rgba(0,229,160,0.3)' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#5a5a72' },
  tabTextActive: { color: '#00e5a0' },
  scroll: { paddingHorizontal: 16 },

  // Podium
  podiumWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    marginBottom: 20, gap: 8, paddingTop: 24,
  },
  podiumSlot: { alignItems: 'center', flex: 1 },
  podiumFirst:  { zIndex: 3 },
  podiumSecond: { zIndex: 2 },
  podiumThird:  { zIndex: 1 },
  podiumCrown: { marginBottom: 2 },
  podiumCrownText: { fontSize: 22 },
  podiumAvatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  podiumAvatarLarge: { width: 64, height: 64, borderRadius: 32 },
  podiumAvatarText: { fontSize: 16, fontWeight: '800' },
  podiumAvatarTextLarge: { fontSize: 20 },
  podiumMedal: { fontSize: 18, marginBottom: 4 },
  podiumName: { fontSize: 12, fontWeight: '700', color: '#f0f0f8', marginBottom: 5 },
  podiumNameFirst: { fontSize: 13 },
  podiumPts: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 8 },
  podiumPtsText: { fontSize: 10, fontWeight: '800' },
  podiumBlock: { width: '100%', borderRadius: 8 },
  podiumBlock1: { height: 56, backgroundColor: 'rgba(255,201,64,0.15)' },
  podiumBlock2: { height: 40, backgroundColor: 'rgba(192,192,192,0.12)' },
  podiumBlock3: { height: 28, backgroundColor: 'rgba(205,124,54,0.12)' },

  // My row highlight
  myRow: { marginBottom: 12 },
  myRowLabel: { fontSize: 10, fontWeight: '700', color: '#5a5a72', letterSpacing: 1.2, marginBottom: 6, textTransform: 'uppercase' },

  // Board
  boardCard: {
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  boardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  boardRowMe: { backgroundColor: 'rgba(0,229,160,0.05)' },
  boardRowHighlight: {
    backgroundColor: '#1a1a24', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(0,229,160,0.25)', marginBottom: 0,
  },
  boardRank: { fontSize: 13, fontWeight: '800', color: '#5a5a72', width: 32, textAlign: 'center' },
  boardAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  boardAvatarText: { fontSize: 12, fontWeight: '800' },
  boardInfo: { flex: 1 },
  boardName: { fontSize: 14, fontWeight: '700', color: '#f0f0f8' },
  boardMeTag: { color: '#00e5a0', fontSize: 12 },
  boardSub: { fontSize: 11, color: '#5a5a72', marginTop: 2 },
  boardPts: { fontSize: 18, fontWeight: '900', color: '#00e5a0' },

  emptyState: { alignItems: 'center', paddingTop: 64, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#f0f0f8' },
  emptySub: { fontSize: 13, color: '#5a5a72', textAlign: 'center', paddingHorizontal: 24 },
});
