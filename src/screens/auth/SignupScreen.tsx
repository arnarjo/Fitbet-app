// src/screens/auth/SignupScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';

type Props = { navigation: NativeStackNavigationProp<any> };
type FormErrors = { fullName?: string; username?: string; email?: string; password?: string; confirm?: string };
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

export default function SignupScreen({ navigation }: Props) {
  const { signUp, signInWithGoogle, signInWithFacebook } = useAuth();
  const { t } = useLanguage();
  const [fullName, setFullName]     = useState('');
  const [username, setUsername]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [errors, setErrors]         = useState<FormErrors>({});
  const [step, setStep]             = useState<1 | 2>(1);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) Alert.alert('Villa', 'Innskráning með Google mistókst, reyndu aftur.');
  }

  async function handleFacebookLogin() {
    setLoading(true);
    const { error } = await signInWithFacebook();
    setLoading(false);
    if (error) Alert.alert('Villa', 'Innskráning með Facebook mistókst, reyndu aftur.');
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  }

  function clearError(field: keyof FormErrors) {
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function validateStep1(): boolean {
    const newErrors: FormErrors = {};
    if (!fullName.trim()) newErrors.fullName = t('signup_err_name_req');
    else if (fullName.trim().length < 2) newErrors.fullName = t('signup_err_name_short');
    if (!username.trim()) newErrors.username = t('signup_err_user_req');
    else if (!USERNAME_REGEX.test(username)) newErrors.username = t('signup_err_user_inv');
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { shake(); return false; }
    return true;
  }

  function validateStep2(): boolean {
    const newErrors: FormErrors = {};
    if (!email.trim()) newErrors.email = t('signup_err_email_req');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) newErrors.email = t('signup_err_email_inv');
    if (!password) newErrors.password = t('signup_err_pw_req');
    else if (password.length < 8) newErrors.password = t('signup_err_pw_short');
    if (!confirm) newErrors.confirm = t('signup_err_pw_req');
    else if (password !== confirm) newErrors.confirm = t('signup_err_pw_match');
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { shake(); return false; }
    return true;
  }

  async function handleSignUp() {
    if (!validateStep2()) return;
    setLoading(true);
    const { error } = await signUp(email.trim(), password, username.trim(), fullName.trim());
    setLoading(false);
    if (error) {
      shake();
      if (error.message.includes('already registered')) {
        setErrors({ email: t('signup_err_email_req') }); setStep(2);
      } else if (error.message.includes('username')) {
        setErrors({ username: t('signup_err_user_taken') }); setStep(1);
      } else {
        Alert.alert(t('common_error'), error.message);
      }
    } else {
      Alert.alert('Welcome! 🎉', 'Check your email to confirm your account.',
        [{ text: t('common_ok'), onPress: () => navigation.navigate('Login') }]
      );
    }
  }

  function getPasswordStrength(): { label: string; color: string; width: string } {
    if (!password) return { label: '', color: 'transparent', width: '0%' };
    if (password.length < 6) return { label: 'Weak', color: '#ff4a6e', width: '25%' };
    if (password.length < 8) return { label: 'Fair', color: '#FFC845', width: '50%' };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasUpper || !hasNumber) return { label: 'Good', color: '#47C4EE', width: '75%' };
    return { label: 'Strong 💪', color: '#21A56A', width: '100%' };
  }

  const strength = getPasswordStrength();

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071D2A" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.backBtn} onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}>
            <Text style={s.backText}>{t('common_back')}</Text>
          </TouchableOpacity>

          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
          <Text style={s.progressLabel}>{t('signup_step')} {step} {t('signup_of')} 2</Text>

          <Text style={s.logo}>FITBET</Text>
          <Text style={s.title}>{step === 1 ? t('signup_title') : t('signup_title')}</Text>
          <Text style={s.subtitle}>{step === 1 ? t('signup_subtitle') : t('signup_subtitle')}</Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {step === 1 ? (
              <>
                <View style={s.inputGroup}>
                  <Text style={s.label}>{t('signup_fullname')}</Text>
                  <TextInput
                    style={[s.input, errors.fullName ? s.inputError : null]}
                    placeholder={t('signup_fullname_ph')}
                    placeholderTextColor="#2a4050"
                    value={fullName}
                    onChangeText={(v) => { setFullName(v); clearError('fullName'); }}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                  />
                  {errors.fullName && <Text style={s.errorText}>{errors.fullName}</Text>}
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>{t('signup_username')}</Text>
                  <View style={s.prefixRow}>
                    <View style={s.prefixBox}><Text style={s.prefixText}>@</Text></View>
                    <TextInput
                      style={[s.input, s.prefixInput, errors.username ? s.inputError : null]}
                      placeholder={t('signup_username_ph')}
                      placeholderTextColor="#2a4050"
                      value={username}
                      onChangeText={(v) => { setUsername(v.toLowerCase().replace(/\s/g, '')); clearError('username'); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => validateStep1() && setStep(2)}
                    />
                  </View>
                  {errors.username && <Text style={s.errorText}>{errors.username}</Text>}
                </View>

                <TouchableOpacity style={s.primaryBtn} onPress={() => validateStep1() && setStep(2)} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>{t('signup_next')}</Text>
                </TouchableOpacity>

                <View style={s.divider}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>eða</Text>
                  <View style={s.dividerLine} />
                </View>

                <TouchableOpacity style={s.googleBtn} onPress={handleGoogleLogin} disabled={loading} activeOpacity={0.85}>
                  <Text style={s.googleIcon}>G</Text>
                  <Text style={s.googleBtnText}>Halda áfram með Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.facebookBtn} onPress={handleFacebookLogin} disabled={loading} activeOpacity={0.85}>
                  <Text style={s.facebookIcon}>f</Text>
                  <Text style={s.facebookBtnText}>Halda áfram með Facebook</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.inputGroup}>
                  <Text style={s.label}>{t('login_email_label')}</Text>
                  <TextInput
                    style={[s.input, errors.email ? s.inputError : null]}
                    placeholder={t('login_email_ph')}
                    placeholderTextColor="#2a4050"
                    value={email}
                    onChangeText={(v) => { setEmail(v); clearError('email'); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                  />
                  {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>{t('signup_pw_label')}</Text>
                  <View style={s.passwordRow}>
                    <TextInput
                      style={[s.input, s.passwordInput, errors.password ? s.inputError : null]}
                      placeholder="••••••••"
                      placeholderTextColor="#2a4050"
                      value={password}
                      onChangeText={(v) => { setPassword(v); clearError('password'); }}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                      <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                  {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
                  {password.length > 0 && (
                    <View style={s.strengthRow}>
                      <View style={s.strengthTrack}>
                        <View style={[s.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
                      </View>
                      <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  )}
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>{t('signup_pw_confirm')}</Text>
                  <TextInput
                    style={[s.input, errors.confirm ? s.inputError : null, confirm.length > 0 && password === confirm ? s.inputSuccess : null]}
                    placeholder="••••••••"
                    placeholderTextColor="#2a4050"
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); clearError('confirm'); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                  />
                  {errors.confirm && <Text style={s.errorText}>{errors.confirm}</Text>}
                  {confirm.length > 0 && password === confirm && (
                    <Text style={s.successText}>✓ Passwords match</Text>
                  )}
                </View>

                <TouchableOpacity style={[s.primaryBtn, loading && s.primaryBtnDisabled]} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>{t('signup_create_btn')} 🚀</Text>}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkText}>
              {t('signup_have_account')}<Text style={{ color: '#21A56A', fontWeight: '700' }}>{t('signup_signin')}</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#071D2A' },
  scroll:          { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },
  backBtn:         { paddingTop: 8, paddingBottom: 12, alignSelf: 'flex-start' },
  backText:        { color: '#4a6878', fontSize: 14, fontWeight: '600' },
  progressBar:     { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  progressFill:    { height: '100%', backgroundColor: '#21A56A', borderRadius: 2 },
  progressLabel:   { fontSize: 11, color: '#2a4050', marginBottom: 24, fontWeight: '600', letterSpacing: 0.5 },
  logo:            { fontSize: 36, fontWeight: '900', color: '#21A56A', letterSpacing: 5, marginBottom: 14 },
  title:           { fontSize: 26, fontWeight: '800', color: '#eef4f8', marginBottom: 6, letterSpacing: -0.3 },
  subtitle:        { fontSize: 14, color: '#4a6878', marginBottom: 28, lineHeight: 20 },
  inputGroup:      { marginBottom: 18 },
  label:           { fontSize: 10, fontWeight: '700', color: '#4a6878', letterSpacing: 1.5, marginBottom: 8 },
  input:           { backgroundColor: '#071D2A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#eef4f8', fontSize: 15, flex: 1 },
  inputError:      { borderColor: '#ff4a6e' },
  inputSuccess:    { borderColor: '#21A56A' },
  errorText:       { color: '#ff4a6e', fontSize: 12, marginTop: 5, marginLeft: 4 },
  successText:     { color: '#21A56A', fontSize: 12, marginTop: 5, marginLeft: 4 },
  prefixRow:       { flexDirection: 'row', alignItems: 'center' },
  prefixBox:       { backgroundColor: '#071D2A', borderWidth: 1, borderRightWidth: 0, borderColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  prefixText:      { color: '#4a6878', fontSize: 16, fontWeight: '600' },
  prefixInput:     { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  passwordRow:     { flexDirection: 'row', alignItems: 'center' },
  passwordInput:   { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn:          { backgroundColor: '#071D2A', borderWidth: 1, borderLeftWidth: 0, borderColor: 'rgba(255,255,255,0.08)', borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  eyeIcon:         { fontSize: 16 },
  strengthRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack:   { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  strengthFill:    { height: '100%', borderRadius: 2 },
  strengthLabel:   { fontSize: 11, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  primaryBtn:      { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:  { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  loginLink:       { alignItems: 'center', marginTop: 24, marginBottom: 16 },
  loginLinkText:   { color: '#4a6878', fontSize: 14 },
  divider:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText:     { color: '#2a4050', fontSize: 13 },
  googleBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 15, marginBottom: 12, backgroundColor: '#fff' },
  googleIcon:      { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleBtnText:   { color: '#111', fontSize: 15, fontWeight: '700' },
  facebookBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 15, marginBottom: 12, backgroundColor: '#1877F2' },
  facebookIcon:    { fontSize: 20, fontWeight: '900', color: '#fff' },
  facebookBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
