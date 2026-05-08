import React, { useState, useRef, useEffect } from 'react';
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
  TextInput,
  Share,
} from 'react-native';
import type { Match, MatchResult, Exercise, Profile } from '../types/database';
import { EXERCISE_OPTIONS, PREMIUM_EXERCISES, AVAILABLE_EXERCISES } from '../types/database';
import { supabase } from '../lib/supabase';
import { LEAGUE_COLOR } from '../constants/leagues';
import { useLanguage } from '../hooks/useLanguage';
import { usePremium } from '../hooks/usePremium';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.88;

type Step = 'prediction' | 'opponent' | 'challenge' | 'confirm' | 'success';

type Props = {
  visible: boolean;
  match: Match | null;
  initialPrediction?: MatchResult | null;
  currentUserId: string;
  onClose: () => void;
  onPremiumRequired?: () => void;
  onSubmit: (
    matchId: string,
    opponentId: string,
    prediction: MatchResult,
    exercise: Exercise,
    amount: number,
    unit: string,
  ) => Promise<{ error: any; betId?: string }>;
};

const STEPS: Step[] = ['prediction', 'opponent', 'challenge', 'confirm'];

export default function BetModal({
  visible,
  match,
  initialPrediction,
  currentUserId,
  onClose,
  onPremiumRequired,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<Step>('prediction');
  const [prediction, setPrediction] = useState<MatchResult | null>(initialPrediction ?? null);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newBetId, setNewBetId]     = useState<string | null>(null);

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const { t, lang } = useLanguage() as any;
  const { canUseCustomChallenges } = usePremium();

  const STEP_LABELS = [t('bet_modal_your_pred'), t('bet_modal_opponent'), t('bet_modal_challenge_if'), t('common_confirm')];

  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const accentColor = match ? (LEAGUE_COLOR[match.league_name] ?? '#21A56A') : '#21A56A';

  useEffect(() => {
    if (visible) {
      setStep('prediction');
      setOpponent(null);
      setExercise(null);
      setAmount(null);
      if (initialPrediction) setPrediction(initialPrediction);
      else setPrediction(null);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      fetchFriends();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_H,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, initialPrediction]);

  async function fetchFriends() {
    if (loadingFriends) return;
    setLoadingFriends(true);

    // Get friend IDs to sort them to the top
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
      .eq('status', 'accepted');

    const friendIds = new Set(
      (friendships ?? []).map((f: any) =>
        f.requester_id === currentUserId ? f.addressee_id : f.requester_id
      )
    );

    // Load all users (friends first, then others)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', currentUserId)
      .order('username', { ascending: true })
      .limit(50);

    const all = (data ?? []) as Profile[];
    // Sort: friends first
    all.sort((a, b) => {
      const aF = friendIds.has(a.id) ? 0 : 1;
      const bF = friendIds.has(b.id) ? 0 : 1;
      return aF - bF;
    });

    setFriends(all);
    setLoadingFriends(false);
  }

  function handleSearchChange(q: string) {
    setUserSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => doSearch(q.trim()), 300);
  }

  async function doSearch(q: string) {
    if (q.length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', currentUserId)
      .limit(8);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) panY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.2) {
          onClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
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

    const selectedExercise = EXERCISE_OPTIONS[exercise];
    if (!selectedExercise) {
      Alert.alert(t('common_error'), 'Invalid exercise. Try again.');
      return;
    }

    setSubmitting(true);
    try {
      const { error, betId } = await onSubmit(
        match.id,
        opponent.id,
        prediction,
        exercise,
        amount,
        selectedExercise.unit,
      );

      if (error) {
        Alert.alert(t('bet_modal_err'), t('bet_modal_err_msg'));
      } else {
        setNewBetId(betId ?? null);
        setStep('success');
      }
    } catch {
      Alert.alert(t('bet_modal_err'), t('bet_modal_unexpected_err'));
    } finally {
      setSubmitting(false);
    }
  }

  async function shareBet() {
    if (!newBetId) return;
    const inviteUrl = `${SUPABASE_URL}/functions/v1/bet-invite?id=${newBetId}`;
    await Share.share({
      message: `${opponent?.full_name ?? opponent?.username} — ég bauð þér veðmál á FitBet! 🎯\n${inviteUrl}`,
      url: inviteUrl,
    });
  }

  function closeSuccess() {
    setStep('prediction');
    setNewBetId(null);
    setPrediction(null);
    setOpponent(null);
    setExercise(null);
    setAmount(null);
    onClose();
  }

  if (!match) return null;

  const stepIdx = STEPS.indexOf(step);

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        style={[s.backdrop, { opacity: backdropAnim }]}
        onStartShouldSetResponder={() => {
          onClose();
          return true;
        }}
      />

      <Animated.View
        style={[
          s.sheet,
          { transform: [{ translateY: Animated.add(slideAnim, panY) }] },
        ]}
      >
        <View style={s.handleArea} {...panResponder.panHandlers}>
          <View style={s.handle} />
        </View>

        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <Text style={s.backText}>{stepIdx === 0 ? '✕' : '←'}</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerMatch} numberOfLines={1}>
              {match.home_team?.short_name} vs {match.away_team?.short_name}
            </Text>
            <Text style={[s.headerLeague, { color: accentColor }]}>
              {match.league_name}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

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

        <View style={s.stepsRow}>
          {STEPS.map((st, i) => (
            <View key={st} style={s.stepItem}>
              <View
                style={[
                  s.stepDot,
                  i <= stepIdx && {
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                  },
                  i === stepIdx && s.stepDotActive,
                ]}
              >
                {i < stepIdx ? (
                  <Text style={s.stepCheck}>✓</Text>
                ) : (
                  <Text style={[s.stepNum, i <= stepIdx && { color: '#000' }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text style={[s.stepLabel, i === stepIdx && { color: accentColor }]}>
                {STEP_LABELS[i]}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          style={s.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'prediction' && (
            <View>
              <Text style={s.stepTitle}>{t('bet_modal_pred_title')}</Text>
              <Text style={s.stepSub}>{t('bet_modal_pred_sub')}</Text>

              <View style={s.matchPreview}>
                <View style={s.previewTeam}>
                  <Text style={s.previewName}>{match.home_team?.name}</Text>
                  <Text style={s.previewSub}>{t('bet_modal_home')}</Text>
                </View>
                <View style={s.previewMiddle}>
                  <Text style={s.previewVs}>VS</Text>
                  <Text style={s.previewTime}>{formatKickoff(match.kickoff_time, lang)}</Text>
                </View>
                <View style={[s.previewTeam, { alignItems: 'flex-end' }]}>
                  <Text style={s.previewName}>{match.away_team?.name}</Text>
                  <Text style={s.previewSub}>{t('bet_modal_away')}</Text>
                </View>
              </View>

              <View style={s.predGrid}>
                {(['home', 'draw', 'away'] as MatchResult[]).map((pred) => {
                  const isSel = prediction === pred;
                  const label =
                    pred === 'home'
                      ? match.home_team?.name ?? t('bet_modal_home_team')
                      : pred === 'away'
                      ? match.away_team?.name ?? t('bet_modal_away_team')
                      : t('matches_predict_draw');

                  return (
                    <TouchableOpacity
                      key={pred}
                      style={[
                        s.predCard,
                        isSel && {
                          borderColor: accentColor,
                          backgroundColor: accentColor + '14',
                        },
                      ]}
                      onPress={() => setPrediction(pred)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.predLabel, isSel && { color: accentColor }]}>
                        {label}
                      </Text>
                      {isSel && (
                        <View
                          style={[s.predCheck, { backgroundColor: accentColor }]}
                        >
                          <Text style={s.predCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'opponent' && (
            <View>
              <Text style={s.stepTitle}>{t('bet_modal_opp_title')}</Text>
              <Text style={s.stepSub}>{t('bet_modal_opp_sub')}</Text>

              {/* Search box */}
              <View style={[s.searchWrap, { borderColor: accentColor + '40' }]}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder={t('friends_search_ph')}
                  placeholderTextColor="#2a4050"
                  value={userSearch}
                  onChangeText={handleSearchChange}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {userSearch.length > 0 && (
                  <TouchableOpacity onPress={() => { setUserSearch(''); setSearchResults([]); }}>
                    <Text style={s.searchClear}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loadingFriends ? (
                <ActivityIndicator color={accentColor} style={{ marginTop: 40 }} />
              ) : userSearch.length >= 2 ? (
                /* Search results */
                searching ? (
                  <ActivityIndicator color={accentColor} style={{ marginTop: 24 }} />
                ) : searchResults.length === 0 ? (
                  <Text style={s.emptyText}>{t('friends_no_results')} „{userSearch}"</Text>
                ) : (
                  searchResults.map((f) => {
                    const isSel = opponent?.id === f.id;
                    return <OpponentRow key={f.id} f={f} isSel={isSel} accentColor={accentColor} onPress={() => setOpponent(f)} />;
                  })
                )
              ) : (
                /* Friends list */
                friends.length === 0 ? (
                  <View style={s.emptyState}>
                    <Text style={s.emptyIcon}>👥</Text>
                    <Text style={s.emptyTitle}>{t('bet_modal_no_friends')}</Text>
                    <Text style={s.emptySub}>{t('bet_modal_no_friends_sub')}</Text>
                  </View>
                ) : (
                  friends.map((f) => {
                    const isSel = opponent?.id === f.id;
                    return <OpponentRow key={f.id} f={f} isSel={isSel} accentColor={accentColor} onPress={() => setOpponent(f)} />;
                  })
                )
              )}
            </View>
          )}

          {step === 'challenge' && (
            <View>
              <Text style={s.stepTitle}>{t('bet_modal_ex_title')}</Text>
              <Text style={s.stepSub}>{t('bet_modal_ex_sub')}</Text>

              <Text style={s.sectionLabel}>{t('bet_modal_ex_type')}</Text>
              <View style={s.exerciseGrid}>
                {AVAILABLE_EXERCISES.map((key) => {
                  const opt = EXERCISE_OPTIONS[key];
                  const isSel    = exercise === key;
                  const isPrem   = PREMIUM_EXERCISES.includes(key);
                  const isLocked = isPrem && !canUseCustomChallenges();
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        s.exCard,
                        isSel   && { borderColor: accentColor, backgroundColor: accentColor + '12' },
                        isLocked && s.exCardLocked,
                      ]}
                      onPress={() => {
                        if (isLocked) { onClose(); onPremiumRequired?.(); return; }
                        setExercise(key);
                        setAmount(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.exEmoji, isLocked && { opacity: 0.45 }]}>{getExerciseEmoji(key)}</Text>
                      <Text style={[s.exLabel, isSel && { color: accentColor }, isLocked && { opacity: 0.45 }]}>
                        {opt.label}
                      </Text>
                      {isPrem && (
                        <Text style={[s.exPremBadge, !isLocked && { color: '#f59e0b' }]}>
                          ⭐
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {exercise && (
                <>
                  <Text style={[s.sectionLabel, { marginTop: 20 }]}>{t('bet_modal_amount')}</Text>
                  <View style={s.amountRow}>
                    {EXERCISE_OPTIONS[exercise].amounts.map((a) => {
                      const isSel = amount === a;
                      return (
                        <TouchableOpacity
                          key={a}
                          style={[
                            s.amountBtn,
                            isSel && {
                              borderColor: accentColor,
                              backgroundColor: accentColor + '14',
                            },
                          ]}
                          onPress={() => setAmount(a)}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.amountNum, isSel && { color: accentColor }]}>
                            {a}
                          </Text>
                          <Text
                            style={[
                              s.amountUnit,
                              isSel && { color: accentColor + 'cc' },
                            ]}
                          >
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

          {step === 'confirm' && prediction && opponent && exercise && amount && (
            <View>
              <Text style={s.stepTitle}>{t('common_confirm')}</Text>
              <Text style={s.stepSub}>{t('bet_modal_confirm_sub')}</Text>

              <View style={s.confirmCard}>
                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>{t('bet_modal_row_match')}</Text>
                  <Text style={s.confirmVal}>
                    {match.home_team?.short_name} vs {match.away_team?.short_name}
                  </Text>
                </View>
                <View style={s.confirmDivider} />

                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>{t('bet_modal_row_pred')}</Text>
                  <Text style={[s.confirmVal, { color: accentColor }]}>
                    {prediction === 'home'
                      ? match.home_team?.name
                      : prediction === 'away'
                      ? match.away_team?.name
                      : t('matches_predict_draw')}
                  </Text>
                </View>
                <View style={s.confirmDivider} />

                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>{t('bet_modal_row_against')}</Text>
                  <Text style={s.confirmVal}>
                    {opponent.full_name ?? opponent.username}
                  </Text>
                </View>
                <View style={s.confirmDivider} />

                <View style={s.confirmRow}>
                  <Text style={s.confirmKey}>{t('bet_modal_row_exercise')}</Text>
                  <Text style={[s.confirmVal, { color: '#ff4a6e' }]}>
                    {amount} {EXERCISE_OPTIONS[exercise].unit}{' '}
                    {EXERCISE_OPTIONS[exercise].label}
                  </Text>
                </View>
              </View>

              <View style={s.confirmNote}>
                <Text style={s.confirmNoteText}>
                  {t('bet_modal_note_prefix')} {amount}{' '}
                  {EXERCISE_OPTIONS[exercise].unit}{' '}
                  {EXERCISE_OPTIONS[exercise].label.toLowerCase()}{' '}
                  {t('bet_modal_note_suffix')}{' '}
                  {opponent.full_name ?? opponent.username}.
                </Text>
              </View>
            </View>
          )}

          {step === 'success' && opponent && exercise && amount && (
            <View style={s.successWrap}>
              <Text style={s.successEmoji}>🎯</Text>
              <Text style={s.successTitle}>Veðmál sent!</Text>
              <Text style={s.successSub}>
                {opponent.full_name ?? opponent.username} fær tilkynningu og getur samþykkt eða hafnað.
              </Text>

              <TouchableOpacity style={s.shareBtn} onPress={shareBet} activeOpacity={0.8}>
                <Text style={s.shareBtnText}>📤  Deila veðmálsboði</Text>
              </TouchableOpacity>
              <Text style={s.shareHint}>Sendu hlekk til vinar sem er ekki á FitBet</Text>

              <TouchableOpacity style={s.closeSuccessBtn} onPress={closeSuccess} activeOpacity={0.7}>
                <Text style={s.closeSuccessText}>Loka</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {step !== 'success' && (
          <View style={s.bottomBar}>
            <TouchableOpacity
              style={[
                s.ctaBtn,
                { backgroundColor: accentColor },
                !canProceed() && s.ctaDisabled,
              ]}
              onPress={step === 'confirm' ? handleSubmit : goNext}
              disabled={!canProceed() || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={s.ctaText}>
                  {step === 'confirm' ? t('bet_modal_send') : t('onb_next')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

function OpponentRow({ f, isSel, accentColor, onPress }: { f: Profile; isSel: boolean; accentColor: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[s.friendRow, isSel && { borderColor: accentColor, backgroundColor: accentColor + '0e' }]}
      onPress={onPress}
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
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getExerciseEmoji(ex: Exercise): string {
  const map: Record<Exercise, string> = {
    hlaup:             '🏃',
    armbeygjur:        '💪',
    hnébeygjur:        '🦵',
    burpees:           '🔥',
    hjólreiðar:        '🚴',
    planki:            '🧱',
    sund:              '🏊',
    pullups:           '🏋️',
    hiit:              '⚡',
    interval_run:      '🏃',
    jump_rope:         '🪢',
    box_jumps:         '🦘',
    stairmaster:       '🪜',
    rowing:            '🚣',
    gongutur:          '🚶',
    situps:            '🪑',
    dips:              '💺',
    mountain_climbers: '🧗',
  };
  return map[ex] ?? '💪';
}

function formatKickoff(iso: string, lang: 'en' | 'is'): string {
  const locale = lang === 'is' ? 'is-IS' : 'en-GB';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `${lang === 'is' ? 'Í dag' : 'Today'} · ${time}`;
  if (isTomorrow) return `${lang === 'is' ? 'Á morgun' : 'Tomorrow'} · ${time}`;
  return (
    d.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) + ` · ${time}`
  );
}

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
    backgroundColor: '#071D2A',
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
  backText: { color: '#eef4f8', fontSize: 16, fontWeight: '700' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerMatch: { fontSize: 15, fontWeight: '800', color: '#eef4f8' },
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
  stepNum: { fontSize: 11, fontWeight: '800', color: '#4a6878' },
  stepCheck: { fontSize: 11, fontWeight: '800', color: '#000' },
  stepLabel: { fontSize: 10, color: '#4a6878', fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#eef4f8', marginBottom: 4 },
  stepSub: { fontSize: 13, color: '#7a9aaa', marginBottom: 20, lineHeight: 18 },

  matchPreview: {
    flexDirection: 'row',
    backgroundColor: '#0d2030',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
    gap: 8,
  },
  previewTeam: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '800', color: '#eef4f8', lineHeight: 18 },
  previewSub: { fontSize: 10, color: '#4a6878', marginTop: 2 },
  previewMiddle: { alignItems: 'center', width: 60 },
  previewVs: { fontSize: 10, fontWeight: '800', color: '#4a6878' },
  previewTime: { fontSize: 10, color: '#2a4050', marginTop: 2, textAlign: 'center' },

  predGrid: { gap: 10 },
  predCard: {
    backgroundColor: '#0d2030',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    position: 'relative',
  },
  predLabel: { fontSize: 16, fontWeight: '800', color: '#eef4f8', marginBottom: 3 },
  predSub: { fontSize: 12, color: '#4a6878' },
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

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0d2030',
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
  friendName: { fontSize: 15, fontWeight: '700', color: '#eef4f8' },
  friendHandle: { fontSize: 12, color: '#4a6878', marginTop: 2 },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: { color: '#000', fontSize: 12, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#eef4f8', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#4a6878', textAlign: 'center', lineHeight: 20 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a6878',
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
    backgroundColor: '#0d2030',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  exCardLocked: {
    borderColor: 'rgba(245,158,11,0.2)',
    backgroundColor: 'rgba(245,158,11,0.04)',
  },
  exEmoji: { fontSize: 22 },
  exLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7a9aaa',
    textAlign: 'center',
  },
  exPremBadge: {
    fontSize: 10,
    color: 'rgba(245,158,11,0.6)',
  },

  amountRow: { flexDirection: 'row', gap: 10 },
  amountBtn: {
    flex: 1,
    backgroundColor: '#0d2030',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  amountNum: { fontSize: 22, fontWeight: '900', color: '#eef4f8' },
  amountUnit: { fontSize: 11, color: '#4a6878', fontWeight: '600', marginTop: 2 },

  confirmCard: {
    backgroundColor: '#0d2030',
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
  confirmKey: { fontSize: 13, color: '#7a9aaa' },
  confirmVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#eef4f8',
    maxWidth: '55%',
    textAlign: 'right',
  },
  confirmDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  confirmNote: {
    backgroundColor: 'rgba(255,74,110,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,74,110,0.15)',
    padding: 14,
  },
  confirmNoteText: { fontSize: 13, color: '#ff9090', lineHeight: 20 },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#071D2A',
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0d2030', borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: '#eef4f8', fontSize: 14 },
  searchClear: { fontSize: 13, color: '#4a6878', padding: 2 },
  emptyText: { fontSize: 13, color: '#4a6878', textAlign: 'center', paddingVertical: 20 },

  successWrap: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#21A56A', marginBottom: 10 },
  successSub:   { fontSize: 15, color: '#8aabb8', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  shareBtn: {
    backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 28, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  shareBtnText:     { fontSize: 16, fontWeight: '800', color: '#000' },
  shareHint:        { fontSize: 12, color: '#4a6878', marginBottom: 32 },
  closeSuccessBtn:  { paddingVertical: 14, paddingHorizontal: 28 },
  closeSuccessText: { fontSize: 15, color: '#4a6878' },
});