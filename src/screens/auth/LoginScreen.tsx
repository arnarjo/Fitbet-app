// src/screens/auth/LoginScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Shake animation for errors
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Netfang vantar';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) newErrors.email = 'Netfang er ekki gilt';
    if (!password) newErrors.password = 'Lykilorð vantar';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) { shake(); return false; }
    return true;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      shake();
      if (error.message.includes('Invalid login')) {
        setErrors({ email: 'Rangt netfang eða lykilorð' });
      } else {
        setErrors({ email: 'Rangt netfang eða lykilorð' });
      }
    }
    // Navigation handled automatically by RootNavigator session listener
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071D2A" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← Til baka</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.logoArea}>
            <Text style={s.logo}>FITBET</Text>
            <View style={s.logoUnderline} />
          </View>

          <Text style={s.title}>Velkominn aftur</Text>
          <Text style={s.subtitle}>Skráðu þig inn til að halda áfram</Text>

          {/* Form */}
          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>

            {/* Email */}
            <View style={s.inputGroup}>
              <Text style={s.label}>NETFANG</Text>
              <TextInput
                style={[s.input, errors.email ? s.inputError : null]}
                placeholder="þú@dæmi.is"
                placeholderTextColor="#2a4050"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
              />
              {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={s.inputGroup}>
              <Text style={s.label}>LYKILORÐ</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, s.passwordInput, errors.password ? s.inputError : null]}
                  placeholder="••••••••"
                  placeholderTextColor="#2a4050"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={s.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot password */}
            <TouchableOpacity style={s.forgotBtn} onPress={() => Alert.alert('Endursetja lykilorð', 'Sendum þér tölvupóst með leiðbeiningum.')}>
              <Text style={s.forgotText}>Gleymt lykilorð?</Text>
            </TouchableOpacity>

            {/* Login button */}
            <TouchableOpacity
              style={[s.loginBtn, loading && s.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.loginBtnText}>Skrá inn</Text>
              }
            </TouchableOpacity>

          </Animated.View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>eða</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Sign up link */}
          <TouchableOpacity
            style={s.signupBtn}
            onPress={() => navigation.navigate('Signup')}
          >
            <Text style={s.signupBtnText}>Búa til nýjan aðgang</Text>
          </TouchableOpacity>

          <Text style={s.termsText}>
            Með innskráningu samþykkir þú{' '}
            <Text style={s.termsLink}>notkunarskilmála</Text>
            {' '}og{' '}
            <Text style={s.termsLink}>persónuverndarstefnu</Text>
            {' '}FitBet.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#071D2A' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  backBtn: { paddingTop: 8, paddingBottom: 16, alignSelf: 'flex-start' },
  backText: { color: '#4a6878', fontSize: 14, fontWeight: '600' },

  logoArea: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  logo: {
    fontSize: 44,
    fontWeight: '900',
    color: '#21A56A',
    letterSpacing: 6,
  },
  logoUnderline: {
    width: 40,
    height: 3,
    backgroundColor: '#21A56A',
    borderRadius: 2,
    marginTop: 6,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#eef4f8',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#4a6878',
    marginBottom: 28,
  },

  inputGroup: { marginBottom: 16 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4a6878',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#071D2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#eef4f8',
    fontSize: 15,
    flex: 1,
  },
  inputError: {
    borderColor: '#ff4a6e',
  },
  errorText: {
    color: '#ff4a6e',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 4,
  },

  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  passwordInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    backgroundColor: '#071D2A',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: { fontSize: 16 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: '#21A56A', fontSize: 13, fontWeight: '600' },

  loginBtn: {
    backgroundColor: '#21A56A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { color: '#2a4050', fontSize: 13 },

  signupBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  signupBtnText: { color: '#eef4f8', fontSize: 15, fontWeight: '700' },

  termsText: {
    fontSize: 12,
    color: '#2a4050',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: { color: '#4a6878', textDecorationLine: 'underline' },
});
