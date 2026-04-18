// src/screens/auth/LoginScreen.tsx
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

export default function LoginScreen({ navigation }: Props) {
  const { signIn, signInWithGoogle } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors]         = useState<{ email?: string; password?: string }>({});
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = t('login_err_email_req');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) newErrors.email = t('login_err_email_inv');
    if (!password) newErrors.password = t('login_err_pw_req');
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { shake(); return false; }
    return true;
  }

  async function handleGoogleLogin() {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      Alert.alert('Villa', 'Innskráning með Google mistókst, reyndu aftur.');
    }
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      shake();
      setErrors({ email: t('login_err_invalid') });
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071D2A" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={s.topRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
              <Text style={s.backText}>{t('common_back')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.langToggle} onPress={() => setLang(lang === 'en' ? 'is' : 'en')}>
              <Text style={s.langText}>{lang === 'en' ? '🇮🇸 IS' : '🇬🇧 EN'}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.logoArea}>
            <Text style={s.logo}>FITBET</Text>
            <View style={s.logoUnderline} />
          </View>

          <Text style={s.title}>{t('login_welcome')}</Text>
          <Text style={s.subtitle}>{t('login_subtitle')}</Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={s.inputGroup}>
              <Text style={s.label}>{t('login_email_label')}</Text>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder={t('login_email_ph')}
                placeholderTextColor="#2a4050"
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
              />
              {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>{t('login_pw_label')}</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, s.passwordInput, errors.password ? s.inputError : null]}
                  placeholder="••••••••"
                  placeholderTextColor="#2a4050"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors(e => ({ ...e, password: undefined })); }}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity style={s.forgotBtn} onPress={() => Alert.alert(t('login_forgot_title'), t('login_forgot_msg'))}>
              <Text style={s.forgotText}>{t('login_forgot')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[s.loginBtn, loading && s.loginBtnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.loginBtnText}>{t('login_btn')}</Text>}
            </TouchableOpacity>
          </Animated.View>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>{t('login_or')}</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={s.googleBtn}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={s.googleIcon}>G</Text>
            <Text style={s.googleBtnText}>Halda áfram með Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup')}>
            <Text style={s.signupBtnText}>{t('login_create')}</Text>
          </TouchableOpacity>

          <Text style={s.termsText}>
            {t('login_terms')}
            <Text style={s.termsLink}>{t('login_terms_of_use')}</Text>
            {t('login_and')}
            <Text style={s.termsLink}>{t('login_privacy')}</Text>
            {t('login_of_fitbet')}
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#071D2A' },
  scroll:      { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  backBtn:     { alignSelf: 'flex-start' },
  backText:    { color: '#4a6878', fontSize: 14, fontWeight: '600' },
  langToggle:  { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  langText:    { color: '#eef4f8', fontSize: 13, fontWeight: '700' },
  logoArea:    { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  logo:        { fontSize: 44, fontWeight: '900', color: '#21A56A', letterSpacing: 6 },
  logoUnderline: { width: 40, height: 3, backgroundColor: '#21A56A', borderRadius: 2, marginTop: 6 },
  title:       { fontSize: 28, fontWeight: '800', color: '#eef4f8', marginBottom: 6, letterSpacing: -0.3 },
  subtitle:    { fontSize: 15, color: '#4a6878', marginBottom: 28 },
  inputGroup:  { marginBottom: 16 },
  label:       { fontSize: 10, fontWeight: '700', color: '#4a6878', letterSpacing: 1.5, marginBottom: 8 },
  input:       { backgroundColor: '#071D2A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#eef4f8', fontSize: 15, flex: 1 },
  inputError:  { borderColor: '#ff4a6e' },
  errorText:   { color: '#ff4a6e', fontSize: 12, marginTop: 5, marginLeft: 4 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn:      { backgroundColor: '#071D2A', borderWidth: 1, borderLeftWidth: 0, borderColor: 'rgba(255,255,255,0.08)', borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  eyeIcon:     { fontSize: 16 },
  forgotBtn:   { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText:  { color: '#21A56A', fontSize: 13, fontWeight: '600' },
  loginBtn:    { backgroundColor: '#21A56A', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { color: '#2a4050', fontSize: 13 },
  signupBtn:   { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  signupBtnText: { color: '#eef4f8', fontSize: 15, fontWeight: '700' },
  termsText:   { fontSize: 12, color: '#2a4050', textAlign: 'center', lineHeight: 18 },
  termsLink:   { color: '#4a6878', textDecorationLine: 'underline' },
  googleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 15, marginBottom: 12, backgroundColor: '#fff' },
  googleIcon:  { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { color: '#111', fontSize: 15, fontWeight: '700' },
});
