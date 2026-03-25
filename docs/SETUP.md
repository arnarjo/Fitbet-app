# FitBet – Uppsetningarleiðbeiningar / Setup Guide

---

## SKREF 1 — Supabase verkefni

1. Farðu á https://supabase.com og búðu til reikning (ókeypis)
2. Smelltu á **"New project"**
3. Gefðu verkefninu nafnið `fitbet`
4. Veldu svæðið **EU West (Ireland)** (næst Íslandi)
5. Búðu til sterkt lykilorð og vistaðu það

---

## SKREF 2 — Keyrðu gagnagrunnsskemað

1. Í Supabase, farðu í **SQL Editor** (vinstra megin)
2. Smelltu á **"New query"**
3. Afritaðu allt innihald úr `fitbet_supabase_schema.sql`
4. Límdu inn og smelltu á **"Run"** (eða Ctrl+Enter)
5. Þú ættir að sjá: `Success. No rows returned`

---

## SKREF 3 — Stilltu geymslu (Storage)

1. Farðu í **Storage** í Supabase
2. Smelltu á **"New bucket"**
3. Búðu til tvo fötu:
   - `avatars` → Public: **ON**, Max size: 5MB
   - `challenge-proofs` → Public: **OFF**, Max size: 50MB
4. Fyrir `challenge-proofs`, bættu við RLS policy:
   ```sql
   create policy "Users can upload their own proofs"
   on storage.objects for insert
   with check (auth.uid()::text = (storage.foldername(name))[1]);
   ```

---

## SKREF 4 — Afritaðu API lykla

1. Farðu í **Settings → API**
2. Afritaðu:
   - `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Búðu til `.env` skrá í rót verkefnisins og fylltu inn gildin

---

## SKREF 5 — Settu upp React Native verkefnið

```bash
# Búðu til Expo verkefni
npx create-expo-app FitBet --template blank-typescript
cd FitBet

# Settu upp pakka
npx expo install \
  @supabase/supabase-js \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  @react-navigation/native-stack \
  react-native-screens \
  react-native-safe-area-context \
  react-native-gesture-handler \
  react-native-reanimated \
  expo-image-picker \
  expo-secure-store \
  expo-notifications \
  expo-linking \
  expo-web-browser \
  @react-native-async-storage/async-storage \
  react-native-url-polyfill \
  date-fns
```

---

## SKREF 6 — Skipulags skrárnar

Búðu til þessa möppuuppbyggingu:

```
FitBet/
├── .env                        ← Supabase lyklar
├── App.tsx                     ← Inngangspunktur
├── src/
│   ├── lib/
│   │   └── supabase.ts         ← Supabase client (sjá kóðann)
│   ├── types/
│   │   └── database.ts         ← TypeScript týpur
│   ├── hooks/
│   │   ├── useAuth.ts          ← Auðkenning
│   │   ├── useBets.ts          ← Veðmál
│   │   ├── useMatches.ts       ← Leikir
│   │   └── useChallenges.ts    ← Áskoranir
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignupScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── MatchesScreen.tsx
│   │   ├── BetsScreen.tsx
│   │   ├── SeasonScreen.tsx
│   │   ├── LeaguesScreen.tsx
│   │   ├── FriendsScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── navigation/
│       └── RootNavigator.tsx
```

---

## SKREF 7 — Keyra í þróun

```bash
# Keyra í vafra (til prófunar)
npx expo start --web

# Keyra á síma með Expo Go appinu
npx expo start

# Keyra á iOS herminum (Mac only)
npx expo run:ios

# Keyra á Android herminum
npx expo run:android
```

---

## SKREF 8 — Leggja inn í App Store / Google Play

```bash
# Settu upp EAS Build
npm install -g eas-cli
eas login
eas build:configure

# Byggja fyrir iOS
eas build --platform ios

# Byggja fyrir Android
eas build --platform android

# Senda í verslunar
eas submit --platform ios
eas submit --platform android
```

---

## Admin stjórnkerfi — Bæta við leikjum

Þar sem þú ert ekki að nota sjálfvirka íþróttaAPI, bættu við leikjum handvirkt í Supabase:

1. Farðu í **Table Editor → matches**
2. Smelltu á **"Insert row"**
3. Fylltu inn:
   - `home_team_id` → leitaðu í teams töflunni
   - `away_team_id` → sama
   - `league_name` → t.d. `"Besta deild karla"`
   - `kickoff_time` → ISO format: `"2026-04-15T19:00:00Z"`
   - `status` → `"upcoming"`

Eða búðu til einfalt admin-viðmót með Supabase Studio.

---

## Strava tenging (valfrjálst)

1. Farðu á https://www.strava.com/settings/api
2. Búðu til app og fáðu `Client ID` og `Client Secret`
3. Settu þær inn í `.env`
4. Notaðu `expo-web-browser` til að opna OAuth flæðið
5. Í callback, vistaðu `access_token` í `profiles.strava_access_token`

---

## Gagnlegar Supabase skipanir

```sql
-- Sjá alla notendur
select * from profiles;

-- Sjá öll opin veðmál
select * from bets where status = 'pending';

-- Gera leik upp (kalla settle_bet fallið)
select settle_bet('BET_UUID_HERE', 'home');

-- Stigatafla
select * from leaderboard limit 10;

-- Loka tímabilsmarkaði
update season_markets set status = 'locked' where id = 'MARKET_UUID';
```

---

## Öryggi — mikilvægar atriðar

- ✅ Row Level Security (RLS) er virkt á öllum töflum
- ✅ Notendur geta aðeins séð eigin veðmál og áskoranir
- ✅ Lykilorð eru geymdar af Supabase Auth (bcrypt)
- ✅ API lyklar eru geymdir í SecureStore (ekki AsyncStorage)
- ⚠️ Breyttu aldrei `service_role` lykilinn í forritið
- ⚠️ Gerðu aldrei `challenge-proofs` bucket opinberan

---

## Næstu þróunarskref

Eftir að bakendinn er uppsettur:

1. **Notendaskráning UI** — LoginScreen + SignupScreen + OnboardingScreen
2. **Leikjaveðmál** — BetModal component með match-select og challenge-select
3. **Push tilkynningar** — Expo Notifications + Supabase Edge Functions
4. **Strava OAuth** — expo-web-browser + token refresh
5. **Admin panel** — einfalt viðmót til að bæta við leikjum og gera upp
