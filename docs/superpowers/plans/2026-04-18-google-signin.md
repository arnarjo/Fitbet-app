# Google Sign-In (Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Sign-In as an additional login option on Android alongside existing email/password auth.

**Architecture:** Use `@react-native-google-signin/google-signin` to get a Google ID token natively, pass it to Supabase `signInWithIdToken`, then auto-create a profile for new users. The Google button lives below the existing "or" divider in LoginScreen.

**Tech Stack:** `@react-native-google-signin/google-signin`, Supabase Auth, React Native, EAS Build

---

## ⚠️ External Setup (do this BEFORE writing any code)

### Step A — Get full SHA-1 fingerprint
1. Go to expo.dev → FitBet project → Credentials → `is.fitbet.app`
2. Copy the **full SHA-1 fingerprint** (e.g. `15:82:AA:...:F4:F2`)

### Step B — Google Cloud Console
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select the Firebase project used for FitBet
3. **APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Android**
   - Package name: `is.fitbet.app`
   - SHA-1: paste the full fingerprint from Step A
5. Click Create — you can ignore the Android Client ID itself
6. **Also create a Web Client ID:**
   - + Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Name: `FitBet Web`
   - No redirect URIs needed
   - Click Create → copy the **Client ID** and **Client Secret**

### Step C — Supabase
1. Supabase dashboard → **Authentication → Providers → Google**
2. Toggle **Enable**
3. Paste **Web Client ID** and **Web Client Secret** from Step B
4. Save

### Step D — Note the Web Client ID
Keep the Web Client ID handy — it goes into the code as `webClientId`.

---

## Task 1: Install package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npx expo install @react-native-google-signin/google-signin
```

- [ ] **Step 2: Verify install**

```bash
cat package.json | grep google-signin
```

Expected output contains: `"@react-native-google-signin/google-signin"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @react-native-google-signin/google-signin package"
```

---

## Task 2: Configure app.json plugin

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add plugin to app.json**

Open `app.json` and add to the `plugins` array (after the existing `expo-notifications` entry):

```json
[
  "@react-native-google-signin/google-signin",
  {
    "googleServicesFile": "./google-services.json"
  }
]
```

The full plugins array should look like:

```json
"plugins": [
  [
    "expo-notifications",
    {
      "color": "#21A56A",
      "defaultChannel": "default",
      "androidMode": "default",
      "androidCollapsedTitle": "FitBet",
      "googleServicesFile": "./google-services.json"
    }
  ],
  [
    "@react-native-google-signin/google-signin",
    {
      "googleServicesFile": "./google-services.json"
    }
  ],
  [
    "expo-image-picker",
    {
      "photosPermission": "FitBet þarf aðgang að myndasafni til að hlaða upp sönnunarmyndum.",
      "cameraPermission": "FitBet þarf aðgang að myndavél til að taka sönnunarmyndir."
    }
  ],
  "expo-secure-store",
  "@react-native-community/datetimepicker",
  "expo-web-browser"
]
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "feat: configure google-signin plugin in app.json"
```

---

## Task 3: Add signInWithGoogle to useAuth

**Files:**
- Modify: `src/hooks/useAuth.ts`

- [ ] **Step 1: Add Google Sign-In import and signInWithGoogle function**

Replace the entire `src/hooks/useAuth.ts` with:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import type { Session } from '@supabase/supabase-js';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Replace with your actual Web Client ID from Google Cloud Console
const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
    setLoading(false);
  }

  async function refreshProfile() {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
  }

  async function signUp(email: string, password: string, username: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });
    return { error };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    try { await GoogleSignin.signOut(); } catch {}
  }

  async function signInWithGoogle(): Promise<{ error: Error | null }> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      // response.data is the user info object in newer SDK versions
      const idToken = response.data?.idToken ?? (response as any).idToken;
      if (!idToken) return { error: new Error('No ID token returned from Google') };

      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) return { error: authError };
      if (!authData.user) return { error: new Error('No user returned from Supabase') };

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (!existingProfile) {
        // New user — create profile with auto-generated username
        const googleUser = response.data?.user ?? (response as any).user;
        const baseName = (googleUser?.givenName ?? googleUser?.name ?? 'user')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const username = await generateUniqueUsername(baseName);
        const fullName = googleUser?.name ?? '';

        await supabase.from('profiles').insert({
          id: authData.user.id,
          username,
          full_name: fullName,
          email: authData.user.email,
        });
      }

      return { error: null };
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { error: null }; // user cancelled — not an error
      }
      return { error: err };
    }
  }

  async function generateUniqueUsername(base: string): Promise<string> {
    const candidate = base || 'user';

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle();

    if (!data) return candidate;

    // Taken — add random 4-digit suffix
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const withSuffix = `${candidate}${suffix}`;

    const { data: data2 } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', withSuffix)
      .maybeSingle();

    if (!data2) return withSuffix;

    // Final fallback — timestamp
    return `${candidate}${Date.now().toString().slice(-6)}`;
  }

  return { session, profile, loading, signUp, signIn, signOut, signInWithGoogle, refreshProfile };
}
```

- [ ] **Step 2: Replace YOUR_WEB_CLIENT_ID_HERE**

In the file just written, replace `YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com` with the actual Web Client ID from Google Cloud Console (Step B above).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat: add signInWithGoogle to useAuth with auto profile creation"
```

---

## Task 4: Add Google Sign-In button to LoginScreen

**Files:**
- Modify: `src/screens/auth/LoginScreen.tsx`

- [ ] **Step 1: Add signInWithGoogle import and handler**

At the top of `LoginScreen.tsx`, update the useAuth import line:

```typescript
const { signIn, signInWithGoogle } = useAuth();
```

Add this handler function inside the component (after `handleLogin`):

```typescript
async function handleGoogleLogin() {
  setLoading(true);
  const { error } = await signInWithGoogle();
  setLoading(false);
  if (error) {
    Alert.alert('Villa', 'Innskráning með Google mistókst, reyndu aftur.');
  }
}
```

- [ ] **Step 2: Add Google button to the JSX**

Find the existing divider section in the JSX:

```tsx
<View style={s.divider}>
  <View style={s.dividerLine} />
  <Text style={s.dividerText}>{t('login_or')}</Text>
  <View style={s.dividerLine} />
</View>

<TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup')}>
  <Text style={s.signupBtnText}>{t('login_create')}</Text>
</TouchableOpacity>
```

Replace it with:

```tsx
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
```

- [ ] **Step 3: Add Google button styles**

Add these two styles to the `StyleSheet.create({...})` object at the bottom of the file:

```typescript
googleBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.15)',
  borderRadius: 14,
  paddingVertical: 15,
  marginBottom: 12,
  backgroundColor: '#fff',
},
googleIcon: {
  fontSize: 18,
  fontWeight: '800',
  color: '#4285F4',
},
googleBtnText: {
  color: '#111',
  fontSize: 15,
  fontWeight: '700',
},
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/auth/LoginScreen.tsx
git commit -m "feat: add Google Sign-In button to LoginScreen"
```

---

## Task 5: Build and test

- [ ] **Step 1: Run new Android build**

```bash
eas build --platform android --profile preview
```

Wait for build to complete (typically 10-15 min).

- [ ] **Step 2: Download and install APK/AAB on test device**

Either download from EAS dashboard or upload to Play Store internal testing track.

- [ ] **Step 3: Manual test — new user**

1. Open app on Android device
2. Tap "Halda áfram með Google"
3. Select a Google account that has **never** signed into FitBet
4. Verify: lands on main Home screen
5. Go to Profile — verify username was auto-generated (e.g. `arnar7823`)
6. Verify username is editable in Profile

- [ ] **Step 4: Manual test — existing user**

1. Sign out
2. Tap "Halda áfram með Google" with the same Google account
3. Verify: signs in immediately without creating a new profile

- [ ] **Step 5: Manual test — cancel**

1. Tap "Halda áfram með Google"
2. Press back/cancel on the Google modal
3. Verify: nothing happens, stays on Login screen

- [ ] **Step 6: Verify push token registers**

After signing in with Google, check Supabase SQL Editor:

```sql
SELECT user_id, platform, active FROM push_tokens ORDER BY updated_at DESC LIMIT 5;
```

Verify a new row appears for the Google user.

- [ ] **Step 7: Commit if any fixes were needed, otherwise done**

```bash
git add -A
git commit -m "fix: google signin adjustments from testing"
```

---

## Summary of manual steps for user

| # | Where | Action |
|---|---|---|
| A | expo.dev → Credentials → is.fitbet.app | Copy full SHA-1 fingerprint |
| B | Google Cloud Console | Create Android OAuth client + Web OAuth client |
| C | Supabase → Auth → Providers → Google | Enable Google, paste Web Client ID + Secret |
| D | `src/hooks/useAuth.ts` line with `WEB_CLIENT_ID` | Paste actual Web Client ID |
| E | Terminal | `eas build --platform android` |
| F | Play Store / EAS | Upload new build to testing track |
