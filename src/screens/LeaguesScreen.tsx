// src/screens/LeaguesScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, StatusBar, Alert, Modal,
  ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import type { League, LeagueMember, LeaderboardEntry } from '../types/database';

type LeagueTab = 'members' | 'bets' | 'board';

const LEAGUE_ICONS = ['⚽', '🏆', '💼', '🎯', '🔥', '🏅'];
const AVATAR_COLORS = ['#21A56A','#47C4EE','#ff4a6e','#FFC845','#a855f7','#ff9f40'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}
function avatarColor(id: string) {
  const idx = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

export default function LeaguesScreen() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const userId = profile?.id ?? '';

  const [leagues, setLeagues]         = useState<League[]>([]);
  const [selectedLeague, setSelected] = useState<League | null>(null);
  const [leagueTab, setLeagueTab]     = useState<LeagueTab>('board');
  const [members, setMembers]         = useState<LeagueBoard[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  // Create modal
  const [createModal, setCreateModal] = useState(false);
  const [newName, setNewName]         = useState('');
  const [newType, setNewType]         = useState<'vinahópur' | 'vinnustaður'>('vinahópur');
  const [creating, setCreating]       = useState(false);

  // Join modal
  const [joinModal, setJoinModal]     = useState(false);
  const [inviteCode, setInviteCode]   = useState('');
  const [joining, setJoining]         = useState(false);

  interface LeagueBoard {
    member: LeagueMe;
    entry?: LeaderboardEntry;
  }
  interface LeagueMe extends LeagueMe2 {}
  interface LeagueMe2 { user_id: string; role: string; profile?: any; }

  useEffect(() => { fetchLeagues(); }, [userId]);

  async function fetchLeagues() {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('league_members')
      .select('league:leagues(*)')
      .eq('user_id', userId);
    const list = (data ?? []).map((r: any) => r.league).filter(Boolean) as League[];
    setLeagues(list);
    if (list.length > 0 && !selectedLeague) {
      setSelected(list[0]);
      await fetchLeagueMembers(list[0].id);
    }
    setLoading(false);
  }

  async function fetchLeagueMembers(leagueId: string) {
    const { data } = await supabase
      .from('league_members')
      .select('user_id, role, profile:profiles(*)')
      .eq('league_id', leagueId);

    const memberList = (data ?? []) as any[];
    if (memberList.length === 0) { setMembers([]); return; }

    const ids = memberList.map((m: any) => m.user_id);
    const { data: lbData } = await supabase
      .from('leaderboard')
      .select('*')
      .in('id', ids);

    const lbMap = new Map(((lbData ?? []) as any[]).map((e: any) => [e.id, e]));
    const entries = memberList.map((m: any) => ({ member: m, entry: lbMap.get(m.user_id) }));
    entries.sort((a, b) => (b.entry?.total_points ?? 0) - (a.entry?.total_points ?? 0));
    setMembers(entries);
  }

  async function selectLeague(lg: League) {
    setSelected(lg);
    await fetchLeagueMembers(lg.id);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedLeague) await fetchLeagueMembers(selectedLeague.id);
    await fetchLeagues();
    setRefreshing(false);
  }, [userId, selectedLeague]);

  // ── Create league ────────────────────────────────────────
  async function createLeague() {
    if (!newName.trim()) { Alert.alert(t('common_error'), t('leagues_enter_name')); return; }
    setCreating(true);
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: lg, error } = await supabase
      .from('leagues')
      .insert({ name: newName.trim(), type: newType, created_by: userId, invite_code })
      .select()
      .single();

    if (error || !lg) { Alert.alert(t('common_error'), error?.message); setCreating(false); return; }

    // Add creator as admin member
    await supabase.from('league_members').insert({
      league_id: lg.id, user_id: userId, role: 'admin',
    });

    setCreating(false);
    setCreateModal(false);
    setNewName('');
    await fetchLeagues();
    setSelected(lg as League);
    await fetchLeagueMembers(lg.id);
  }

  // ── Join league ──────────────────────────────────────────
  async function joinLeague() {
    if (!inviteCode.trim()) { Alert.alert(t('common_error'), t('leagues_enter_code')); return; }
    setJoining(true);

    const { data: lg } = await supabase
      .from('leagues')
      .select('*')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single();

    if (!lg) {
      Alert.alert(t('leagues_code_missing'), t('leagues_code_missing_msg'));
      setJoining(false);
      return;
    }

    // Check not already member
    const { data: existing } = await supabase
      .from('league_members')
      .select('id')
      .eq('league_id', lg.id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      Alert.alert(t('leagues_already_member'));
      setJoining(false);
      return;
    }

    await supabase.from('league_members').insert({
      league_id: lg.id, user_id: userId, role: 'member',
    });

    setJoining(false);
    setJoinModal(false);
    setInviteCode('');
    await fetchLeagues();
    setSelected(lg as League);
    await fetchLeagueMembers(lg.id);
  }

  // ── Leave league ─────────────────────────────────────────
  async function leaveLeague(leagueId: string, name: string) {
    Alert.alert(`${t('leagues_leave_q')} ${name}?`, '', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('leagues_leave'), style: 'destructive',
        onPress: async () => {
          await supabase.from('league_members')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', userId);
          const updated = leagues.filter(l => l.id !== leagueId);
          setLeagues(updated);
          setSelected(updated[0] ?? null);
          if (updated[0]) await fetchLeagueMembers(updated[0].id);
          else setMembers([]);
        },
      },
    ]);
  }

  const icon = (id: string) => LEAGUE_ICONS[id.split('').reduce((a,c) => a+c.charCodeAt(0),0) % LEAGUE_ICONS.length];
  const isAdmin = members.find(m => m.member.user_id === userId)?.member.role === 'admin';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <Text style={s.headerTitle}>{t('leagues_title')}</Text>
        <View style={s.headerBtns}>
          <TouchableOpacity style={s.joinBtn} onPress={() => setJoinModal(true)}>
            <Text style={s.joinBtnText}>{t('leagues_join')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.createBtn} onPress={() => setCreateModal(true)}>
            <Text style={s.createBtnText}>{t('leagues_create_new')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#21A56A" style={{ marginTop: 60 }} />
      ) : leagues.length === 0 ? (
        <View style={s.emptyFull}>
          <Text style={s.emptyIcon}>🏅</Text>
          <Text style={s.emptyTitle}>{t('leagues_no_leagues')}</Text>
          <Text style={s.emptySub}>{t('leagues_no_leagues_sub')}</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setCreateModal(true)}>
            <Text style={s.emptyBtnText}>{t('leagues_create_new')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* League selector tabs */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={s.leagueScroll} contentContainerStyle={s.leagueScrollContent}
          >
            {leagues.map(lg => (
              <TouchableOpacity
                key={lg.id}
                style={[s.leagueTab, selectedLeague?.id === lg.id && s.leagueTabActive]}
                onPress={() => selectLeague(lg)}
              >
                <Text style={s.leagueTabIcon}>{icon(lg.id)}</Text>
                <Text style={[s.leagueTabText, selectedLeague?.id === lg.id && s.leagueTabTextActive]}>
                  {lg.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedLeague && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#21A56A" />}
            >
              {/* League info */}
              <View style={s.leagueInfoCard}>
                <View style={s.leagueInfoLeft}>
                  <Text style={s.leagueInfoIcon}>{icon(selectedLeague.id)}</Text>
                  <View>
                    <Text style={s.leagueInfoName}>{selectedLeague.name}</Text>
                    <Text style={s.leagueInfoType}>
                      {selectedLeague.type === 'vinahópur' ? `👥 ${t('leagues_friends_type')}` : `💼 ${t('leagues_work_type')}`}
                      {' · '}{members.length} {t('leagues_members_count')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={s.inviteBtn}
                  onPress={() => Share.share({
                    message: `Gakktu í deildina "${selectedLeague.name}" á FitBet!\n\nBoðkóði: ${selectedLeague.invite_code?.toUpperCase()}`,
                    title: 'Boða í FitBet deild',
                  })}
                >
                  <Text style={s.inviteBtnText}>🔗 {t('leagues_share')}</Text>
                </TouchableOpacity>
              </View>

              {/* Internal tabs */}
              <View style={s.tabRow}>
                {(['board', 'members'] as LeagueTab[]).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[s.tab, leagueTab === tab && s.tabActive]}
                    onPress={() => setLeagueTab(tab)}
                  >
                    <Text style={[s.tabText, leagueTab === tab && s.tabTextActive]}>
                      {tab === 'board' ? t('leagues_board') : `${t('leagues_members')} (${members.length})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Leaderboard */}
              {leagueTab === 'board' && (
                <View style={s.boardCard}>
                  {members.map((item, idx) => {
                    const p = item.member.profile;
                    const entry = item.entry;
                    const color = avatarColor(item.member.user_id);
                    const isMe = item.member.user_id === userId;
                    const medals = ['🥇','🥈','🥉'];
                    return (
                      <View key={item.member.user_id} style={[s.boardRow, isMe && s.boardRowMe]}>
                        <Text style={s.boardRank}>
                          {idx < 3 ? medals[idx] : `#${idx + 1}`}
                        </Text>
                        <View style={[s.boardAvatar, { backgroundColor: color + '22' }]}>
                          <Text style={[s.boardAvatarText, { color }]}>
                            {getInitials(p?.full_name ?? p?.username ?? '?')}
                          </Text>
                        </View>
                        <View style={s.boardInfo}>
                          <Text style={s.boardName}>
                            {p?.full_name ?? p?.username}
                            {isMe && <Text style={{ color: '#21A56A' }}> ({t('lb_you')})</Text>}
                            {item.member.role === 'admin' && <Text style={{ color: '#FFC845' }}> ★</Text>}
                          </Text>
                          <Text style={s.boardSub}>
                            {entry?.total_wins ?? 0}{t('lb_wins')} · {entry?.total_losses ?? 0}{t('lb_losses')}
                          </Text>
                        </View>
                        <Text style={s.boardPts}>{entry?.total_points ?? 0}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Members */}
              {leagueTab === 'members' && (
                <View style={s.boardCard}>
                  {members.map(item => {
                    const p = item.member.profile;
                    const color = avatarColor(item.member.user_id);
                    const isMe = item.member.user_id === userId;
                    return (
                      <View key={item.member.user_id} style={s.boardRow}>
                        <View style={[s.boardAvatar, { backgroundColor: color + '22' }]}>
                          <Text style={[s.boardAvatarText, { color }]}>
                            {getInitials(p?.full_name ?? p?.username ?? '?')}
                          </Text>
                        </View>
                        <View style={s.boardInfo}>
                          <Text style={s.boardName}>
                            {p?.full_name ?? p?.username}
                            {isMe && <Text style={{ color: '#21A56A' }}> ({t('lb_you')})</Text>}
                          </Text>
                          <Text style={s.boardSub}>@{p?.username}</Text>
                        </View>
                        {item.member.role === 'admin'
                          ? <View style={s.adminBadge}><Text style={s.adminBadgeText}>★ Admin</Text></View>
                          : <View style={s.memberBadge}><Text style={s.memberBadgeText}>{t('leagues_member')}</Text></View>
                        }
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Leave button */}
              <TouchableOpacity
                style={s.leaveBtn}
                onPress={() => leaveLeague(selectedLeague.id, selectedLeague.name)}
              >
                <Text style={s.leaveBtnText}>{t('leagues_leave')}</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* ── Create Modal ── */}
      <Modal visible={createModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('leagues_create_title')}</Text>
            <TouchableOpacity onPress={() => setCreateModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>{t('leagues_name_label')}</Text>
            <TextInput
              style={s.textInput}
              placeholder={t('leagues_name_ph')}
              placeholderTextColor="#2a4050"
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={s.fieldLabel}>{t('leagues_type')}</Text>
            <View style={s.typeRow}>
              <TouchableOpacity
                style={[s.typeBtn, newType === 'vinahópur' && s.typeBtnActive]}
                onPress={() => setNewType('vinahópur')}
              >
                <Text style={s.typeBtnIcon}>👥</Text>
                <Text style={[s.typeBtnText, newType === 'vinahópur' && s.typeBtnTextActive]}>{t('leagues_friends_type')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeBtn, newType === 'vinnustaður' && s.typeBtnActive]}
                onPress={() => setNewType('vinnustaður')}
              >
                <Text style={s.typeBtnIcon}>💼</Text>
                <Text style={[s.typeBtnText, newType === 'vinnustaður' && s.typeBtnTextActive]}>{t('leagues_work_type')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.submitBtn, creating && { opacity: 0.6 }]}
              onPress={createLeague} disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#000" />
                : <Text style={s.submitBtnText}>{t('leagues_create_btn')} 🏆</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Join Modal ── */}
      <Modal visible={joinModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setJoinModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('leagues_join')}</Text>
            <TouchableOpacity onPress={() => setJoinModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={s.modalBody}>
            <Text style={s.fieldLabel}>{t('leagues_code_label')}</Text>
            <TextInput
              style={s.textInput}
              placeholder={t('leagues_code_ph')}
              placeholderTextColor="#2a4050"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.fieldHint}>{t('leagues_code_hint')}</Text>
            <TouchableOpacity
              style={[s.submitBtn, joining && { opacity: 0.6 }]}
              onPress={joinLeague} disabled={joining}
            >
              {joining
                ? <ActivityIndicator color="#000" />
                : <Text style={s.submitBtnText}>{t('leagues_join_btn')} →</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#eef4f8' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  joinBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  joinBtnText: { fontSize: 12, fontWeight: '700', color: '#eef4f8' },
  createBtn: { backgroundColor: '#21A56A', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  createBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  leagueScroll: { flexGrow: 0 },
  leagueScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  leagueTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  leagueTabActive: { backgroundColor: 'rgba(33,165,106,0.1)', borderColor: 'rgba(33,165,106,0.3)' },
  leagueTabIcon: { fontSize: 14 },
  leagueTabText: { fontSize: 12, fontWeight: '700', color: '#4a6878' },
  leagueTabTextActive: { color: '#21A56A' },
  scroll: { paddingHorizontal: 16 },
  leagueInfoCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0d2030', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, marginBottom: 14,
  },
  leagueInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leagueInfoIcon: { fontSize: 28 },
  leagueInfoName: { fontSize: 16, fontWeight: '800', color: '#eef4f8' },
  leagueInfoType: { fontSize: 11, color: '#4a6878', marginTop: 3 },
  inviteBtn: {
    backgroundColor: 'rgba(33,165,106,0.1)', borderWidth: 1,
    borderColor: 'rgba(33,165,106,0.2)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  inviteBtnText: { fontSize: 12, fontWeight: '700', color: '#21A56A' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  tabActive: { backgroundColor: 'rgba(33,165,106,0.1)', borderColor: 'rgba(33,165,106,0.3)' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#4a6878' },
  tabTextActive: { color: '#21A56A' },
  boardCard: {
    backgroundColor: '#0d2030', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
    marginBottom: 12,
  },
  boardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  boardRowMe: { backgroundColor: 'rgba(33,165,106,0.05)' },
  boardRank: { fontSize: 14, fontWeight: '800', color: '#4a6878', width: 30, textAlign: 'center' },
  boardAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  boardAvatarText: { fontSize: 12, fontWeight: '800' },
  boardInfo: { flex: 1 },
  boardName: { fontSize: 14, fontWeight: '700', color: '#eef4f8' },
  boardSub: { fontSize: 11, color: '#4a6878', marginTop: 2 },
  boardPts: { fontSize: 18, fontWeight: '900', color: '#21A56A' },
  adminBadge: { backgroundColor: 'rgba(255,200,69,0.12)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  adminBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFC845' },
  memberBadge: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  memberBadgeText: { fontSize: 10, fontWeight: '600', color: '#4a6878' },
  leaveBtn: {
    backgroundColor: 'rgba(255,74,110,0.07)', borderWidth: 1,
    borderColor: 'rgba(255,74,110,0.15)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  leaveBtnText: { fontSize: 13, fontWeight: '700', color: '#ff4a6e' },
  emptyFull: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#eef4f8' },
  emptySub: { fontSize: 13, color: '#4a6878', textAlign: 'center', paddingHorizontal: 24 },
  emptyBtn: { backgroundColor: '#21A56A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, marginTop: 4 },
  emptyBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },
  modal: { flex: 1, backgroundColor: '#071D2A' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#eef4f8' },
  modalClose: { fontSize: 20, color: '#4a6878', fontWeight: '700' },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#4a6878', letterSpacing: 1.5, marginBottom: 10 },
  textInput: {
    backgroundColor: '#0d2030', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 14, color: '#eef4f8', fontSize: 14, marginBottom: 18,
  },
  fieldHint: { fontSize: 12, color: '#4a6878', marginTop: -12, marginBottom: 18 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  typeBtn: {
    flex: 1, backgroundColor: '#0d2030', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 6,
  },
  typeBtnActive: { borderColor: '#21A56A', backgroundColor: 'rgba(33,165,106,0.07)' },
  typeBtnIcon: { fontSize: 24 },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: '#7a9aaa' },
  typeBtnTextActive: { color: '#21A56A' },
  submitBtn: { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
