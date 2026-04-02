// src/components/ChallengeCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { Challenge, ChallengeStatus } from '../types/database';
import { EXERCISE_OPTIONS } from '../types/database';

type Props = {
  challenge: Challenge;
  currentUserId: string;
  onSubmitProof: (challengeId: string) => Promise<{ error: any }>;
  onApprove: (challengeId: string, proofId: string, approved: boolean) => Promise<void>;
};

const STATUS_CONFIG: Record<ChallengeStatus, { label: string; color: string; bg: string }> = {
  assigned:  { label: 'Óklárað',    color: '#ff4a6e', bg: 'rgba(255,74,110,0.12)'  },
  submitted: { label: 'Í yfirferð', color: '#ffc940', bg: 'rgba(255,201,64,0.12)' },
  approved:  { label: 'Klárað ✓',  color: '#00e5a0', bg: 'rgba(0,229,160,0.12)'   },
  rejected:  { label: 'Hafnað',    color: '#9090aa', bg: 'rgba(144,144,170,0.12)' },
};

const EXERCISE_EMOJI: Record<string, string> = {
  hlaup: '🏃', armbeygjur: '💪', hnébeygjur: '🦵',
  burpees: '🔥', hjólreiðar: '🚴', planki: '🧱',
};

export default function ChallengeCard({ challenge, currentUserId, onSubmitProof, onApprove }: Props) {
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);

  const isLoser  = challenge.loser_id  === currentUserId;
  const isWinner = challenge.winner_id === currentUserId;
  const status   = STATUS_CONFIG[challenge.status];
  const exOpt    = EXERCISE_OPTIONS[challenge.exercise as keyof typeof EXERCISE_OPTIONS];
  const emoji    = EXERCISE_EMOJI[challenge.exercise] ?? '💪';

  const latestProof = challenge.proofs?.length ? challenge.proofs[challenge.proofs.length - 1] : undefined;

  async function handleUpload() {
    setUploading(true);
    const { error } = await onSubmitProof(challenge.id);
    setUploading(false);
    if (error && error !== 'cancelled') {
      Alert.alert('Villa', 'Ekki tókst að hlaða upp sönnun. Reyndu aftur.');
    }
  }

  async function handleApprove(approved: boolean) {
    if (!latestProof) return;
    setApproving(true);
    await onApprove(challenge.id, latestProof.id, approved);
    setApproving(false);
  }

  function formatDue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Liðinn tími!';
    if (diff === 0) return 'Í dag!';
    if (diff === 1) return 'Á morgun';
    return `${diff} dagar eftir`;
  }

  const dueLabel = formatDue(challenge.due_date);
  const isOverdue = challenge.due_date && new Date(challenge.due_date) < new Date() && challenge.status === 'assigned';

  return (
    <View style={[s.card, isOverdue ? s.cardOverdue : null]}>

      {/* Top row: exercise info + status badge */}
      <View style={s.topRow}>
        <View style={[s.iconBox, { backgroundColor: status.bg }]}>
          <Text style={s.iconEmoji}>{emoji}</Text>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.challengeTitle}>
            {challenge.amount} {exOpt?.unit ?? ''} {exOpt?.label ?? challenge.exercise}
          </Text>
          <Text style={s.involvedText}>
            {isLoser
              ? `Þú tapaðir við ${challenge.winner?.full_name ?? challenge.winner?.username ?? 'Vin'}`
              : `${challenge.loser?.full_name ?? challenge.loser?.username ?? 'Vinur'} tapaði`}
          </Text>
        </View>

        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Due date warning */}
      {dueLabel && challenge.status === 'assigned' && (
        <View style={[s.dueRow, isOverdue ? s.dueRowOverdue : s.dueRowNormal]}>
          <Text style={[s.dueText, isOverdue ? { color: '#ff4a6e' } : { color: '#ffc940' }]}>
            {isOverdue ? '⚠ ' : '⏰ '}{dueLabel}
          </Text>
        </View>
      )}

      {/* Proof image preview */}
      {latestProof?.file_url && (
        <View style={s.proofPreview}>
          <Image
            source={{ uri: latestProof.file_url }}
            style={s.proofImage}
            resizeMode="cover"
          />
          <View style={s.proofOverlay}>
            <Text style={s.proofType}>
              {latestProof.proof_type === 'video' ? '▶ Myndband' : '📸 Mynd'}
            </Text>
            <View style={[
              s.proofStatus,
              latestProof.status === 'approved'
                ? { backgroundColor: 'rgba(0,229,160,0.85)' }
                : latestProof.status === 'rejected'
                ? { backgroundColor: 'rgba(255,74,110,0.85)' }
                : { backgroundColor: 'rgba(255,201,64,0.85)' },
            ]}>
              <Text style={s.proofStatusText}>
                {latestProof.status === 'approved' ? '✓ Samþykkt'
                  : latestProof.status === 'rejected' ? '✕ Hafnað'
                  : '⏳ Bíður'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Strava proof */}
      {latestProof?.proof_type === 'strava' && (
        <View style={s.stravaRow}>
          <Text style={s.stravaIcon}>⚡</Text>
          <Text style={s.stravaText}>Sjálfvirk Strava staðfesting</Text>
          <Text style={[s.stravaStatus, { color: '#00e5a0' }]}>✓</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={s.actions}>

        {/* LOSER actions */}
        {isLoser && challenge.status === 'assigned' && (
          <TouchableOpacity
            style={s.uploadBtn}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading
              ? <ActivityIndicator color="#000" size="small" />
              : <>
                  <Text style={s.uploadIcon}>📸</Text>
                  <Text style={s.uploadText}>Hlaða upp sönnun</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {isLoser && challenge.status === 'rejected' && (
          <TouchableOpacity
            style={[s.uploadBtn, s.uploadBtnRetry]}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading
              ? <ActivityIndicator color="#ffc940" size="small" />
              : <>
                  <Text style={s.uploadIcon}>🔄</Text>
                  <Text style={[s.uploadText, { color: '#ffc940' }]}>Reyna aftur</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {isLoser && challenge.status === 'submitted' && (
          <View style={s.waitingRow}>
            <ActivityIndicator color="#ffc940" size="small" />
            <Text style={s.waitingText}>Bíður samþykkis frá {challenge.winner?.full_name ?? 'Vin'}...</Text>
          </View>
        )}

        {isLoser && challenge.status === 'approved' && (
          <View style={s.completedRow}>
            <Text style={s.completedText}>🎉 Áskorun kláruð! Vel gert!</Text>
          </View>
        )}

        {/* WINNER actions */}
        {isWinner && challenge.status === 'submitted' && latestProof && (
          <View style={s.approveRow}>
            <Text style={s.approveQuestion}>
              Er sönnunin gild?
            </Text>
            <View style={s.approveBtns}>
              <TouchableOpacity
                style={[s.approveBtn, s.approveBtnReject]}
                onPress={() => handleApprove(false)}
                disabled={approving}
                activeOpacity={0.8}
              >
                {approving
                  ? <ActivityIndicator color="#ff4a6e" size="small" />
                  : <Text style={[s.approveBtnText, { color: '#ff4a6e' }]}>✕ Hafna</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.approveBtn, s.approveBtnAccept]}
                onPress={() => handleApprove(true)}
                disabled={approving}
                activeOpacity={0.8}
              >
                {approving
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[s.approveBtnText, { color: '#000' }]}>✓ Samþykkja</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isWinner && challenge.status === 'assigned' && (
          <View style={s.waitingRow}>
            <Text style={s.waitingText}>
              ⏳ {challenge.loser?.full_name ?? 'Vinur'} hefur ekki skilað sönnun enn
            </Text>
          </View>
        )}

        {isWinner && challenge.status === 'approved' && (
          <View style={s.completedRow}>
            <Text style={s.completedText}>✓ Þú samþykktir sönnunina</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardOverdue: {
    borderColor: 'rgba(255,74,110,0.25)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  titleBlock: { flex: 1 },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f0f0f8',
    marginBottom: 3,
  },
  involvedText: {
    fontSize: 12,
    color: '#9090aa',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueRow: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  dueRowNormal: { backgroundColor: 'rgba(255,201,64,0.08)' },
  dueRowOverdue: { backgroundColor: 'rgba(255,74,110,0.08)' },
  dueText: { fontSize: 12, fontWeight: '600' },
  proofPreview: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#22222f',
  },
  proofImage: {
    width: '100%',
    height: '100%',
  },
  proofOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  proofType: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  proofStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  proofStatusText: {
    fontSize: 11,
    color: '#000',
    fontWeight: '800',
  },
  stravaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,229,160,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  stravaIcon: { fontSize: 16 },
  stravaText: { flex: 1, fontSize: 13, color: '#9090aa', fontWeight: '500' },
  stravaStatus: { fontSize: 16, fontWeight: '800' },
  actions: { gap: 8 },
  uploadBtn: {
    backgroundColor: '#00e5a0',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadBtnRetry: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#ffc940',
  },
  uploadIcon: { fontSize: 16 },
  uploadText: { fontSize: 14, fontWeight: '800', color: '#000' },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
  },
  waitingText: { fontSize: 12, color: '#9090aa', flex: 1 },
  completedRow: {
    padding: 10,
    backgroundColor: 'rgba(0,229,160,0.08)',
    borderRadius: 10,
    alignItems: 'center',
  },
  completedText: { fontSize: 13, color: '#00e5a0', fontWeight: '700' },
  approveRow: { gap: 8 },
  approveQuestion: {
    fontSize: 13,
    color: '#9090aa',
    fontWeight: '600',
    textAlign: 'center',
  },
  approveBtns: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnReject: {
    backgroundColor: 'rgba(255,74,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,74,110,0.25)',
  },
  approveBtnAccept: {
    backgroundColor: '#00e5a0',
  },
  approveBtnText: { fontSize: 14, fontWeight: '800' },
});
