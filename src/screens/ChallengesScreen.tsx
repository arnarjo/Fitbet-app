import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, StyleSheet,
  TouchableOpacity, Alert, Modal, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useIncomingBets } from '../hooks/useIncomingBets';
import { useStrava } from '../hooks/useStrava';
import { supabase } from '../lib/supabase';
import ProofUploadSheet from '../components/ProofUploadSheet';
import BetReactions from '../components/BetReactions';
import type { MatchResult, Challenge, SeasonBet } from '../types/database';
import { LEAGUE_COLOR } from '../constants/leagues';
import { useLanguage } from '../hooks/useLanguage';

function getPredictionLabel(prediction: string, homeName: string, awayName: string, drawLabel: string) {
  if (prediction === 'home') return homeName;
  if (prediction === 'away') return awayName;
  if (prediction === 'draw') return drawLabel;
  return prediction;
}

type PendingAccept = {
  betId: string;
  homeName: string;
  awayName: string;
  challengerPrediction: MatchResult;
};

type ListItem =
  | { kind: 'incoming'; data: any; id: string }
  | { kind: 'outgoing'; data: any; id: string }
  | { kind: 'season';   data: any; id: string }
  | { kind: 'challenge'; data: Challenge; id: string };

export default function ChallengesScreen() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const { bets, outgoingBets, loading, refetch, respondToBet, cancelBet } = useIncomingBets(profile?.id ?? '');
  const { connected: stravaConnected, checkAndAutoApprove } = useStrava();

  const [activeTab, setActiveTab] = useState<'virkt' | 'lokid'>('virkt');
  const [pendingAccept, setPendingAccept] = useState<PendingAccept | null>(null);
  const [selectedPrediction, setSelectedPrediction] = useState<MatchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [seasonBets, setSeasonBets] = useState<SeasonBet[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [proofSheet, setProofSheet] = useState<Challenge | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profile?.id) Promise.all([fetchSeasonBets(), fetchChallenges()]);
    AsyncStorage.getItem('@fitbet_challenges_onboarded').then(v => {
      if (!v) setShowOnboarding(true);
    });
  }, [profile?.id]);

  useFocusEffect(useCallback(() => {
    if (!stravaConnected) return;
    let active = true;
    checkAndAutoApprove().then(count => {
      if (active && count > 0) fetchChallenges();
    });
    return () => { active = false; };
  }, [stravaConnected, checkAndAutoApprove]));

  function dismissOnboarding() {
    setShowOnboarding(false);
    AsyncStorage.setItem('@fitbet_challenges_onboarded', '1');
  }

  async function fetchChallenges() {
    if (!profile?.id) return;
    setChallengesLoading(true);
    const { data } = await supabase
      .from('challenges')
      .select('*, loser:profiles!loser_id(*), winner:profiles!winner_id(*), proofs:challenge_proofs(*), bet:bets(match:matches(home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)))')
      .or(`loser_id.eq.${profile.id},winner_id.eq.${profile.id}`)
      .not('status', 'eq', 'approved')
      .order('created_at', { ascending: false });
    setChallenges(data ?? []);
    setChallengesLoading(false);
  }

  async function fetchSeasonBets() {
    if (!profile?.id) return;
    setSeasonLoading(true);
    const { data } = await supabase
      .from('season_bets')
      .select('*, market:season_markets(*), challenger:profiles!challenger_id(*), opponent:profiles!opponent_id(*), challenger_team:teams!challenger_pick(*), opponent_team:teams!opponent_pick(*)')
      .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    setSeasonBets(data ?? []);
    setSeasonLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), fetchSeasonBets(), fetchChallenges()]);
    setRefreshing(false);
  }

  async function approveProof(challenge: Challenge, proofId: string) {
    await Promise.all([
      supabase.from('challenge_proofs').update({ status: 'approved', reviewed_by: profile!.id }).eq('id', proofId),
      supabase.from('challenges').update({ status: 'approved', completed_at: new Date().toISOString() }).eq('id', challenge.id),
    ]);

    // Award challenge achievements to the person who completed the challenge
    const achievementCalls = [
      supabase.rpc('award_achievement', { p_user_id: challenge.loser_id, p_type: 'first_challenge' }),
    ];
    if (challenge.exercise === 'hlaup' && challenge.amount >= 10) {
      achievementCalls.push(supabase.rpc('award_achievement', { p_user_id: challenge.loser_id, p_type: 'challenge_10km' }));
    }
    if (challenge.exercise === 'armbeygjur' && challenge.amount >= 100) {
      achievementCalls.push(supabase.rpc('award_achievement', { p_user_id: challenge.loser_id, p_type: 'challenge_100_pushups' }));
    }
    await Promise.all(achievementCalls);

    await fetchChallenges();
  }

  async function rejectProof(challengeId: string, proofId: string) {
    await Promise.all([
      supabase.from('challenge_proofs').update({ status: 'rejected', reviewed_by: profile!.id }).eq('id', proofId),
      supabase.from('challenges').update({ status: 'assigned' }).eq('id', challengeId),
    ]);
    await fetchChallenges();
  }

  async function respondToSeasonBet(betId: string, accept: boolean, bet: any) {
    await supabase.from('season_bets').update({ status: accept ? 'accepted' : 'declined' }).eq('id', betId);
    await supabase.from('notifications').insert({
      user_id: bet.challenger_id,
      type: accept ? 'bet_accepted' : 'bet_declined',
      title: accept ? 'Tímabilsspá samþykkt! ✅' : 'Tímabilsspá hafnað',
      body: accept
        ? `${bet.opponent?.full_name ?? bet.opponent?.username} samþykkti spána þína.`
        : `${bet.opponent?.full_name ?? bet.opponent?.username} hafnaði spánni þinni.`,
      data: { type: accept ? 'bet_accepted' : 'bet_declined', season_bet_id: betId },
    });
    await fetchSeasonBets();
  }

  function openAcceptModal(item: any) {
    setSelectedPrediction(null);
    setPendingAccept({
      betId: item.id,
      homeName: item.match?.home_team?.name ?? t('bet_modal_home_team'),
      awayName: item.match?.away_team?.name ?? t('bet_modal_away_team'),
      challengerPrediction: item.challenger_prediction,
    });
  }

  async function confirmAccept() {
    if (!pendingAccept || !selectedPrediction) return;
    setSubmitting(true);
    const { error } = await respondToBet(pendingAccept.betId, 'accepted', selectedPrediction);
    setSubmitting(false);
    setPendingAccept(null);
    if (error) Alert.alert(t('common_error'), t('bet_modal_err_msg'));
  }

  async function handleDecline(betId: string) {
    Alert.alert(t('challenges_decline_q'), t('challenges_sure'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('challenges_decline'), style: 'destructive', onPress: async () => {
        const { error } = await respondToBet(betId, 'declined');
        if (error) Alert.alert(t('common_error'), t('bet_modal_err_msg'));
      }},
    ]);
  }

  if (loading && bets.length === 0 && outgoingBets.length === 0) {
    return <View style={s.center}><ActivityIndicator size="large" color="#21A56A" /></View>;
  }

  const PREDICTIONS: { key: MatchResult; getLabel: (h: string, a: string) => string; color: string }[] = [
    { key: 'home', getLabel: (h) => h,                       color: '#21A56A' },
    { key: 'draw', getLabel: () => t('matches_predict_draw'), color: '#FFC845' },
    { key: 'away', getLabel: (_, a) => a,                    color: '#47C4EE' },
  ];

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const filteredBets = bets.filter(b => {
    if (b.status === 'declined' || b.status === 'cancelled') return false;
    if (b.status === 'settled')  return new Date(b.settled_at ?? b.created_at) > twoDaysAgo;
    return true;
  });
  const filteredOutgoing = outgoingBets.filter(b => {
    if (b.status === 'declined' || b.status === 'cancelled') return false;
    if (b.status === 'settled')  return new Date(b.settled_at ?? b.created_at) > twoDaysAgo;
    return true;
  });

  // ── Virkt: pending + accepted (need attention or watching) ─────────────
  const virktItems: ListItem[] = [
    ...filteredBets.filter(b => b.status === 'pending' || b.status === 'accepted')
      .map(b => ({ kind: 'incoming' as const, data: b, id: b.id })),
    ...filteredOutgoing.filter(b => b.status === 'pending' || b.status === 'accepted')
      .map(b => ({ kind: 'outgoing' as const, data: b, id: b.id })),
    ...seasonBets.filter(b => b.status === 'pending' || b.status === 'accepted')
      .map(b => ({ kind: 'season' as const, data: b, id: b.id })),
  ].sort((a, b) => {
    // pending first
    const ap = a.data.status === 'pending' ? 0 : 1;
    const bp = b.data.status === 'pending' ? 0 : 1;
    return ap - bp || new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
  });

  // ── Lokið: challenges + settled/declined ───────────────────────────────
  const lokidItems: ListItem[] = [
    ...challenges.map(c => ({ kind: 'challenge' as const, data: c, id: c.id })),
    ...filteredBets.filter(b => b.status !== 'pending' && b.status !== 'accepted')
      .map(b => ({ kind: 'incoming' as const, data: b, id: b.id })),
    ...filteredOutgoing.filter(b => b.status !== 'pending' && b.status !== 'accepted')
      .map(b => ({ kind: 'outgoing' as const, data: b, id: b.id })),
    ...seasonBets.filter(b => b.status !== 'pending' && b.status !== 'accepted')
      .map(b => ({ kind: 'season' as const, data: b, id: b.id })),
  ];

  // Badge counts
  const pendingCount = filteredBets.filter(b => b.status === 'pending').length
    + seasonBets.filter(b => b.status === 'pending' && b.opponent_id === profile?.id).length;
  const proofCount = challenges.filter(c =>
    (c.status === 'submitted' && c.winner_id === profile?.id) ||
    (c.status === 'assigned'  && c.loser_id  === profile?.id)
  ).length;

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderIncomingCard(item: any) {
    const challengerName = item.challenger?.full_name ?? item.challenger?.username ?? t('challenges_unknown');
    const homeName = item.match?.home_team?.name ?? t('bet_modal_home_team');
    const awayName = item.match?.away_team?.name ?? t('bet_modal_away_team');
    const drawLabel = t('matches_predict_draw');
    const isPending = item.status === 'pending';

    return (
      <View style={[s.card, isPending && { borderColor: 'rgba(255,200,69,0.35)' }]}>
        <View style={s.topRow}>
          <Text style={s.name}>⚔️ {challengerName}</Text>
          <View style={[s.statusBadge, !isPending && s.statusBadgeDone]}>
            <Text style={[s.statusText, !isPending && s.statusTextDone]}>
              {isPending ? t('challenges_pending') : item.status === 'accepted' ? `✓ ${t('challenges_accepted')}` : `✕ ${t('challenges_declined')}`}
            </Text>
          </View>
        </View>
        <Text style={s.matchText}>{homeName} vs {awayName}</Text>
        <View style={s.betInfoRow}>
          <Text style={s.betInfoText}>🏋️ {item.amount} {item.unit} {item.exercise}</Text>
        </View>
        <View style={s.predRow}>
          <View>
            <Text style={s.predLabel}>{t('challenges_opp_pred_label')}</Text>
            <Text style={s.predValue}>{getPredictionLabel(item.challenger_prediction, homeName, awayName, drawLabel)}</Text>
          </View>
          {item.status === 'accepted' && item.opponent_prediction && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.predLabel}>{t('challenges_opp_pred_mine')}</Text>
              <Text style={[s.predValue, { color: '#47C4EE' }]}>
                {getPredictionLabel(item.opponent_prediction, homeName, awayName, drawLabel)}
              </Text>
            </View>
          )}
        </View>
        {isPending ? (
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.rejectBtn} onPress={() => handleDecline(item.id)}>
              <Text style={s.rejectBtnText}>{t('challenges_decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.acceptBtn} onPress={() => openAcceptModal(item)}>
              <Text style={s.acceptBtnText}>{t('challenges_bet_on')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.doneRow}>
            <Text style={[s.doneText, item.status === 'accepted' && { color: '#21A56A', fontWeight: '700' }]}>
              {item.status === 'accepted' ? t('challenges_bet_accepted_msg') : t('challenges_bet_declined_msg')}
            </Text>
          </View>
        )}
        {item.status === 'settled' && profile?.id && (
          <BetReactions betId={item.id} userId={profile.id} />
        )}
      </View>
    );
  }

  function renderOutgoingCard(item: any) {
    const opponentName = item.opponent?.full_name ?? item.opponent?.username ?? t('challenges_unknown');
    const homeName = item.match?.home_team?.name ?? t('bet_modal_home_team');
    const awayName = item.match?.away_team?.name ?? t('bet_modal_away_team');
    const drawLabel = t('matches_predict_draw');
    const isPending = item.status === 'pending';

    return (
      <View style={s.card}>
        <View style={s.topRow}>
          <Text style={s.name}>→ {opponentName}</Text>
          <View style={[s.statusBadge, !isPending && s.statusBadgeDone]}>
            <Text style={[s.statusText, !isPending && s.statusTextDone]}>
              {isPending ? t('challenges_pending') : item.status === 'accepted' ? `✓ ${t('challenges_accepted')}` : `✕ ${t('challenges_declined')}`}
            </Text>
          </View>
        </View>
        <Text style={s.matchText}>{homeName} vs {awayName}</Text>
        <View style={s.betInfoRow}>
          <Text style={s.betInfoText}>🏋️ {item.amount} {item.unit} {item.exercise}</Text>
        </View>
        <View style={s.predRow}>
          <View>
            <Text style={s.predLabel}>{t('challenges_my_pred')}</Text>
            <Text style={s.predValue}>{getPredictionLabel(item.challenger_prediction, homeName, awayName, drawLabel)}</Text>
          </View>
          {item.status === 'accepted' && item.opponent_prediction && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.predLabel}>{t('challenges_opp_pred_label')}</Text>
              <Text style={[s.predValue, { color: '#47C4EE' }]}>
                {getPredictionLabel(item.opponent_prediction, homeName, awayName, drawLabel)}
              </Text>
            </View>
          )}
        </View>
        {isPending ? (
          <View style={s.actionsRow}>
            <Text style={[s.doneText, { flex: 1 }]}>{t('challenges_awaiting_friend')}</Text>
            <TouchableOpacity style={s.retractBtn} onPress={() =>
              Alert.alert(t('challenges_cancel_q'), t('challenges_sure'), [
                { text: t('common_cancel'), style: 'cancel' },
                { text: t('challenges_cancel_bet'), style: 'destructive', onPress: async () => {
                  const { error } = await cancelBet(item.id);
                  if (error) Alert.alert(t('common_error'), t('bet_modal_err_msg'));
                }},
              ])
            }>
              <Text style={s.retractBtnText}>{t('challenges_cancel_bet')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.doneRow}>
            <Text style={[s.doneText, item.status === 'accepted' && { color: '#21A56A', fontWeight: '700' }]}>
              {item.status === 'accepted' ? t('challenges_accepted_waiting') : t('challenges_friend_declined')}
            </Text>
          </View>
        )}
        {item.status === 'settled' && profile?.id && (
          <BetReactions betId={item.id} userId={profile.id} />
        )}
      </View>
    );
  }

  function renderSeasonCard(item: any) {
    const isChallenger = item.challenger_id === profile?.id;
    const isIncoming   = item.status === 'pending' && item.opponent_id === profile?.id;
    const myTeam   = isChallenger ? item.challenger_team?.name : item.opponent_team?.name;
    const hisTeam  = isChallenger ? item.opponent_team?.name  : item.challenger_team?.name;
    const oppName  = isChallenger
      ? (item.opponent?.full_name  ?? item.opponent?.username  ?? '?')
      : (item.challenger?.full_name ?? item.challenger?.username ?? '?');
    const league = item.market?.league_name ?? '';
    const accent = LEAGUE_COLOR[league] ?? '#21A56A';
    const statusMap: Record<string, { label: string; color: string }> = {
      pending:  { label: t('challenges_pending'),  color: '#FFC845' },
      accepted: { label: t('challenges_accepted'), color: '#47C4EE' },
      settled:  { label: t('challenges_settled'),  color: '#7a9aaa' },
      declined: { label: t('challenges_declined'), color: '#ff4a6e' },
    };
    const st  = statusMap[item.status] ?? statusMap.pending;
    const won = item.winner_id === profile?.id;

    return (
      <View style={[s.card, isIncoming && { borderColor: 'rgba(255,200,69,0.35)' }]}>
        <View style={s.topRow}>
          <Text style={[s.name, { color: accent }]}>📅 {league || t('lb_season_bets')}</Text>
          <View style={[s.statusBadge, { backgroundColor: st.color + '18' }]}>
            <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: accent, flex: 1 }} numberOfLines={2}>{myTeam ?? '—'}</Text>
          <Text style={{ fontSize: 11, color: '#4a6878', fontWeight: '700' }}>VS</Text>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#7a9aaa', flex: 1, textAlign: 'right' }} numberOfLines={2}>{hisTeam ?? '—'}</Text>
        </View>
        <Text style={s.matchText}>👤 {oppName}</Text>
        {item.exercise && (
          <View style={s.betInfoRow}>
            <Text style={s.betInfoText}>🏋️ {item.amount} {item.unit} {item.exercise}</Text>
          </View>
        )}
        {item.status === 'settled' && (
          <Text style={{ fontSize: 13, fontWeight: '800', marginTop: 6, color: won ? '#21A56A' : '#ff4a6e' }}>
            {won ? t('challenges_season_win') : t('challenges_season_loss')}
          </Text>
        )}
        {isIncoming && (
          <View style={s.actionsRow}>
            <TouchableOpacity style={s.rejectBtn} onPress={() =>
              Alert.alert(t('challenges_decline'), t('challenges_sure'), [
                { text: t('common_cancel'), style: 'cancel' },
                { text: t('challenges_decline'), style: 'destructive', onPress: () => respondToSeasonBet(item.id, false, item) },
              ])
            }>
              <Text style={s.rejectBtnText}>{t('challenges_decline')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.acceptBtn} onPress={() =>
              Alert.alert(t('challenges_accept'), t('challenges_accept_season_q'), [
                { text: t('common_cancel'), style: 'cancel' },
                { text: `${t('challenges_accept')}`, onPress: () => respondToSeasonBet(item.id, true, item) },
              ])
            }>
              <Text style={s.acceptBtnText}>{t('challenges_accept')} →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderChallengeCard(item: Challenge) {
    const isLoser  = item.loser_id  === profile?.id;
    const isWinner = item.winner_id === profile?.id;
    const proof = item.proofs?.[0];
    const emojiMap: Record<string, string> = {
      hlaup:'🏃', armbeygjur:'💪', hnébeygjur:'🦵', burpees:'🔥', hjólreiðar:'🚴', planki:'🧱',
      sund:'🏊', pullups:'🏋️', hiit:'⚡', interval_run:'🏃',
      jump_rope:'🪢', box_jumps:'🦘', stairmaster:'🪜', rowing:'🚣',
      gongutur:'🚶', situps:'🪑', dips:'💺', mountain_climbers:'🧗',
    };
    const statusLabel: Record<string, { label: string; color: string; bg: string }> = {
      assigned:  { label: t('challenges_awaiting_status'), color: '#FFC845', bg: 'rgba(255,200,69,0.12)' },
      submitted: { label: t('challenges_proof_submitted'), color: '#47C4EE', bg: 'rgba(71,196,238,0.12)' },
      rejected:  { label: t('challenges_proof_rejected'),  color: '#ff4a6e', bg: 'rgba(255,74,110,0.12)' },
    };
    const st = statusLabel[item.status] ?? statusLabel.assigned;

    return (
      <View style={[s.card, item.status === 'submitted' && isWinner && { borderColor: 'rgba(71,196,238,0.4)' }]}>
        <View style={s.topRow}>
          <Text style={s.name}>
            {emojiMap[item.exercise] ?? '💪'} {item.amount} {item.unit} {item.exercise}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
            <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
        <Text style={s.matchText}>
          {isLoser
            ? `${t('challenges_complete_for')} ${item.winner?.full_name ?? item.winner?.username}`
            : `${item.loser?.full_name ?? item.loser?.username} ${t('challenges_must_complete')}`}
        </Text>
        {item.bet?.match && (
          <Text style={s.matchSubText}>
            ⚽ {item.bet.match.home_team?.name} – {item.bet.match.away_team?.name}
          </Text>
        )}
        {item.due_date && (
          <Text style={{ fontSize: 11, color: '#4a6878', marginTop: 4 }}>
            📅 {t('challenges_due')}: {new Date(item.due_date).toLocaleDateString()}
          </Text>
        )}
        {isWinner && proof && item.status === 'submitted' && (
          <View style={s.proofBox}>
            {proof.proof_type === 'photo' || proof.proof_type === 'video' ? (
              <Image source={{ uri: proof.file_url ?? undefined }} style={s.proofImage} resizeMode="cover" />
            ) : (
              <Text style={s.proofStrava}>{t('challenges_proof_strava')}</Text>
            )}
            {proof.notes ? <Text style={s.proofNotes}>"{proof.notes}"</Text> : null}
            <View style={s.proofActions}>
              <TouchableOpacity style={s.rejectBtn} onPress={() =>
                Alert.alert(t('challenges_reject_q'), t('challenges_reject_msg'), [
                  { text: t('common_cancel'), style: 'cancel' },
                  { text: t('challenges_reject'), style: 'destructive', onPress: () => rejectProof(item.id, proof.id) },
                ])
              }>
                <Text style={s.rejectBtnText}>{t('challenges_reject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.acceptBtn} onPress={() =>
                Alert.alert(t('challenges_approve_q'), t('challenges_approve_msg'), [
                  { text: t('common_cancel'), style: 'cancel' },
                  { text: t('challenges_approve'), onPress: () => approveProof(item, proof.id) },
                ])
              }>
                <Text style={s.acceptBtnText}>{t('challenges_approve')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {isLoser && (item.status === 'assigned' || item.status === 'rejected') && (
          <TouchableOpacity style={[s.acceptBtn, { marginTop: 12 }]} onPress={() => setProofSheet(item)}>
            <Text style={s.acceptBtnText}>
              {item.status === 'rejected' ? `🔄 ${t('challenges_resend_proof')}` : `📤 ${t('challenges_send_proof')}`}
            </Text>
          </TouchableOpacity>
        )}
        {isLoser && item.status === 'submitted' && (
          <View style={[s.doneRow, { backgroundColor: 'rgba(71,196,238,0.08)', borderRadius: 10, marginTop: 10 }]}>
            <Text style={[s.doneText, { color: '#47C4EE' }]}>{t('challenges_proof_pending_v')}</Text>
          </View>
        )}
      </View>
    );
  }

  function renderItem({ item }: { item: ListItem }) {
    switch (item.kind) {
      case 'incoming':  return renderIncomingCard(item.data);
      case 'outgoing':  return renderOutgoingCard(item.data);
      case 'season':    return renderSeasonCard(item.data);
      case 'challenge': return renderChallengeCard(item.data);
    }
  }

  const currentData = activeTab === 'virkt' ? virktItems : lokidItems;
  const isLoadingCurrent = activeTab === 'virkt' ? loading : (challengesLoading || seasonLoading);

  return (
    <>
      <View style={s.container}>
        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('challenges_title')}</Text>
          <Text style={s.headerSub}>{t('challenges_header_sub')}</Text>
        </View>

        {/* ── Tabs ── */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'virkt' && s.tabActive]}
            onPress={() => setActiveTab('virkt')}
          >
            <Text style={[s.tabText, activeTab === 'virkt' && s.tabTextActive]}>
              {t('challenges_active')}{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'lokid' && s.tabActive]}
            onPress={() => setActiveTab('lokid')}
          >
            <Text style={[s.tabText, activeTab === 'lokid' && s.tabTextActive]}>
              {t('challenges_finished')}{proofCount > 0 ? ` (${proofCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        {isLoadingCurrent ? (
          <View style={s.center}><ActivityIndicator color="#21A56A" /></View>
        ) : (
          <FlatList
            style={s.list}
            contentContainerStyle={s.listContent}
            data={currentData}
            keyExtractor={(item) => item.kind + item.id}
            onRefresh={onRefresh}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <Text style={s.emptyIcon}>{activeTab === 'virkt' ? '🎯' : '✅'}</Text>
                <Text style={s.emptyTitle}>
                  {activeTab === 'virkt' ? t('challenges_empty_active') : t('challenges_empty_finished')}
                </Text>
                <Text style={s.emptySub}>
                  {activeTab === 'virkt' ? t('challenges_empty_active_sub') : t('challenges_empty_finished_sub')}
                </Text>
              </View>
            }
            renderItem={renderItem}
          />
        )}
      </View>

      {/* ── Challenge onboarding modal ── */}
      <Modal visible={showOnboarding} transparent animationType="fade" onRequestClose={dismissOnboarding}>
        <View style={s.onbOverlay}>
          <View style={s.onbBox}>
            <Text style={s.onbEmoji}>💪</Text>
            <Text style={s.onbTitle}>{t('challenges_title')}</Text>
            <View style={s.onbSteps}>
              <Text style={s.onbStep}>⚔️  Veðjaðu við vin um leikniðurstöðu</Text>
              <Text style={s.onbStep}>😅  Sá sem tapar fær líkamlega áskorun</Text>
              <Text style={s.onbStep}>📸  Hlaðu upp sönnun þegar þú klárar</Text>
              <Text style={s.onbStep}>✅  Vinurinn staðfestir og þú færð stig</Text>
            </View>
            <TouchableOpacity style={s.onbBtn} onPress={dismissOnboarding}>
              <Text style={s.onbBtnText}>Skil! Byrjum 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Proof upload sheet ── */}
      <ProofUploadSheet
        visible={!!proofSheet}
        challenge={proofSheet}
        currentUserId={profile?.id ?? ''}
        stravaConnected={profile?.strava_connected ?? false}
        onClose={() => setProofSheet(null)}
        onSuccess={() => { setProofSheet(null); fetchChallenges(); }}
      />

      {/* ── Prediction picker modal ── */}
      <Modal visible={!!pendingAccept} transparent animationType="slide" onRequestClose={() => setPendingAccept(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{t('challenges_pick_your_pred')}</Text>
            <Text style={s.sheetSub}>{t('challenges_pick_sub')}</Text>
            <Text style={s.matchLabel}>
              {pendingAccept?.homeName} vs {pendingAccept?.awayName}
            </Text>
            <View style={s.predGrid}>
              {PREDICTIONS.map((p) => {
                const isSel    = selectedPrediction === p.key;
                const isTaken  = p.key === pendingAccept?.challengerPrediction;
                const label    = p.getLabel(pendingAccept?.homeName ?? '', pendingAccept?.awayName ?? '');
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      s.predCard,
                      isSel   && { borderColor: p.color, backgroundColor: p.color + '14' },
                      isTaken && { opacity: 0.35 },
                    ]}
                    onPress={() => !isTaken && setSelectedPrediction(p.key)}
                    activeOpacity={isTaken ? 1 : 0.8}
                  >
                    <Text style={[s.predCardLabel, isSel && { color: p.color }]}>{label}</Text>
                    {isTaken && <Text style={{ fontSize: 11, color: '#ff4a6e', marginTop: 2 }}>{t('challenges_opp_pick_taken')}</Text>}
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
              {submitting
                ? <ActivityIndicator color="#000" />
                : <Text style={s.confirmBtnText}>{t('challenges_accept_bet_btn')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setPendingAccept(null)}>
              <Text style={s.cancelBtnText}>{t('common_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#eef4f8', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#7a9aaa' },
  center: { flex: 1, backgroundColor: '#071D2A', alignItems: 'center', justifyContent: 'center', padding: 24 },

  tabRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#0d1e2b', borderRadius: 12, padding: 3,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#1e2d3d' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#4a6878' },
  tabTextActive: { color: '#eef4f8' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#eef4f8', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#7a9aaa', textAlign: 'center' },

  card: {
    backgroundColor: '#151822', borderRadius: 18, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  name: { flex: 1, fontSize: 18, fontWeight: '800', color: '#eef4f8' },
  statusBadge: { backgroundColor: 'rgba(255,200,69,0.14)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  statusBadgeDone: { backgroundColor: 'rgba(255,255,255,0.06)' },
  statusText: { color: '#FFC845', fontWeight: '700', fontSize: 12 },
  statusTextDone: { color: '#4a6878' },
  matchText: { fontSize: 15, fontWeight: '700', color: '#d7d7e5', marginBottom: 4 },
  matchSubText: { fontSize: 12, color: '#4a6878', marginBottom: 10 },
  predRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  predLabel: { fontSize: 11, color: '#4a6878', marginBottom: 3 },
  predValue: { fontSize: 15, fontWeight: '800', color: '#21A56A' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, backgroundColor: '#222634', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  rejectBtnText: { color: '#c5c8d4', fontSize: 14, fontWeight: '700' },
  retractBtn: {
    backgroundColor: 'rgba(255,74,110,0.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,74,110,0.25)',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  retractBtnText: { color: '#ff4a6e', fontSize: 13, fontWeight: '700' },
  acceptBtn: { flex: 2, backgroundColor: '#21A56A', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  acceptBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  betInfoRow: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  betInfoText: { fontSize: 13, fontWeight: '700', color: '#eef4f8' },
  doneRow: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14 },
  doneText: { color: '#c5c8d4', fontSize: 13 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#071D2A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 24, paddingBottom: 40,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#eef4f8', marginBottom: 6 },
  sheetSub: { fontSize: 13, color: '#7a9aaa', marginBottom: 16, lineHeight: 18 },
  matchLabel: { fontSize: 15, fontWeight: '700', color: '#eef4f8', backgroundColor: '#0d2030', borderRadius: 12, padding: 12, marginBottom: 18, textAlign: 'center' },
  predGrid: { gap: 10, marginBottom: 20 },
  predCard: { backgroundColor: '#0d2030', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, position: 'relative' },
  predCardLabel: { fontSize: 16, fontWeight: '800', color: '#eef4f8', marginBottom: 3 },
  predCheck: { position: 'absolute', top: 14, right: 14, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  predCheckText: { color: '#000', fontSize: 11, fontWeight: '800' },
  confirmBtn: { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { color: '#4a6878', fontSize: 14, fontWeight: '600' },

  proofBox: { marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(71,196,238,0.2)' },
  proofImage: { width: '100%', height: 180 },
  proofStrava: { padding: 16, fontSize: 14, color: '#47C4EE', fontWeight: '700', textAlign: 'center' },
  proofNotes: { padding: 10, fontSize: 12, color: '#7a9aaa', fontStyle: 'italic' },
  proofActions: { flexDirection: 'row', gap: 8, padding: 10 },
  onbOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  onbBox:       { backgroundColor: '#0d2030', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  onbEmoji:     { fontSize: 48, marginBottom: 12 },
  onbTitle:     { fontSize: 22, fontWeight: '900', color: '#eef4f8', marginBottom: 20 },
  onbSteps:     { width: '100%', gap: 12, marginBottom: 24 },
  onbStep:      { fontSize: 15, color: '#b0c4d0', lineHeight: 22 },
  onbBtn:       { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40 },
  onbBtnText:   { color: '#000', fontWeight: '800', fontSize: 16 },
});
