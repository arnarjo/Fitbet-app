# FitBet — Premium / RevenueCat Uppsetning

---

## Skref 1 — Búðu til RevenueCat reikning

1. Farðu á [revenuecat.com](https://revenuecat.com) — ókeypis að byrja
2. Smelltu á **"Get Started"**
3. Búðu til nýtt project: **FitBet**
4. Bættu við iOS app:
   - Bundle ID: `is.fitbet.app`
   - Sæktu **iOS API Key** (byrjar á `appl_...`)
5. Bættu við Android app:
   - Package: `is.fitbet.app`
   - Sæktu **Android API Key** (byrjar á `goog_...`)

---

## Skref 2 — Búðu til Product í App Store Connect

**iOS (App Store Connect):**
1. Farðu á [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Veldu FitBet → **Monetization → Subscriptions**
3. Búðu til Subscription Group: **"FitBet Premium"**
4. Bættu við áskrift:
   - Product ID: `fitbet_premium_monthly`
   - Duration: 1 Month
   - Price: $4.99 (Tier 5)
   - Lýsing: "FitBet Premium — Ótakmarkaðar deildir, Strava og sérsniðnar áskoranir"

**Android (Google Play Console):**
1. Farðu á Google Play Console → FitBet
2. **Monetize → Subscriptions**
3. Búðu til subscription:
   - Product ID: `fitbet_premium_monthly`
   - Price: $4.99/month

---

## Skref 3 — Tengdu App Store við RevenueCat

**iOS:**
1. Í RevenueCat → **iOS app → App Store Connect API**
2. Fylgdu leiðbeiningum til að tengja

**Android:**
1. Í RevenueCat → **Android app → Google Play**
2. Hlaðaðu upp `google-play-service-account.json`

---

## Skref 4 — Búðu til Entitlement og Offering

Í RevenueCat dashboard:

1. **Entitlements** → **+ New** → ID: `premium`
2. Tengdu `fitbet_premium_monthly` við entitlement-ið
3. **Offerings** → **+ New** → ID: `default`
4. Bættu `fitbet_premium_monthly` við Offering

---

## Skref 5 — Settu upp í React Native

```bash
npx expo install react-native-purchases
```

Bættu við `.env`:
```bash
EXPO_PUBLIC_RC_IOS_KEY=appl_ÞINN_IOS_LYKILL
EXPO_PUBLIC_RC_ANDROID_KEY=goog_ÞINN_ANDROID_LYKILL
```

Bættu við `app.json` plugins:
```json
"plugins": [
  "react-native-purchases"
]
```

---

## Skref 6 — Tengdu í App.tsx

```tsx
import { setupRevenueCat } from './src/lib/revenuecat';

// Í AppInner, eftir að profile er sótt:
useEffect(() => {
  if (profile?.id) setupRevenueCat(profile.id);
}, [profile?.id]);
```

---

## Skref 7 — Supabase schema uppfærsla

Keyrðu þetta í Supabase SQL Editor:

```sql
alter table profiles
  add column if not exists is_premium boolean default false,
  add column if not exists premium_expires_at timestamptz;

create index if not exists idx_profiles_premium
  on profiles(is_premium) where is_premium = true;
```

---

## Hvernig á að nota PaywallScreen

### Þegar notandi reynir að búa til þriðju deild:

```tsx
import { usePremium } from '../hooks/usePremium';

const { canCreateLeague } = usePremium();

function handleCreateLeague() {
  if (!canCreateLeague(leagues.length)) {
    navigation.navigate('Paywall', { feature: 'leagues' });
    return;
  }
  // Halda áfram...
}
```

### Þegar notandi reynir að tengja Strava:

```tsx
const { canUseStrava } = usePremium();

function handleStravaConnect() {
  if (!canUseStrava()) {
    navigation.navigate('Paywall', { feature: 'strava' });
    return;
  }
  connect();
}
```

### Þegar notandi reynir sérsniðna áskorun:

```tsx
const { canUseCustomChallenges } = usePremium();

if (!canUseCustomChallenges()) {
  navigation.navigate('Paywall', { feature: 'challenges' });
  return;
}
```

---

## Bættu PaywallScreen við Navigator

Í `RootNavigator.tsx`:

```tsx
import PaywallScreen from '../screens/PaywallScreen';

// Í Stack.Navigator (ekki Tab):
<Stack.Screen
  name="Paywall"
  component={PaywallScreen}
  options={{ presentation: 'modal', headerShown: false }}
/>
```

---

## Tekjuáætlun

| Notendur | Premium % | Mánaðarlegar tekjur |
|----------|-----------|---------------------|
| 100      | 10%       | ~$35 (eftir popp 30%) |
| 500      | 10%       | ~$175               |
| 1,000    | 10%       | ~$350               |
| 5,000    | 10%       | ~$1,750             |
| 10,000   | 10%       | ~$3,500             |

*Apple/Google taka 30% af fyrsta ári, 15% eftir það.*

---

## Skráauppbygging

```
src/
  lib/
    revenuecat.ts        ← RevenueCat föll
  hooks/
    usePremium.ts        ← Premium status hook
  screens/
    PaywallScreen.tsx    ← Subscription UI
```
