# FitBet — Push Tilkynningar Uppsetning

---

## Yfirlit yfir kerfið

```
Supabase DB change
      ↓
DB Trigger (PostgreSQL)
      ↓
Edge Function (send-push)
      ↓
Expo Push Service
      ↓
iOS / Android símar
```

Þegar eitthvað breytist í gagnagrunninum (t.d. veðmál samþykkt) keyrir trigger
sjálfkrafa og sendir push tilkynningu — þú þarft ekki að gera neitt handvirkt.

---

## Skref 1 — Setja upp Edge Function

```bash
# Setja upp Supabase CLI ef ekki til
npm install -g supabase

# Skrá inn
supabase login

# Tengja við verkefnið þitt
supabase link --project-ref YOUR_PROJECT_ID

# Keyra Edge Function staðbundið (til prófunar)
supabase functions serve send-push --env-file .env.local

# Gefa út Edge Function í framleiðslu
supabase functions deploy send-push
```

---

## Skref 2 — Setja upp DB triggers

1. Farðu í **Supabase SQL Editor**
2. Afritaðu allt innihald úr `push_triggers.sql`
3. **Breyttu neðstu línunum** með raunverulegum gildum þínum:

```sql
alter database postgres
  set app.supabase_url = 'https://ÞITT_PROJECT_ID.supabase.co';

alter database postgres
  set app.supabase_anon_key = 'ÞINN_ANON_KEY';
```

4. Keyrðu allt — þú ættir að sjá `Success`

---

## Skref 3 — Setja upp í React Native

```bash
# Setja upp pakka
npx expo install \
  expo-notifications \
  expo-device \
  expo-constants

# MIKILVÆGT: Til að push virki þarftu EAS build
# (gengur ekki í Expo Go)
npm install -g eas-cli
eas login
eas build:configure
```

---

## Skref 4 — app.json stillingar

Settu þetta inn í `app.json` (sjá `App.tsx` skrána):

```json
"plugins": [
  ["expo-notifications", {
    "icon": "./assets/notification-icon.png",
    "color": "#00e5a0"
  }]
]
```

---

## Skref 5 — Tengja í App.tsx

```tsx
// App.tsx er tilbúinn — bara þetta eitt þarf:
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Og í AppInner component:
const { profile } = useAuth();
const navigationRef = useRef<NavigationContainerRef<any>>(null);
usePushNotifications(profile?.id ?? '', navigationRef);
```

Hookurinn gerir sjálfkrafa:
- Biður um leyfi við fyrstu opnun
- Skráir token í Supabase
- Hlustnar á tilkynningar í forgrunni
- Sér um deep link routing þegar notandi smellir

---

## Skref 6 — Prófa

```bash
# Keyra á raunverulegum síma (ekki herminum)
eas build --platform ios --profile development
# eða
eas build --platform android --profile development

# Setja upp á síma
eas device:create
```

Eða notaðu prófunarhnappin í appinu:

```tsx
const { sendTestPush } = usePushNotifications(...);

// Smelltu á hnapp til að senda prófun til þín sjálfs
<Button onPress={sendTestPush} title="Prófa push" />
```

---

## Hvaða tilkynningar eru sendar sjálfkrafa

| Atvik | Til hvern | Texti |
|-------|-----------|-------|
| Nýtt veðmál | Andstæðingur | "Arnar boðar þig í veðmál" |
| Veðmál samþykkt | Kappi | "Sara samþykkti veðmálið" |
| Veðmáli hafnað | Kappi | "Sara hafnaði veðmálsbeiðninni" |
| Veðmál unnið | Sigurvegari | "Spáin þín var rétt 🏆" |
| Veðmál tapað | Tapari | "Tíminn er kominn til að klára áskorunina!" |
| Sönnun móttekin | Sigurvegari | "Björn sendi sönnun — farðu og staðfestu!" |
| Sönnun samþykkt | Tapari | "Vel gert! Áskorunin er kláruð ✓" |
| Sönnun hafnað | Tapari | "Sönnun hafnað — reyndu aftur" |
| Vinarbeiðni | Viðtakandi | "Kristján vill bæta þér við sem vin" |
| Vinarbeiðni samþykkt | Sendandi | "Sara er nú vinur þinn 🤝" |

---

## Villuleit

**"No token" — tilkynning send ekki:**
- Notandinn hefur ekki opnað appið á raunverulegan síma
- Prófaðu aftur eftir að hann skráir sig inn á raunverulegum síma

**"DeviceNotRegistered" villa:**
- Tokeninn er gamall — kerfið gerir hann óvirkan sjálfkrafa
- Notandinn þarf að opna appið aftur til að fá nýjan token

**Tilkynningar birtast ekki í iOS herminum:**
- iOS hermirinn styður ekki push tilkynningar
- Notaðu raunverulegan síma eða EAS development build

**Edge Function bilun:**
- Athugaðu Supabase Edge Function logs í dashboard
- Gakktu úr skugga um að `app.supabase_url` sé rétt stillt

---

## Uppbygging skráa

```
src/
  hooks/
    usePushNotifications.ts   ← Aðal hook
supabase/
  functions/
    send-push/
      index.ts                ← Edge Function
  migrations/
    push_triggers.sql         ← DB triggers
App.tsx                       ← Root með hook tengdu
```
