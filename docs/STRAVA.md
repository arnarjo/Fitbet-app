# FitBet — Strava OAuth Uppsetning

---

## Skref 1 — Búðu til Strava app

1. Farðu á [strava.com/settings/api](https://www.strava.com/settings/api)
2. Smelltu á **"Create & Manage Your App"**
3. Fylltu inn:
   - **Application Name:** FitBet
   - **Category:** Fitness Tracker
   - **Club:** (autt)
   - **Website:** https://fitbet.is
   - **Authorization Callback Domain:** `localhost` (við breytum þessu seinna)
   - **Logo:** Hladdu upp FitBet icon
4. Smelltu **Save**
5. Skráðu niður **Client ID** og **Client Secret**

---

## Skref 2 — Settu upp deep link í app.json

Bættu `scheme` við `app.json` til að Strava OAuth callback virki:

```json
{
  "expo": {
    "scheme": "fitbet",
    "ios": {
      "bundleIdentifier": "is.fitbet.app"
    },
    "android": {
      "package": "is.fitbet.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "fitbet",
              "host": "strava-callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**Redirect URI verður:** `fitbet://strava-callback`

---

## Skref 3 — Settu inn umhverfisbreytur

Bættu þessu við `.env` skrána:

```bash
# Strava OAuth
EXPO_PUBLIC_STRAVA_CLIENT_ID=12345
EXPO_PUBLIC_STRAVA_CLIENT_SECRET=þinn_secret_hér
```

**Mikilvægt:** `CLIENT_SECRET` ætti ALDREI að vera í kóðanum — bara í `.env` sem er í `.gitignore`.

---

## Skref 4 — Uppfærðu Strava Callback Domain

Þegar appið er gefið út:
1. Farðu aftur á [strava.com/settings/api](https://www.strava.com/settings/api)
2. Breyttu **Authorization Callback Domain** í `fitbet.is`

---

## Skref 5 — Setja upp í React Native

```bash
# Setja upp pakka (ef ekki þegar til)
npx expo install expo-web-browser expo-linking
```

Þetta er þegar innifalið ef þú ert með nýjasta `package.json` frá ZIP-inu.

---

## Skref 6 — Nota StravaConnect component

Í `ProfileScreen.tsx`, bættu við:

```tsx
import StravaConnect from '../components/StravaConnect';

// Í JSX, inni í View:
<StravaConnect onConnected={() => refetchProfile()} />
```

---

## Skref 7 — Supabase schema uppfærsla

Keyrðu þessa SQL í Supabase SQL Editor:

```sql
alter table profiles
  add column if not exists strava_athlete_id   bigint,
  add column if not exists strava_expires_at   bigint,
  add column if not exists strava_refresh_token text;

create index if not exists idx_profiles_strava
  on profiles(strava_connected)
  where strava_connected = true;
```

---

## Hvernig Strava auto-approval virkar

```
1. Notandi klárar áskorun (t.d. 10 km hlaup) á Strava
2. Notandi opnar FitBet
3. FitBet sækir síðustu 7 daga æfingar frá Strava API
4. Ef æfing finnst sem passar (tegund + fjarlægð):
   → Áskorun samþykkt sjálfkrafa
   → Sigurvegari fær push tilkynningu
   → Engin sönnunarmynd þarf
```

---

## Studdar æfingategundir

| Strava tegund | FitBet áskorun |
|---|---|
| Run / VirtualRun | Hlaup |
| Ride / VirtualRide / EBikeRide | Hjólreiðar |
| Walk / Hike | (handvirk staðfesting) |
| Swim | (handvirk staðfesting) |

---

## Nota `checkAndAutoApprove` í bakgrunni

Í `HomeScreen.tsx`, bættu við þegar appið opnast:

```tsx
import { useStrava } from '../hooks/useStrava';

const { checkAndAutoApprove, connected } = useStrava();

useEffect(() => {
  if (connected) {
    checkAndAutoApprove().then(count => {
      if (count > 0) {
        showToast(`${count} áskorun staðfest sjálfkrafa via Strava ⚡`);
      }
    });
  }
}, []);
```

---

## Villuleit

**"Redirect URI mismatch":**
- Gakktu úr skugga um að `scheme` í `app.json` sé `"fitbet"`
- Strava Callback Domain á að vera `localhost` í þróun

**"Missing scope" villa:**
- Notandinn þarf að leyfa `activity:read_all` í Strava OAuth

**Token refresh bilun:**
- Athugaðu að `CLIENT_SECRET` sé rétt í `.env`
- Strava tokens renna út á 6 klst — `getValidToken()` sér um refresh sjálfkrafa

**"No activities found":**
- Æfingin er eldri en 7 dagar
- Æfing var skráð á Strava eftir að áskorun var úthlutað — þetta er rétt hegðun

---

## Skráauppbygging

```
src/
  lib/
    strava.ts              ← OAuth + API föll
  hooks/
    useStrava.ts           ← React hook
  components/
    StravaConnect.tsx      ← UI component
```
