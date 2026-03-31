// src/screens/FriendsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Profile } from '../types/database';

type FriendshipStatus = 'friends' | 'pending_sent' | 'pending_received' | 'none';

interface FriendEntry {
  profile: Profile;
  status: FriendshipStatus;
  friendshipId?: string;
  wins?: number;
  losses?: number;
}

const AVATAR_COLORS = ['#00e5a0','#3d8bff','#ff4a6e','#ffc940','#a855f7','#ff9f40'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}
function avatarColor(id: string) {
  const idx = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

export default function FriendsScreen() {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';

  const [search, setSearch]           = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching]     = useState(false);
  const [friends, setFriends]         = useState<FriendEntry[]>([]);
  const [requests, setRequests]       = useState<FriendEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetchFriends();

    const channel = supabase
      .channel(`friendships:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `requester_id=eq.${userId}`,
      }, () => fetchFriends())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `addressee_id=eq.${userId}`,
      }, () => fetchFriends())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => doSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch ────────────────────────────────────────────────
  async function fetchFriends() {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status,
        requester:profiles!requester_id(*),
        addressee:profiles!addressee_id(*)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    const friendList: FriendEntry[] = [];
    const requestList: FriendEntry[] = [];

    for (const row of (data ?? []) as any[]) {
      const isRequester = row.requester.id === userId;
      const other: Profile = isRequester ? row.addressee : row.requester;

      if (row.status === 'accepted') {
        friendList.push({ profile: other, status: 'friends', friendshipId: row.id });
      } else if (row.status === 'pending') {
        if (isRequester) {
          friendList.push({ profile: other, status: 'pending_sent', friendshipId: row.id });
        } else {
          requestList.push({ profile: other, status: 'pending_received', friendshipId: row.id });
        }
      }
    }

    setFriends(friendList);
    setRequests(requestList);
    setLoading(false);
  }

  // ── Search ───────────────────────────────────────────────
  async function doSearch(q: string) {
    if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', userId)
      .limit(10);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  // ── Actions ──────────────────────────────────────────────
  async function sendRequest(toUserId: string) {
    setActionLoading(toUserId);
    const { error } = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: toUserId,
      status: 'pending',
    });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: toUserId,
        type: 'friend_request',
        title: 'Vinarbeiðni! 👋',
        body: `${profile?.full_name ?? profile?.username} vill bæta þér við sem vin.`,
        data: { from_user_id: userId },
      });
      setSearch('');
      setSearchResults([]);
      await fetchFriends();
    }
    setActionLoading(null);
  }

  async function acceptRequest(friendshipId: string, fromUserId: string) {
    setActionLoading(friendshipId);
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await supabase.from('notifications').insert({
      user_id: fromUserId,
      type: 'friend_accepted',
      title: 'Vinarbeiðni samþykkt! 🤝',
      body: `${profile?.full_name ?? profile?.username} er nú vinur þinn.`,
      data: { user_id: userId },
    });
    await fetchFriends();
    setActionLoading(null);
  }

  async function declineRequest(friendshipId: string) {
    setActionLoading(friendshipId);
    await supabase.from('friendships').update({ status: 'declined' }).eq('id', friendshipId);
    await fetchFriends();
    setActionLoading(null);
  }

  async function removeFriend(friendshipId: string, name: string) {
    Alert.alert(`Fjarlægja ${name}?`, 'Þú getur alltaf bætt þeim við aftur seinna.', [
      { text: 'Hætta við', style: 'cancel' },
      {
        text: 'Fjarlægja', style: 'destructive',
        onPress: async () => {
          await supabase.from('friendships').delete().eq('id', friendshipId);
          await fetchFriends();
        },
      },
    ]);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFriends();
    setRefreshing(false);
  }, [userId]);

  // Check if a search result is already a friend/pending
  function getSearchStatus(profileId: string): FriendshipStatus {
    const all = [...friends, ...requests];
    const found = all.find(f => f.profile.id === profileId);
    return found?.status ?? 'none';
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Vinir</Text>
        {requests.length > 0 && (
          <View style={s.requestsBadge}>
            <Text style={s.requestsBadgeText}>{requests.length}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Leita að notendum..."
          placeholderTextColor="#3a3a52"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]); }}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00e5a0" />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Search results ── */}
        {search.length >= 2 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>LEITARNIÐURSTÖÐUR</Text>
            {searching ? (
              <ActivityIndicator color="#00e5a0" style={{ marginTop: 16 }} />
            ) : searchResults.length === 0 ? (
              <Text style={s.emptyText}>Enginn notandi fannst fyrir „{search}"</Text>
            ) : (
              <View style={s.listCard}>
                {searchResults.map(p => {
                  const st = getSearchStatus(p.id);
                  const color = avatarColor(p.id);
                  return (
                    <View key={p.id} style={s.row}>
                      <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                        <Text style={[s.avatarText, { color }]}>
                          {getInitials(p.full_name ?? p.username)}
                        </Text>
                      </View>
                      <View style={s.rowInfo}>
                        <Text style={s.rowName}>{p.full_name ?? p.username}</Text>
                        <Text style={s.rowHandle}>@{p.username}</Text>
                      </View>
                      {st === 'none' && (
                        <TouchableOpacity
                          style={s.addBtn}
                          onPress={() => sendRequest(p.id)}
                          disabled={actionLoading === p.id}
                        >
                          {actionLoading === p.id
                            ? <ActivityIndicator color="#000" size="small" />
                            : <Text style={s.addBtnText}>+ Bæta við</Text>
                          }
                        </TouchableOpacity>
                      )}
                      {st === 'friends' && (
                        <View style={s.friendsBadge}><Text style={s.friendsBadgeText}>Vinur ✓</Text></View>
                      )}
                      {st === 'pending_sent' && (
                        <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>Sent</Text></View>
                      )}
                      {st === 'pending_received' && (
                        <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>Beiðni móttekin</Text></View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Friend requests ── */}
        {requests.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>VINARBEIÐNIR ({requests.length})</Text>
            <View style={s.listCard}>
              {requests.map(entry => {
                const color = avatarColor(entry.profile.id);
                const isLoading = actionLoading === entry.friendshipId;
                return (
                  <View key={entry.friendshipId} style={s.row}>
                    <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                      <Text style={[s.avatarText, { color }]}>
                        {getInitials(entry.profile.full_name ?? entry.profile.username)}
                      </Text>
                    </View>
                    <View style={s.rowInfo}>
                      <Text style={s.rowName}>{entry.profile.full_name ?? entry.profile.username}</Text>
                      <Text style={s.rowHandle}>@{entry.profile.username}</Text>
                    </View>
                    <View style={s.requestActions}>
                      <TouchableOpacity
                        style={s.declineBtn}
                        onPress={() => declineRequest(entry.friendshipId!)}
                        disabled={isLoading}
                      >
                        <Text style={s.declineBtnText}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={() => acceptRequest(entry.friendshipId!, entry.profile.id)}
                        disabled={isLoading}
                      >
                        {isLoading
                          ? <ActivityIndicator color="#000" size="small" />
                          : <Text style={s.acceptBtnText}>✓ Samþykkja</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Friends list ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>VINIR ({friends.filter(f => f.status === 'friends').length})</Text>
          {loading ? (
            <ActivityIndicator color="#00e5a0" style={{ marginTop: 20 }} />
          ) : friends.filter(f => f.status === 'friends').length === 0 &&
              friends.filter(f => f.status === 'pending_sent').length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>Engir vinir ennþá</Text>
              <Text style={s.emptySub}>Leitaðu að vinum hér að ofan og bættu þeim við</Text>
            </View>
          ) : (
            <View style={s.listCard}>
              {friends.filter(f => f.status === 'friends').map(entry => {
                const color = avatarColor(entry.profile.id);
                return (
                  <View key={entry.friendshipId} style={s.row}>
                    <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                      <Text style={[s.avatarText, { color }]}>
                        {getInitials(entry.profile.full_name ?? entry.profile.username)}
                      </Text>
                    </View>
                    <View style={s.rowInfo}>
                      <Text style={s.rowName}>{entry.profile.full_name ?? entry.profile.username}</Text>
                      <Text style={s.rowHandle}>
                        @{entry.profile.username} · {entry.profile.total_points ?? 0} stig
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={() => removeFriend(
                        entry.friendshipId!,
                        entry.profile.full_name ?? entry.profile.username
                      )}
                    >
                      <Text style={s.removeBtnText}>···</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Pending sent */}
              {friends.filter(f => f.status === 'pending_sent').map(entry => {
                const color = avatarColor(entry.profile.id);
                return (
                  <View key={entry.friendshipId} style={[s.row, { opacity: 0.65 }]}>
                    <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                      <Text style={[s.avatarText, { color }]}>
                        {getInitials(entry.profile.full_name ?? entry.profile.username)}
                      </Text>
                    </View>
                    <View style={s.rowInfo}>
                      <Text style={s.rowName}>{entry.profile.full_name ?? entry.profile.username}</Text>
                      <Text style={s.rowHandle}>@{entry.profile.username}</Text>
                    </View>
                    <View style={s.pendingBadge}>
                      <Text style={s.pendingBadgeText}>Bíður svars</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#f0f0f8' },
  requestsBadge: {
    backgroundColor: '#ff4a6e', width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  requestsBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#1a1a24', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1, color: '#f0f0f8', fontSize: 14, fontFamily: 'DM Sans',
  },
  searchClear: { fontSize: 14, color: '#5a5a72', padding: 2 },
  scroll: { paddingHorizontal: 16 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#5a5a72',
    letterSpacing: 1.5, marginBottom: 10,
  },
  listCard: {
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#f0f0f8' },
  rowHandle: { fontSize: 11, color: '#5a5a72', marginTop: 2 },
  addBtn: {
    backgroundColor: '#00e5a0', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, minWidth: 80, alignItems: 'center',
  },
  addBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  friendsBadge: {
    backgroundColor: 'rgba(0,229,160,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,160,0.25)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  friendsBadgeText: { fontSize: 11, fontWeight: '700', color: '#00e5a0' },
  pendingBadge: {
    backgroundColor: 'rgba(255,201,64,0.1)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#ffc940' },
  requestActions: { flexDirection: 'row', gap: 8 },
  declineBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,74,110,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,74,110,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtnText: { fontSize: 13, color: '#ff4a6e', fontWeight: '700' },
  acceptBtn: {
    backgroundColor: '#00e5a0', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, minWidth: 90, alignItems: 'center',
  },
  acceptBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  removeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { fontSize: 16, color: '#5a5a72', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#f0f0f8' },
  emptySub: { fontSize: 13, color: '#5a5a72', textAlign: 'center', paddingHorizontal: 20 },
  emptyText: { fontSize: 13, color: '#5a5a72', textAlign: 'center', paddingVertical: 16 },
});
