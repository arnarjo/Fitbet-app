// src/components/BetModal.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import type { Match, MatchResult, Exercise, Profile } from '../types/database';
import { EXERCISE_OPTIONS } from '../types/database';
import { supabase } from '../lib/supabase';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.88;

type Step = 'prediction' | 'opponent' | 'challenge' | 'confirm';

type Props = {
  visible: boolean;
  match: Match | null;
  initialPrediction?: MatchResult | null;
  currentUserId: string;
  onClose: () => void;
  onSubmit: (
    matchId: string,
    opponentId: string,
    prediction: MatchResult,
    exercise: Exercise,
    amount: number,
    unit: string,
  ) => Promise<{ error: any }>;
};

const STEPS: Step[] = ['prediction', 'opponent', 'challenge', 'confirm'];
const STEP_LABELS = ['Spá', 'Andstæðingur', 'Áskorun', 'Staðfesta'];

const LEAGUE_COLORS: Record<string, string> = {
  'Premier League': '#00e5a0',
  'UEFA Champions League': '#3d8bff',
  'Besta deild karla': '#ffc940',
  'Lengjudeild karla': '#ff9f40',
  '2. deild karla': '#ff4a6e',
};

export default function BetModal({
  visible, match, initialPrediction, currentUserId, onClose, onSubmit,
}: Props) {
  const [step, setStep] = useState<Step>('prediction');
  const [prediction, setPrediction] = useState<MatchResult | null>(initialPrediction ?? null);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const accentColor = match ? (LEAGUE_COLORS[match.league_name] ?? '#00e5a0') : '#00e5a0';

  // Open / close animations
  useEffect(() => {
    if (visible) {
      setStep('prediction');
      if (initialPrediction) setPrediction(initialPrediction);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      fetchFriends();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SHEET_H, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Reset when prediction changes from outside
  useEffect(() => {
    if (initialPrediction) setPrediction(initialPrediction);
  }, [initialPrediction]);

  async function fetchFriends() {
    setLoadingFriends(true);
    const { data } = await supabase
      .from('friendships')
      .select(`
        requester:profiles!requester_id(*),
        addressee:profiles!addressee_id(*)
      `)
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

    if (data) {
      const list = data.map((f: any) =>
        f.requester.id === currentUserId ? f.addressee : f.requester
      ) as Profile[];
      setFriends(list);
    }
    setLoadingFriends(false);
  }

  // Drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.2) {
          onClose();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  function canProceed(): boolean {
    if (step === 'prediction') return prediction !== null;
    if (step === 'opponent') return opponent !== null;
    if (step === 'challenge') return exercise !== null && amount !== null;
    return true;
  }

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
    else onClose();
  }

  async function handleSubmit() {
    if (!match || !opponent || !prediction || !exercise || !amount) return;
    setSubmitting(true);
    const selectedExercise = EXERCISE_OPTIONS[exercise];
    const { error } = await onSubmit(
      match.id,
      opponent.id,
      prediction,
      exercise,
      amount,
      selectedExercise.unit,
    );
    setSubmitting(false);
    if (error) {
      Alert.alert('Villa', 'Ekki tókst að senda veðmál. Reyndu aftur.');
    } else {
      onClose();
      // Reset state
      setPrediction(null);
      setOpponent(null);
      setExercise(null);
      setAmount(null);
    }
  }

  if (!match) return null;

  const stepIdx = STEPS.indexOf(step);

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none" statusBarTranslucent>

      {/* Backdrop */}
      <Animated.View
        style={[s.backdrop, { opacity: backdropAnim }]}
        onStartShouldSetResponder={() => { onClose(); return true; }}
      />

      {/* Sheet */}
      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY: Animated.add(slideAnim, panY) }] },
        ]}
      >
        {/* Drag handle */}
        <View style={s.handleArea} {...panResponder.panHandlers}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Text style={s.backText}>{stepIdx === 0 ? '✕' : '←'}</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerMatch} numberOfLines={1}>
              {match.home_team?.short_name} vs {match.away_team?.short_name}
            </Text>
            <Text style={[s.headerLeague, { color: accentColor }]}>{match.league_name}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress bar */}
        <View style={s.progressBar}>
          <View
            style={[
              s.progressFill,
              {
                width: `${((stepIdx + 1) / STEPS.length) * 100}%` as any,
                backgroundColor: accentColor,
              },
            ]}
          />
        </View>

        {/* Step indicators */}
        <View style={s.stepsRow}>
          {STEPS.map((st, i) => (
            <View key={st} style={s.stepItem}>
              <View style={[
                s.stepDot,
                i <= stepIdx && { backgroundColor: accentColor, borderColor: accentColor },
                i === stepIdx && s.stepDotActive,
              ]}>
                {i < stepIdx
                  ? <Text style={s.stepCheck}>✓</Text>
                  : <Text style={[s.stepNum, i <= stepIdx && { color: '#000' }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[s.stepLabel, i === stepIdx && { color: accentColor }]}>
                {STEP_LABELS[i]}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── STEP 1: Prediction ── */}
          {step === 'prediction' && (
            <View>
              <Text style={s.stepTitle}>Hvað heldur þú?</Text>
              <Text style={s.stepSub}>Veldu spá þína fyrir leikinn</Text>

              <View style={s.matchPreview}>
                <View style={s.previewTeam}>
                  <Text style={s.previewName}>{match.home_team?.name}</Text>
                  <Text style={s.previewSub}>Heimalið</Text>
                </View>
                <View style={s.previewMiddle}>
                  <Text style={s.previewVs}>VS</Text>
                  <Text style={s.previewTime}>{formatKickoff(match.kickoff_time)}</Text>
                </View>
                <View style={[s.previewTeam, { alignItems: 'flex-end' }]}>
                  <Text style={s.previewName}>{match.away_team?.name}</Text>
                  <Text style={s.previewSub}>Útlið</Text>
                </View>
              </View>

              <View style={s.predGrid}>
                {(['home', 'draw', 'away'] as MatchResult[]).map((pred) => {
                  const isSel = prediction === pred;
                  const label = pred === 'home'
                    ? match.home_team?.name ?? 'Heimalið'
                    : pred === 'away'
                    ? match.away_team?.name ?? 'Útlið'
                    : 'Jafntefli';
                  const sub = pred === 'home' ? 'Heimalið vinnur'
                    : pred === 'away' ? 'Útlið vinnur'
                    : 'Engin vinnur';
                  return (
                    <TouchableOpacity
                      key={pred}
                      style={[s.predCard, isSel && { borderColor: accentColor, backgroundColor: accentColor + '14' }]}
                      onPress={() => setPrediction(pred)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.predLabel, isSel && { color: accentColor }]}>{label}</Text>
                      <Text style={s.predSub}>{sub}</Text>
                      {isSel && <View style={[s.predCheck, { backgroundColor: accentColor }]}><Text style={s.predCheckText}>✓</Text></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── STEP 2: Opponent ── */}
          {step === 'opponent' && (
            <View>
              <Text style={s.stepTitle}>Veðjaðu við hinn</Text>
              <Text style={s.stepSub}>Veldu vini til að veðja við</Text>

              {loadingFriends ? (
                <ActivityIndicator color={accentColor} style={{ marginTop: 40 }} />
              ) : friends.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyIcon}>👥</Text>
                  <Text style={s.emptyTitle}>Engir vinir ennþá</Text>
                  <Text style={s.emptySub}>Bættu við vinum í Vinir flipanum til að geta veðjað</Text>
                </View>
              ) : (
                friends.map((f) => {
                  const isSel = opponent?.id === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[s.friendRow, isSel && { borderColor: accentColor, backgroundColor: accentColor + '0e' }]}
                      onPress={() => setOpponent(f)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.friendAvatar, { backgroundColor: accentColor + '20' }]}>
                        <Text style={[s.friendInitials, { color: accentColor }]}>
                          {getInitials(f.full_name ?? f.username)}
                        </Text>
                      </View>
                      <View style={s.friendInfo}>
                        <Text style={s.friendName}>{f.full_name ?? f.username}</Text>
                        <Text style={s.friendHandle}>@{f.username}</Text>
                      </View>
                      {isSel && (
                        <View style={[s.selectedBadge, { backgroundColor: accentColor }]}>
                          <Text style={s.selectedBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ── STEP 3: Challenge ── */}
          {step === 'challenge' && (
            <View>
              <Text style={s.stepTitle}>Velja áskorun</Text>
              <Text style={s.stepSub}>Sá sem tapar þarf að klára þessa áskorun</Text>

              {/* Exercise picker */}
              <Text style={s.sectionLabel}>ÆFING</Text>
              <View style={s.exerciseGrid}>
                {(Object.entries(EXERCISE_OPTIONS) as [Exercise, typeof EXERCISE_OPTIONS[Exercise]][]).map(([key, opt]) => {
                  const isSel = exercise === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[s.exCard, isSel && { borderColor: accentColor, backgroundColor: accentColor + '12' }]}
                      onPress={() => { setExercise(key); setAmount(null); }}
                      activeOpacity={0.8}
                    >
                      <Text style={s.exEmoji}>{getExerciseEmoji(key)}</Text>
                      <Text style={[s.exLabel, isSel && { color: accentColor }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Amount picker */}
              {exercise && (
                <>
                  <Text style={[s.sectionLabel, { marginTop: 20 }]}>MAGN</Text>
                  <View style={s.amountRow}>
                    {EXERCISE_OPTIONS[exercise].amounts.map((a) => {
                      const isSel = amount === a;
                      return (
                        <TouchableOpacity
                          key={a}
                          style={[s.amountBtn, isSel && { borderColor: accentColor, backgroundColor: accentColor + '14' }]}
                          onPress={() => setAmount(a)}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.amountNum, isSel && { color: accentColor }]}>{a}</Text>
                          <Text style={[s.amountUnit, isSel && { color: accentColor + 'cc' }]}>
                            {EXERCISE_OPTIONS[exercise].unit}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── STEP 4: Confirm ── */}
          {step === 'confirm' && prediction && opponent && exercise && amount && (
            <View>
              <Text style={s.stepTitle}>Staðfesta veðmál</Text>
              <Text style={s.stepSub}>Athugaðu allt vel áður en þú sendir</Text>

              <View style={s.confirmCard}>
                {/* Match */}
                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>⚽ Leikur</Text>
                  <Text style={s.confirmVal}>
                    {match.home_team?.short_name} vs {match.away_team?.short_name}
                  </Text>
                </View>
                <View style={s.confirmDivider} />

                {/* Prediction */}
                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>🎯 Spá þín</Text>
                  <Text style={[s.confirmVal, { color: accentColor }]}>
                    {prediction === 'home'
                      ? match.home_team?.name
                      : prediction === 'away'
                      ? match.away_team?.name
                      : 'Jafntefli'}
                  </Text>
                </View>
                <View style={s.confirmDivider} />

                {/* Opponent */}
                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>👤 Gegn</Text>
                  <Text style={s.confirmVal}>{opponent.full_name ?? opponent.username}</Text>
                </View>
                <View style={s.confirmDivider} />

                {/* Challenge */}
                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>💪 Áskorun</Text>
                  <Text style={[s.confirmVal, { color: '#ff4a6e' }]}>
                    {amount} {EXERCISE_OPTIONS[exercise].unit} {EXERCISE_OPTIONS[exercise].label}
                  </Text>
                </View>
              </View>

              <View style={s.confirmNote}>
                <Text style={s.confirmNoteText}>
                  Ef þú tapar þarftu að klára {amount} {EXERCISE_OPTIONS[exercise].unit} {EXERCISE_OPTIONS[exercise].label.toLowerCase()} og senda sönnun til {opponent.full_name ?? opponent.username}.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.ctaBtn, { backgroundColor: accentColor }, !canProceed() && s.ctaDisabled]}
            onPress={step === 'confirm' ? handleSubmit : goNext}
            disabled={!canProceed() || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#000" />
              : <Text style={s.ctaText}>
                  {step === 'confirm' ? 'Senda veðmál 🏆' : 'Áfram →'}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Modal>
  );
}

// ── Helpers ──

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getExerciseEmoji(ex: Exercise): string {
  const map: Record<Exercise, string> = {
    hlaup: '🏃',
    armbeygjur: '💪',
    hnébeygjur: '🦵',
    burpees: '🔥',
    hjólreiðar: '🚴',
    planki: '🧱',
  };
  return map[ex];
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString('is-IS', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Í dag · ${time}`;
  if (isTomorrow) return `Á morgun · ${time}`;
  return d.toLocaleDateString('is-IS', { weekday: 'short', day: 'numeric', month: 'short' }) + ` · ${time}`;
}

// ── Styles ──
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#111118',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#f0f0f8', fontSize: 16, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerMatch: { fontSize: 15, fontWeight: '800', color: '#f0f0f8' },
  headerLeague: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 1 },
  stepsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { transform: [{ scale: 1.1 }] },
  stepNum: { fontSize: 11, fontWeight: '800', color: '#5a5a72' },
  stepCheck: { fontSize: 11, fontWeight: '800', color: '#000' },
  stepLabel: { fontSize: 10, color: '#5a5a72', fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#f0f0f8', marginBottom: 4 },
  stepSub: { fontSize: 13, color: '#9090aa', marginBottom: 20, lineHeight: 18 },

  // Match preview
  matchPreview: {
    flexDirection: 'row',
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  previewTeam: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '800', color: '#f0f0f8', lineHeight: 18 },
  previewSub: { fontSize: 10, color: '#5a5a72', marginTop: 2 },
  previewMiddle: { alignItems: 'center', width: 60 },
  previewVs: { fontSize: 10, fontWeight: '800', color: '#5a5a72' },
  previewTime: { fontSize: 10, color: '#3a3a52', marginTop: 2, textAlign: 'center' },

  // Prediction cards
  predGrid: { gap: 10 },
  predCard: {
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    position: 'relative',
  },
  predLabel: { fontSize: 16, fontWeight: '800', color: '#f0f0f8', marginBottom: 3 },
  predSub: { fontSize: 12, color: '#5a5a72' },
  predCheck: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predCheckText: { color: '#000', fontSize: 11, fontWeight: '800' },

  // Friends
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  friendAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitials: { fontSize: 15, fontWeight: '800' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', color: '#f0f0f8' },
  friendHandle: { fontSize: 12, color: '#5a5a72', marginTop: 2 },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { color: '#000', fontSize: 12, fontWeight: '800' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0f0f8', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#5a5a72', textAlign: 'center', lineHeight: 20 },

  // Exercise
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5a5a72',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exCard: {
    width: '30.5%',
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  exEmoji: { fontSize: 22 },
  exLabel: { fontSize: 11, fontWeight: '700', color: '#9090aa', textAlign: 'center' },

  // Amount
  amountRow: { flexDirection: 'row', gap: 10 },
  amountBtn: {
    flex: 1,
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  amountNum: { fontSize: 22, fontWeight: '900', color: '#f0f0f8' },
  amountUnit: { fontSize: 11, color: '#5a5a72', fontWeight: '600', marginTop: 2 },

  // Confirm
  confirmCard: {
    backgroundColor: '#1a1a24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    marginBottom: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmKey: { fontSize: 13, color: '#9090aa' },
  confirmVal: { fontSize: 13, fontWeight: '700', color: '#f0f0f8', maxWidth: '55%', textAlign: 'right' },
  confirmDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  confirmNote: {
    backgroundColor: 'rgba(255,74,110,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,74,110,0.15)',
    padding: 14,
  },
  confirmNoteText: { fontSize: 13, color: '#ff9090', lineHeight: 20 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#111118',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
