# Google Sign-In Design — Android
_2026-04-18_

## Scope
Add Google Sign-In as an additional login option on Android alongside existing email/password auth. iOS is out of scope for now.

## Package
`@react-native-google-signin/google-signin` — native SDK, best UX on Android, compatible with Supabase `signInWithIdToken`.

## Auth Flow

```
User taps "Sign in with Google"
  → GoogleSignin.signIn() → native Google modal
  → idToken returned
  → supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  → Supabase creates or finds user
  → Check if profile row exists
      → New user: auto-create profile with generated username
      → Existing user: proceed normally
  → Navigate to Main
```

## Username Auto-Generation
- Source: Google `givenName` (fallback: first word of `displayName`)
- Lowercase, strip non-alphanumeric chars
- Check uniqueness in `profiles` table
- If taken: append random 4-digit number, retry once
- Example: "Arnar Jóhannsson" → `arnar` → taken → `arnar7823`
- User can change username anytime in Profile screen (already supported)

## Code Changes

### `useAuth.ts`
- Add `signInWithGoogle()` function
- Handles: GoogleSignin config, token exchange, profile creation

### `LoginScreen.tsx`
- Add Google Sign-In button below existing "or" divider
- Dark theme to match app design, Google logo icon

### `app.json`
- Add `@react-native-google-signin/google-signin` plugin with `googleServicesFile`

## Error Handling
| Scenario | Behaviour |
|---|---|
| User cancels Google modal | Silent — nothing happens |
| Supabase auth error | Alert: "Innskráning mistókst, reyndu aftur" |
| Username collision after retry | Append timestamp suffix as final fallback |
| No network | Alert from Supabase error |

## External Setup Required (manual steps for user)

### Step 1 — Google Cloud Console
1. Go to console.cloud.google.com → your Firebase project
2. APIs & Services → Credentials → Create Credential → OAuth 2.0 Client ID
3. Type: **Android**, package: `is.fitbet.app`
4. SHA-1: `15:82...F4:F2` (from EAS credentials page)
5. Save — note the **Web Client ID** (not Android client ID)

### Step 2 — Supabase
1. Supabase dashboard → Authentication → Providers → Google
2. Enable Google, paste **Web Client ID** and **Web Client Secret**
3. Save

### Step 3 — New Android Build
After code changes, run `eas build --platform android` and upload to Play Store testing track.

## Out of Scope
- iOS Google Sign-In
- Replacing email/password login
- Linking Google to existing email/password accounts
