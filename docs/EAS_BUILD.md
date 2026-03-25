# FitBet — EAS Build & App Store Leiðbeiningar

---

## Skref 1 — Búðu til Expo aðgang

```bash
# Farðu á expo.dev og búðu til reikning
# Svo skráðu þig inn í terminal:
npm install -g eas-cli
eas login

# Búðu til nýtt verkefni á expo.dev
eas init --id ÞITT_PROJECT_ID
```

Eftir þetta — fylltu inn `REPLACE_WITH_YOUR_EXPO_PROJECT_ID` í `app.json`.

---

## Skref 2 — Settu upp Apple Developer aðgang (iOS)

1. Farðu á [developer.apple.com](https://developer.apple.com)
2. Greiddu $99/ár fyrir Apple Developer Program
3. Búðu til **Bundle ID**: `is.fitbet.app`
4. EAS mun sjálfkrafa búa til Provisioning Profiles

```bash
# EAS sér um allt signing sjálfkrafa:
eas credentials
```

---

## Skref 3 — Settu upp Google Play aðgang (Android)

1. Farðu á [play.google.com/console](https://play.google.com/console)
2. Greiddu $25 (einu sinni) fyrir Google Play Developer
3. Búðu til nýtt app: pakkanafn `is.fitbet.app`
4. Sæktu `google-services.json` úr Firebase Console og settu í rót verkefnisins

---

## Skref 4 — Byggja development build (til prófunar)

```bash
# iOS hermirinn
eas build --platform ios --profile development

# Android á raunverulegum síma
eas build --platform android --profile development

# Eftir að build er tilbúinn — settu á síma:
eas device:create        # Skráðu UDID síma
eas build:run            # Settu á skráðan síma
```

---

## Skref 5 — Keyra preview build (til TestFlight/Internal Testing)

```bash
# Báðar platforms í einu
eas build --platform all --profile preview

# iOS — hlaða upp á TestFlight sjálfkrafa:
eas submit --platform ios --profile production --latest

# Android — hlaða upp á Internal Testing:
eas submit --platform android --profile production --latest
```

---

## Skref 6 — Production build (App Store)

```bash
# Athugaðu version í app.json:
# "version": "1.0.0"  ← notandi sér þetta
# "buildNumber": "1"  ← hækkar með hverri sendingu

# Byggja production:
eas build --platform all --profile production

# Gefa út:
eas submit --platform all --profile production --latest
```

---

## Skref 7 — App Store Connect stillingar

1. Farðu á [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Veldu FitBet appið
3. Undir **App Store** flipanum:
   - Hlaðaðu upp skjámyndum (sjá `app-store-metadata.md`)
   - Límdu inn íslenska og enska lýsingu
   - Stilltu aldursflokkur: **12+**
   - Settu inn Privacy Policy URL
4. Undir **TestFlight**:
   - Bíddu eftir "Processing" (10–30 mín)
   - Bættu við prófendum
   - Sendu prófunartengil
5. Þegar prófun er kláruð → **Submit for Review**

---

## Skref 8 — Google Play Console stillingar

1. Farðu á [play.google.com/console](https://play.google.com/console)
2. Veldu FitBet
3. Undir **Production** → **Releases**:
   - EAS hefur þegar hlaðið upp `.aab` skránni
4. Undir **Store presence**:
   - Hlaðaðu upp Feature Graphic (1024×500)
   - Hlaðaðu upp skjámyndum
   - Fylltu inn lýsingu
5. Undir **Policy**:
   - Fylltu út efniseinkunn
   - Settu inn Privacy Policy URL
6. **Send to review**

---

## Algeng vandamál og lausnir

**"Missing push notification entitlement":**
```bash
eas credentials --platform ios
# Veldu "Push Notifications" og leyfðu EAS að setja upp
```

**"Google Services file not found":**
- Sæktu `google-services.json` frá Firebase Console
- Settu skrána í rót verkefnisins (sama mappa og `app.json`)

**"Build failed — Metro bundler error":**
```bash
npx expo start --clear    # Hreinsar cache
eas build --clear-cache   # Hreinsar EAS cache
```

**"Version already exists":**
- Hækkaðu `buildNumber` (iOS) eða `versionCode` (Android) í `app.json`

**"App rejected — privacy policy missing":**
- Settu upp einfaldann Privacy Policy á fitbet.is/privacy
- Uppfærðu URL í App Store Connect

---

## Gagnlegar skipanir

```bash
# Skoða build status
eas build:list

# Skoða logs á keyrandum build
eas build:view BUILD_ID

# Uppfæra OTA (Over The Air) — án nýs build
eas update --channel production --message "Laga villa í feed"

# Skoða submission status
eas submission:list
```

---

## OTA uppfærslur (eftir útgáfu)

EAS Update leyfir þér að laga villur og bæta við litlum breytingum **án þess að fara í gegnum App Store yfirferð**:

```bash
# Settu upp
npx expo install expo-updates

# Gefðu út uppfærslu
eas update --channel production --message "Laga push notification villa"
```

Notendur fá uppfærsluna sjálfkrafa næst þegar þeir opna appið.

---

## Kostnaðaryfirlit

| Þjónusta | Kostnaður |
|----------|-----------|
| Apple Developer Program | $99/ár |
| Google Play Developer | $25 (einu sinni) |
| Expo EAS Build (Free tier) | 0$ (30 builds/mánuð) |
| Expo EAS Build (Production) | $0–$99/mánuð |
| Supabase (Free tier) | 0$ (500MB, 2GB bandwidth) |
| Supabase (Pro) | $25/mánuð |
| **Samtals til að byrja** | **~$124** |
