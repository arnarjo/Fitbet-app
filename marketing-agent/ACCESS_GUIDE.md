# FitBet Marketing Agent — API Access Guide

Þetta skjal útskýrir skref fyrir skref hvernig þú færð alla nauðsynlega aðganga
svo agentinn geti póstað sjálfkrafa á Facebook, Instagram og TikTok.

---

## Yfirlit / Overview

| Platform | Tími til að fá aðgang | Erfiðleiki |
|----------|----------------------|------------|
| Facebook + Instagram | 30–60 mínútur | 🟡 Miðlungs |
| TikTok | 1–4 vikur (þarf samþykki) | 🔴 Erfiðara |
| DALL-E 3 (myndir) | 5 mínútur | 🟢 Auðvelt |

---

## PART 1 — Facebook + Instagram (Meta Graph API)

Facebook og Instagram nota sömu API — þú þarft aðeins einn aðgang.

### Skref 1 — Búðu til Facebook Page fyrir FitBet

> Þetta er opinbera síðan sem agentinn mun pósta á. Það er EKKI persónulegt prófíll.

1. Opnaðu **facebook.com** og skráðu þig inn á þinn persónulega reikning
2. Smelltu á **"+"** efst til hægri → **"Page"**
3. Fylltu út:
   - **Page name:** `FitBet` eða `FitBet Iceland`
   - **Category:** `App` eða `Sports & Recreation`
   - **Description:** Notaðu texta úr `docs/APP_STORE.md`
4. Settu upp mynd (logo) og forsíðumynd
5. Smelltu á **"Create Page"**
6. **Geymdu Page URL-ið** — þú þarft það seinna

### Skref 2 — Búðu til Meta Developer reikning

1. Farðu á **developers.facebook.com**
2. Smelltu á **"Get Started"** efst til hægri
3. Skráðu þig inn með þínum Facebook reikningi
4. Staðfestu símanúmer ef beðið er um það
5. Samþykktu developer skilmálana

### Skref 3 — Búðu til Meta App

1. Á developers.facebook.com → **"My Apps"** → **"Create App"**
2. Veldu **"Other"** → **"Next"**
3. Veldu **"Business"** sem app type → **"Next"**
4. Fylltu út:
   - **App name:** `FitBet Marketing`
   - **App contact email:** þín netfang
   - **Business portfolio:** Búðu til nýtt eða veldu ef þú hefur þegar
5. Smelltu á **"Create App"**
6. **Geymdu App ID** sem birtist — þú þarft það seinna

### Skref 4 — Bættu við Pages API og Instagram API

Á App Dashboard:

1. Vinstra megin → **"Add Products"**
2. Finndu **"Facebook Login for Business"** → **"Set Up"**
3. Farðu aftur í Add Products → Finndu **"Instagram Graph API"** → **"Set Up"**

### Skref 5 — Fáðu Page Access Token

> Þetta er lykilinn sem agentinn notar til að pósta.

1. Á App Dashboard → **"Tools"** → **"Graph API Explorer"**
   (eða farðu á: developers.facebook.com/tools/explorer)
2. Efst til hægri → veldu **þitt app** (FitBet Marketing)
3. Undir **"Permissions"** → smelltu á **"Add a Permission"** og bættu við:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
   - `instagram_basic`
   - `instagram_content_publish`
4. Smelltu á **"Generate Access Token"**
5. Þegar gluggi opnast → veldu **FitBet Facebook Page** → smelltu **"Continue"** og **"Done"**
6. Access Token birtist — **afritaðu hann**

### Skref 6 — Breyttu í Long-lived Token (60 daga)

Sjálfgefinn token er aðeins í 1 klukkustund. Við þurfum 60 daga token.

Opnaðu þetta URL í vafra (fylltu inn þín gildi):

```
https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=ÞITT_APP_ID
  &client_secret=ÞITT_APP_SECRET
  &fb_exchange_token=SKAMMTÍMA_TOKEN_HÉR
```

> App Secret finnurðu á App Dashboard → **"App Settings"** → **"Basic"** → **"App Secret"** → **"Show"**

Svarið inniheldur `access_token` — **þetta er þinn long-lived token**. Settu hann í `.env`:

```
FACEBOOK_PAGE_ACCESS_TOKEN=EAAxxxxxx...
```

**Muna:** Þú þarft að endurnýja þennan token á 60 daga fresti. Við bætum við sjálfvirkri endurnýjun seinna.

### Skref 7 — Fáðu Page ID

1. Farðu á Graph API Explorer
2. Í URL reitinn sláðu inn: `me/accounts`
3. Smelltu **"Submit"**
4. Í svari sérðu lista af síðum — fáðu `id` fyrir FitBet Page

Settu í `.env`:
```
FACEBOOK_PAGE_ID=123456789012345
```

### Skref 8 — Tengdu Instagram Business Account

> Instagram reikningurinn verður að vera **Business** eða **Creator** — ekki persónulegur.

1. Farðu á **instagram.com** → **Settings** → **Account type and tools** → **Switch to professional account**
2. Veldu **Business** → veldu category → **Done**
3. Farðu á **facebook.com** → þín persónulega síða → **Settings** → **Linked accounts** → **Instagram**
4. Tengdu Instagram reikninginn við FitBet Facebook Page

### Skref 9 — Fáðu Instagram User ID

1. Á Graph API Explorer → URL reit: `me?fields=instagram_business_account`
2. Smelltu **"Submit"**
3. Þú sérð `id` undir `instagram_business_account`

Settu í `.env`:
```
INSTAGRAM_USER_ID=17841xxxxxxxxx
```

### Skref 10 — Prófaðu tenginguna

```bash
cd marketing-agent
python agent.py --status
```

Þú ættir að sjá ✅ við Facebook og Instagram.

---

## PART 2 — TikTok (Content Posting API)

> ⚠️ TikTok krefst umsóknar og samþykkis — getur tekið 2-4 vikur.
> Á meðan getur þú notað agentinn til að búa til efni og pósta það handvirkt.

### Skref 1 — Búðu til TikTok Business reikning

1. Farðu á **tiktok.com** og búðu til reikning fyrir FitBet (eða notaðu persónulegan)
2. Farðu í **Settings** → **Account** → **Switch to Business Account**
3. Veldu category: **Technology** eða **Sports**

### Skref 2 — Skráðu þig hjá TikTok for Developers

1. Farðu á **developers.tiktok.com**
2. Smelltu á **"Login"** → skráðu þig inn með TikTok reikningnum
3. Smelltu á **"Apply for Developer"**
4. Fylltu út umsóknareyðublaðið:
   - **App name:** `FitBet`
   - **App description:** Describe the marketing bot briefly
   - **Website:** Þín vefsíða eða App Store link
   - **Use case:** `Content Publishing` / `Marketing`

### Skref 3 — Búðu til TikTok App

1. Á Developer Portal → **"My Apps"** → **"Create an app"**
2. Veldu **"Web"** platform
3. Fylltu út upplýsingar um FitBet
4. Geymdu **Client Key** og **Client Secret**

### Skref 4 — Sæktu um Content Posting API

1. Á App Dashboard → **"Products"** → **"Add products"**
2. Finndu **"Content Posting API"** → smelltu **"Apply"**
3. Fylltu út umsókn:
   - Útskýrðu að þú sért að pósta markaðsefni fyrir eigið app
   - Tengdu við FitBet website/App Store síðu
4. Bíddu eftir samþykki (tölvupóstur berst)

### Skref 5 — Fáðu Access Token (eftir samþykki)

Þegar umsóknin er samþykkt:

1. Á App Dashboard → **"Auth"** → **"Auth Kit"**
2. Notaðu OAuth 2.0 flowið til að fá token:
   - Authorization URL: `https://www.tiktok.com/v2/auth/authorize/`
   - Scope: `video.publish,video.upload`
3. Eftir innskráningu færðu `access_token` og `refresh_token`

Settu í `.env`:
```
TIKTOK_ACCESS_TOKEN=act.xxxxxx...
```

### Bráðabirgðalausn á meðan þú bíður

Agentinn getur búið til fullkláraðar TikTok skriptur sem þú postar handvirkt:

```
python agent.py --quick "Búðu til TikTok skriptu á íslensku um Champions League veðmál"
```

---

## PART 3 — DALL-E 3 Myndagerð (OpenAI)

Þetta er auðveldasta uppsetningin — 5 mínútur.

### Skref 1 — Búðu til OpenAI reikning

1. Farðu á **platform.openai.com**
2. Smelltu á **"Sign up"** → skráðu þig inn
3. Staðfestu netfang

### Skref 2 — Settu upp greiðslu

1. Á platform.openai.com → **"Billing"** → **"Add payment method"**
2. Settu inn kreditkort
3. Settu **Usage limit** á $20-50/mánuð til að vera öruggur

> Verð: DALL-E 3 Standard = ~$0.04 per mynd. Við 30 myndir/mánuð = $1.20/mánuð.

### Skref 3 — Búðu til API lykil

1. **"API Keys"** → **"Create new secret key"**
2. Gefðu honum nafn: `FitBet Marketing`
3. **Afritaðu lykilinn strax** — hann birtist aðeins einu sinni

Settu í `.env`:
```
OPENAI_API_KEY=sk-proj-xxxxxx...
```

---

## PART 4 — Supabase (fyrir mynd hosting)

FitBet app notar þegar Supabase — við þurfum bara að bæta við bucket fyrir myndir.

### Skref 1 — Búðu til marketing-images bucket

1. Farðu á **supabase.com** → þitt FitBet project
2. Vinstra megin → **"Storage"**
3. Smelltu **"New bucket"**
4. Nafn: `marketing-images`
5. Haktu við **"Public bucket"** ✅ (myndir verða public URL-ar)
6. Smelltu **"Create bucket"**

### Skref 2 — Fáðu Service Role Key

1. Í Supabase → **"Settings"** → **"API"**
2. Undir **"Project API keys"** → afritaðu **"service_role"** lykilinn
   ⚠️ Þetta er ekki sama og `anon` lykillinn — passaðu þig!

Settu í `.env`:
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5...
```

> `SUPABASE_URL` er sama og í FitBet app `.env` skránni.

---

## PART 5 — Keyra agentinn

### Fyrsta keyrsla eftir uppsetningu

```bash
cd marketing-agent

# Athugaðu hvað er tilbúið
python agent.py --status

# Kveiktu á agentinum
./run.sh
```

### Keyra tímasettan scheduler

Scheduler-inn þarf að keyra í bakgrunni til að pósta á réttum tíma:

```bash
# Í nýjum terminal glugga:
cd marketing-agent
source venv/bin/activate
python scheduler.py
```

Eða sem bakgrunnsferli:
```bash
nohup python scheduler.py > output/scheduler.log 2>&1 &
echo "Scheduler PID: $!"
```

Til að stöðva:
```bash
kill $(cat scheduler.pid)
# eða
pkill -f scheduler.py
```

### Workflow sem virkar vel

```
1. Opnaðu agent:    ./run.sh
2. Segjum agentinum: "Búðu til týpuleg pósta fyrir vikuna"
3. Agentinn:        Býr til efni, gerir myndir, áætlar í queue
4. Scheduler:       Postar sjálfkrafa á réttum tíma
5. Þú:             Skoðar queue: python agent.py --queue
```

---

## PART 6 — Tímalína og forgangur

```
DAG 1:  ✅ Settu upp Anthropic lykil → agentinn vinnur strax (textagæði)
DAG 1:  ✅ Settu upp OpenAI lykil → myndir virka
DAG 1:  ✅ Settu upp Supabase bucket → myndahýsing virkar

VIKA 1: 🔧 Meta Developer setup → Facebook + Instagram
        Gefst vel ef þú ert þegar með Business Manager reikning

VIKA 2-4: ⏳ TikTok Developer umsókn → bíddu eftir samþykki
          Á meðan: notaðu agentinn til að búa til TikTok skriptur handvirkt
```

---

## Algeng vandamál / Troubleshooting

### "Invalid OAuth access token"
- Facebook token er útrunninn (60 dagar)
- Endurníðu token með Skref 6 hér að ofan

### "Instagram requires image URL"
- Instagram API styður EKKI texta-only pósta
- Alltaf þarf mynd — notaðu `generate_image_for_post` fyrst

### "TikTok: insufficient permissions"
- Content Posting API hefur ekki verið samþykkt enn
- Póstaðu handvirkt á meðan

### "DALL-E: insufficient_quota"
- Þarftu að bæta við greiðslu á platform.openai.com → Billing

### Scheduler postar ekki
```bash
# Athugaðu log:
tail -f output/scheduler.log

# Athugaðu queue:
python agent.py --queue
```

---

## Kostnaður (mánaðarlegt mat)

| Þjónusta | Notkunarform | Áætlaður kostnaður/mánuð |
|----------|-------------|--------------------------|
| Anthropic API | ~500 skilaboð/mánuð | ~$5–15 |
| OpenAI DALL-E 3 | ~60 myndir/mánuð | ~$2–4 |
| Meta Graph API | Gjaldfrjálst | $0 |
| TikTok Content API | Gjaldfrjálst | $0 |
| Supabase Storage | < 1 GB myndir | $0 (free tier) |
| **Samtals** | | **~$7–20/mánuð** |
