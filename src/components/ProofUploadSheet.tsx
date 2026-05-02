// src/components/ProofUploadSheet.tsx
// Full-featured proof upload bottom sheet
// Supports: camera photo, library photo/video, Strava auto-link

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import type { Challenge } from '../types/database';
import { EXERCISE_OPTIONS } from '../types/database';

const { height: SCREEN_H } = Dimensions.get('window');

const STRAVA_TRACKABLE_EXERCISES = ['hlaup', 'hjólreiðar', 'sund', 'rowing', 'interval_run'];

type UploadState = 'idle' | 'picked' | 'uploading' | 'done' | 'error';

type Props = {
  visible: boolean;
  challenge: Challenge | null;
  currentUserId: string;
  stravaConnected: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ProofUploadSheet({
  visible, challenge, currentUserId, stravaConnected, onClose, onSuccess,
}: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [pickedAsset, setPickedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [notes, setNotes] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (visible) {
      setUploadState('idle');
      setPickedAsset(null);
      setNotes('');
      setErrorMsg('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  async function requestPermission(type: 'camera' | 'library'): Promise<boolean> {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Leyfi þarf', 'Veittu FitBet aðgang að myndavél í stillingum.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Leyfi þarf', 'Veittu FitBet aðgang að myndasafni í stillingum.');
        return false;
      }
    }
    return true;
  }

  async function openCamera() {
    if (!(await requestPermission('camera'))) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedAsset(result.assets[0]);
      setUploadState('picked');
    }
  }

  async function openLibrary(type: 'photo' | 'video') {
    if (!(await requestPermission('library'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedAsset(result.assets[0]);
      setUploadState('picked');
    }
  }

  async function handleUpload() {
    if (!challenge || !pickedAsset) return;
    setUploadState('uploading');
    setUploadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 12, 85));
      }, 200);

      const isVideo = pickedAsset.type === 'video';
      const ext = isVideo ? 'mp4' : 'jpg';
      const fileName = `${currentUserId}/${challenge.id}_${Date.now()}.${ext}`;
      const contentType = isVideo ? 'video/mp4' : 'image/jpeg';

      // Read file as base64 — works with both file:// and content:// URIs on Android
      const base64 = await FileSystem.readAsStringAsync(pickedAsset.uri, {
        encoding: 'base64' as any,
      });
      const byteArray = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('challenge-proofs')
        .upload(fileName, byteArray, { contentType, upsert: false });

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      setUploadProgress(92);

      // Get URL
      const { data: { publicUrl } } = supabase.storage
        .from('challenge-proofs')
        .getPublicUrl(fileName);

      // Insert proof record
      const { error: proofError } = await supabase
        .from('challenge_proofs')
        .insert({
          challenge_id: challenge.id,
          submitted_by: currentUserId,
          proof_type: isVideo ? 'video' : 'photo',
          file_url: publicUrl,
          notes: notes.trim() || null,
        });

      if (proofError) throw proofError;

      // Update challenge status
      const { error: updateError } = await supabase
        .from('challenges')
        .update({ status: 'submitted' })
        .eq('id', challenge.id);

      if (updateError) throw updateError;

      // Notify winner
      await supabase.from('notifications').insert({
        user_id: challenge.winner_id,
        type: 'challenge_submitted',
        title: 'Sönnun móttekin! 📸',
        body: `${challenge.loser?.full_name ?? 'Vinur'} sendi sönnun fyrir áskorunina.`,
        data: { type: 'challenge_submitted', challenge_id: challenge.id },
      });

      setUploadProgress(100);
      setUploadState('done');

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadState('error');
      setErrorMsg(err?.message ?? 'Óþekkt villa');
    }
  }


  if (!challenge) return null;

  const exOpt = EXERCISE_OPTIONS[challenge.exercise as keyof typeof EXERCISE_OPTIONS];
  const emojiMap: Record<string, string> = {
    hlaup:'🏃', armbeygjur:'💪', hnébeygjur:'🦵', burpees:'🔥', hjólreiðar:'🚴', planki:'🧱',
    sund:'🏊', pullups:'🏋️', hiit:'⚡', interval_run:'🏃',
    jump_rope:'🪢', box_jumps:'🦘', stairmaster:'🪜', rowing:'🚣',
    gongutur:'🚶', situps:'🪑', dips:'💺', mountain_climbers:'🧗',
  };
  const emoji = emojiMap[challenge.exercise] ?? '💪';

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none" statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}
        onStartShouldSetResponder={() => { if (uploadState !== 'uploading') { onClose(); } return true; }}
      />

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Handle */}
        <View style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Senda sönnun</Text>
          {uploadState !== 'uploading' && (
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Challenge summary */}
        <View style={s.challengeSummary}>
          <View style={s.summaryIcon}>
            <Text style={s.summaryEmoji}>{emoji}</Text>
          </View>
          <View style={s.summaryText}>
            <Text style={s.summaryTitle}>
              {challenge.amount} {exOpt?.unit} {exOpt?.label}
            </Text>
            <Text style={s.summarySub}>
              Sönnunargjald til {challenge.winner?.full_name ?? 'Vinar'}
            </Text>
          </View>
        </View>

        {/* ── STATE: idle ── */}
        {uploadState === 'idle' && (
          <View style={s.body}>
            {STRAVA_TRACKABLE_EXERCISES.includes(challenge.exercise) && stravaConnected ? (
              <View style={s.stravaAutoBox}>
                <Text style={s.stravaAutoEmoji}>🟠</Text>
                <Text style={s.stravaAutoTitle}>Strava sér um þetta sjálfkrafa</Text>
                <Text style={s.stravaAutoSub}>
                  Opnaðu appið eftir æfinguna og við finnum hana sjálfkrafa.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionLabel}>VELDU TEGUND SÖNNUNAR</Text>

                <TouchableOpacity style={s.optionRow} onPress={openCamera} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(0,229,160,0.12)' }]}>
                    <Text style={s.optionEmoji}>📷</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Taka mynd núna</Text>
                    <Text style={s.optionSub}>Opnar myndavél beint</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('photo')} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(61,139,255,0.12)' }]}>
                    <Text style={s.optionEmoji}>🖼</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Velja mynd úr safni</Text>
                    <Text style={s.optionSub}>Myndir á símanum þínum</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('video')} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(255,201,64,0.12)' }]}>
                    <Text style={s.optionEmoji}>🎬</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Hlaða upp myndband</Text>
                    <Text style={s.optionSub}>Hámark 60 sekúndur</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                {STRAVA_TRACKABLE_EXERCISES.includes(challenge.exercise) && !stravaConnected && (
                  <View style={s.stravaPrompt}>
                    <Text style={s.stravaPromptText}>
                      💡 Tengdu Strava til að fá sjálfvirka samþykkt
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── STATE: picked ── */}
        {uploadState === 'picked' && pickedAsset && (
          <View style={s.body}>
            <Text style={s.sectionLabel}>FORSKOÐUN</Text>

            <View style={s.previewContainer}>
              {pickedAsset.type !== 'video' ? (
                <Image source={{ uri: pickedAsset.uri }} style={s.previewImage} resizeMode="cover" />
              ) : (
                <View style={s.videoPlaceholder}>
                  <Text style={s.videoIcon}>▶</Text>
                  <Text style={s.videoText}>Myndband valið</Text>
                  <Text style={s.videoDuration}>
                    {pickedAsset.duration ? `${Math.round(pickedAsset.duration)}s` : ''}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={s.changeBtn} onPress={() => setUploadState('idle')}>
                <Text style={s.changeBtnText}>Skipta út</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.sectionLabel, { marginTop: 16 }]}>ATHUGASEMD (valfrjálst)</Text>
            <TextInput
              style={s.notesInput}
              placeholder="t.d. Hljóp á Laugavegi í dag..."
              placeholderTextColor="#3a3a52"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              maxLength={200}
            />

            <TouchableOpacity style={s.submitBtn} onPress={handleUpload} activeOpacity={0.85}>
              <Text style={s.submitBtnText}>Senda sönnun 📤</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelLink} onPress={() => setUploadState('idle')}>
              <Text style={s.cancelLinkText}>Til baka</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STATE: uploading ── */}
        {uploadState === 'uploading' && (
          <View style={[s.body, s.centeredState]}>
            <View style={s.uploadingCircle}>
              <ActivityIndicator color="#00e5a0" size="large" />
            </View>
            <Text style={s.uploadingTitle}>Hleður upp...</Text>
            <Text style={s.uploadingSub}>{uploadProgress}%</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${uploadProgress}%` as any }]} />
            </View>
          </View>
        )}

        {/* ── STATE: done ── */}
        {uploadState === 'done' && (
          <View style={[s.body, s.centeredState]}>
            <View style={[s.uploadingCircle, { backgroundColor: 'rgba(0,229,160,0.12)' }]}>
              <Text style={{ fontSize: 44 }}>✅</Text>
            </View>
            <Text style={[s.uploadingTitle, { color: '#00e5a0' }]}>Sönnun send!</Text>
            <Text style={s.uploadingSub}>
              {challenge.winner?.full_name ?? 'Vinur'} fær tilkynningu til að samþykkja
            </Text>
          </View>
        )}

        {/* ── STATE: error ── */}
        {uploadState === 'error' && (
          <View style={[s.body, s.centeredState]}>
            <Text style={{ fontSize: 44, marginBottom: 14 }}>❌</Text>
            <Text style={[s.uploadingTitle, { color: '#ff4a6e' }]}>Eitthvað fór úrskeiðis</Text>
            <Text style={s.uploadingSub}>{errorMsg || 'Athugaðu tengingu og reyndu aftur'}</Text>
            <TouchableOpacity style={[s.submitBtn, { marginTop: 20, backgroundColor: '#ff4a6e' }]}
              onPress={() => setUploadState('idle')}>
              <Text style={s.submitBtnText}>Reyna aftur</Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    </Modal>
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
    backgroundColor: '#111118',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: SCREEN_H * 0.85,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f0f0f8' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#9090aa', fontSize: 14, fontWeight: '700' },
  challengeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1a1a24',
    borderRadius: 14,
    padding: 14,
  },
  summaryIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,229,160,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryEmoji: { fontSize: 22 },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: '#f0f0f8' },
  summarySub: { fontSize: 12, color: '#9090aa', marginTop: 2 },
  body: { paddingHorizontal: 20, gap: 0 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: '#5a5a72',
    letterSpacing: 1.5, marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  optionIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  optionEmoji: { fontSize: 20 },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: '#f0f0f8' },
  optionSub: { fontSize: 12, color: '#5a5a72', marginTop: 2 },
  optionArrow: { fontSize: 18, color: '#3a3a52' },
  stravaOption: { borderBottomWidth: 0, marginTop: 4 },
  stravaBadge: {
    backgroundColor: 'rgba(0,229,160,0.12)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  stravaBadgeText: { fontSize: 11, fontWeight: '700', color: '#00e5a0' },
  stravaAutoBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  stravaAutoEmoji: { fontSize: 40, marginBottom: 12 },
  stravaAutoTitle: { fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 8 },
  stravaAutoSub: { fontSize: 14, color: '#7a9aaa', textAlign: 'center', lineHeight: 20 },
  stravaPrompt: { marginTop: 12, backgroundColor: 'rgba(252,82,0,0.08)', borderRadius: 8, padding: 10 },
  stravaPromptText: { fontSize: 13, color: '#FC5200', textAlign: 'center' },
  previewContainer: { position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  previewImage: { width: '100%', height: 200 },
  videoPlaceholder: {
    height: 200, backgroundColor: '#22222f',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  videoIcon: { fontSize: 40, color: '#9090aa' },
  videoText: { fontSize: 15, fontWeight: '700', color: '#f0f0f8' },
  videoDuration: { fontSize: 12, color: '#5a5a72' },
  changeBtn: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  changeBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  notesInput: {
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    color: '#f0f0f8',
    fontSize: 14,
    marginBottom: 16,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#00e5a0',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  cancelLink: { alignItems: 'center', paddingVertical: 12 },
  cancelLinkText: { fontSize: 13, color: '#5a5a72', fontWeight: '600' },
  centeredState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  uploadingCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,229,160,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  uploadingTitle: { fontSize: 20, fontWeight: '800', color: '#f0f0f8' },
  uploadingSub: { fontSize: 13, color: '#9090aa', textAlign: 'center', paddingHorizontal: 20 },
  progressTrack: {
    width: '70%', height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2, marginTop: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#00e5a0', borderRadius: 2 },
});
