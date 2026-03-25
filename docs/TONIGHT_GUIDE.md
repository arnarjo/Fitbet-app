# FitBet — Skref-fyrir-skref leiðbeiningar
# Allt sem við gerðum í kvöld

---

## ✅ KLÁRAÐ — Supabase

Þú hefur þegar:
- [x] Keyrt 001_schema.sql — Success
- [x] Keyrt 002_push_triggers.sql — Success
- [x] Búið til buckets: avatars (PUBLIC) og challenge-proofs (PRIVATE)
- [x] Sótt API lykla úr Settings → API Keys
- [x] Búið til .env skrá með Supabase URL og anon key

---

## ⏳ NÆST — Laga Expo og keyra appið

### Skref 1 — Opna VS Code rétt

1. Opnaðu VS Code
2. File → Open Folder
3. Veldu: C:\Users\arnar\fitbet-tonight\app
4. Terminal → New Terminal

### Skref 2 — Setja upp

```powershell
npm install
```
Bíddu þar til lokið (2-5 mín)

### Skref 3 — Keyra með tunnel (lausn á Expo villunni)

```powershell
npx expo start --tunnel
```

--tunnel leyfir símanum að tengjast jafnvel á mismunandi netum

### Skref 4 — Sækja Expo Go á símann

- Android: Google Play → "Expo Go"
- iOS: App Store → "Expo Go"

### Skref 5 — Skanna QR kóða

Þegar terminal sýnir QR kóða:
- Android: Opnaðu Expo Go og skanna
- iOS: Opnaðu myndavélina og skanna

---

## 📱 ÞEGAR APPIÐ OPNAST

Ef þú sérð "Something went wrong":
1. Athugaðu að .env sé rétt útfyllt
2. Keyrðu: npx expo start --tunnel --clear
3. Skanna QR kóða aftur

---

## 💰 PREMIUM — RevenueCat ($8.99/mán)

### Skref 1 — Búa til reikning
Farðu á revenuecat.com og búðu til reikning

### Skref 2 — Fylla inn .env
```
EXPO_PUBLIC_RC_IOS_KEY=appl_...
EXPO_PUBLIC_RC_ANDROID_KEY=goog_...
```

### Skref 3 — Setja upp product í App Store Connect
- Product ID: fitbet_premium_monthly
- Verð: $8.99/mánuð (Tier 9)

### Skref 4 — Keyra Supabase SQL
```sql
alter table profiles
  add column if not exists is_premium boolean default false,
  add column if not exists premium_expires_at timestamptz;
```

---

## 🌍 TUNGUMÁL — Íslenska og Enska

Skrárnar eru tilbúnar:
- src/lib/i18n.ts — allar þýðingar
- src/components/LanguageSelector.tsx — UI

Notaðu þannig í skjáum:
```tsx
import { t, useLanguage } from '../lib/i18n';
const { lang } = useLanguage();
<Text>{t('home', 'activityFeed')}</Text>
```

---

## ⚡ STRAVA

1. Farðu á strava.com/settings/api
2. Búðu til app og fáðu Client ID og Secret
3. Settu í .env:
```
EXPO_PUBLIC_STRAVA_CLIENT_ID=12345
EXPO_PUBLIC_STRAVA_CLIENT_SECRET=þinn_secret
```
4. Bættu "scheme": "fitbet" við app.json

---

## 🚀 APP STORE — Þegar þú ert tilbúinn

### iOS
1. Skráðu þig á developer.apple.com ($99/ár)
2. npm install -g eas-cli
3. eas login
4. eas build --platform ios --profile production
5. eas submit --platform ios --latest

### Android
1. Skráðu þig á play.google.com/console ($25)
2. eas build --platform android --profile production
3. eas submit --platform android --latest

---

## 💡 HUGMYNDABANKI — Til framtíðar

| Hugmynd | Lýsing |
|---|---|
| 🏢 Hópveðmál | Fyrirtæki vs fyrirtæki — sigrar = glaðningur |
| ⚽ Íþróttaapi | Sjálfvirkir leikir frá football-data.org |
| 🏥 FitBet Business | HR dashboard + fyrirtækjapakki |
| 📊 Ítarleg tölfræði | Nákvæm greining á sigrum og töpum |
| 📱 Android widget | Næsti leikur á heimaskjá |

---

## 📁 SKRÁAUPPBYGGING

```
fitbet-tonight/app/
├── .env                    ← Supabase lyklar (ÞITT)
├── App.tsx                 ← Rót appsins
├── app.json                ← Expo stillingar
├── eas.json                ← Build stillingar
├── package.json            ← Dependencies
│
├── src/
│   ├── screens/
│   │   ├── auth/           ← Onboarding, Login, Signup
│   │   ├── HomeScreen.tsx
│   │   ├── MatchesScreen.tsx
│   │   ├── ChallengesScreen.tsx
│   │   ├── SeasonScreen.tsx
│   │   ├── LeaderboardScreen.tsx
│   │   ├── LeaguesScreen.tsx
│   │   ├── FriendsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── AdminScreen.tsx
│   │   └── PaywallScreen.tsx  ← Premium ($8.99/mán)
│   │
│   ├── components/
│   │   ├── MatchCard.tsx
│   │   ├── BetModal.tsx
│   │   ├── ChallengeCard.tsx
│   │   ├── ProofUploadSheet.tsx
│   │   ├── StravaConnect.tsx
│   │   └── LanguageSelector.tsx  ← IS/EN skipti
│   │
│   ├── hooks/
│   │   ├── useHooks.ts     ← useAuth, useBets, useMatches
│   │   ├── useFeed.ts
│   │   ├── usePushNotifications.ts
│   │   ├── useStrava.ts
│   │   └── usePremium.ts
│   │
│   └── lib/
│       ├── supabase.ts
│       ├── strava.ts
│       ├── revenuecat.ts   ← Premium greiðslur
│       └── i18n.ts         ← Þýðingar IS/EN
│
├── supabase/
│   ├── functions/send-push/index.ts
│   └── migrations/
│       ├── 001_schema.sql  ← KEYRT ✓
│       └── 002_push_triggers.sql  ← KEYRT ✓
│
├── admin/index.html        ← Vef admin panel
├── public/
│   ├── privacy.html        ← Persónuvernd (IS+EN)
│   └── terms.html          ← Skilmálar (IS+EN)
│
└── docs/
    ├── TONIGHT_GUIDE.md    ← ÞETTA SKJAL
    ├── SETUP.md
    ├── PUSH.md
    ├── STRAVA.md
    ├── APP_STORE.md
    ├── EAS_BUILD.md
    └── REVENUECAT.md
```

---

## 💰 KOSTNAÐUR YFIRLIT

| | Kostnaður |
|---|---|
| Apple Developer | $99/ár |
| Google Play | $25 (einu sinni) |
| Supabase | $0 (byrjun) |
| RevenueCat | $0 (byrjun) |
| **Samtals til að byrja** | **~$124** |

## TEKJUÁÆTLUN við $8.99/mán

| Premium notendur | Tekjur/mán | Eftir 30% |
|---|---|---|
| 22 | $197 | ~$138 — jafngildi ✅ |
| 50 | $449 | ~$315 💰 |
| 100 | $899 | ~$630 🚀 |
| 500 | $4,495 | ~$3,150 🎯 |
