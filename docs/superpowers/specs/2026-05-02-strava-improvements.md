# Strava Integration Improvements

**Date:** 2026-05-02
**Status:** Approved

## Problem

The Strava integration has three main issues:

1. **Incomplete exercise matching** — Auto-approval only works for `hlaup` and `hjólreiðar`. The premium exercises `sund`, `rowing`, and `interval_run` are listed as Strava-supported but have no matching logic. We just added `rowing` as a new premium exercise, making this gap critical.

2. **Broken proof stub** — `ProofUploadSheet` shows a "Tengt Strava" button that inserts a hardcoded fake URL (`https://www.strava.com/activities/auto`). It does nothing useful and misleads the user.

3. **NULL crash in edge function** — `supabase/functions/strava-auth/index.ts` does not check if the profile exists before accessing `strava_refresh_token`, causing a crash if the profile is in a corrupted state (`strava_connected=true` but no tokens).

## Goal

- Fully automatic Strava approval for all trackable exercises
- Clear user feedback when challenges are auto-approved
- Replace broken stub with honest "Strava handles this" message
- Fix the edge function crash

## What We Are NOT Doing

- Strava webhooks (real-time approval without opening app)
- Activity picker UI
- Push notifications for auto-approval
- Refactoring the full OAuth flow

---

## Changes

### 1. Add exercise matching in `src/lib/strava.ts`

Extend `findMatchingActivity()` to handle three new exercise types:

| Challenge type | Strava sport_type(s) | Unit conversion | Threshold |
|---|---|---|---|
| `sund` | `Swim` | Strava metres ÷ 1000 → km (challenge stored in km) | ≥ 95% of challenge amount |
| `rowing` | `Rowing` | Strava metres = metres (challenge stored in m) | ≥ 95% of challenge amount |
| `interval_run` | `Run`, `VirtualRun` | Strava metres ÷ 1000 → km (challenge stored in km) | ≥ 95% of challenge amount |

`interval_run` is treated identically to `hlaup` — Strava does not detect interval structure, so we match on distance alone.

### 2. Auto-approval banner in `src/screens/ChallengesScreen.tsx`

`checkAndAutoApprove()` already returns the count of approved challenges. When count > 0, display a banner at the top of the screen:

> "⚡ Strava samþykkti [N] challenge[s] sjálfkrafa"

Banner auto-dismisses after 4 seconds. Uses existing `useState` + `useEffect` pattern already in the screen.

### 3. Replace stub in `src/components/ProofUploadSheet.tsx`

Define a constant `STRAVA_TRACKABLE_EXERCISES`:
```
['hlaup', 'hjólreiðar', 'sund', 'rowing', 'interval_run']
```

When the challenge exercise is in `STRAVA_TRACKABLE_EXERCISES` **and** `stravaConnected` prop is `true`:
- Hide all proof upload options (photo/video/screenshot)
- Show info box instead:
  > "🟠 Strava sér um þetta sjálfkrafa. Opnaðu appið eftir æfinguna og við finnum hana."

When the challenge exercise is in `STRAVA_TRACKABLE_EXERCISES` **but** `stravaConnected` is `false`:
- Show normal proof upload options
- Show a soft prompt: "Tengdu Strava til að fá sjálfvirka samþykkt"

When the challenge exercise is NOT in `STRAVA_TRACKABLE_EXERCISES` (e.g. pullups, hiit, box_jumps):
- Show normal proof upload options as today

### 4. Fix NULL check in `supabase/functions/strava-auth/index.ts`

In the `refresh` action handler, add a guard after the profile fetch:

```typescript
if (!profile || !profile.strava_refresh_token) {
  return new Response(
    JSON.stringify({ error: 'no_strava_tokens' }),
    { status: 400, headers: corsHeaders }
  );
}
```

This prevents a crash when `strava_connected=true` but tokens are missing.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/strava.ts` | Add sund/rowing/interval_run to `findMatchingActivity()` |
| `src/screens/ChallengesScreen.tsx` | Add auto-approval banner |
| `src/components/ProofUploadSheet.tsx` | Replace stub with STRAVA_TRACKABLE_EXERCISES logic |
| `supabase/functions/strava-auth/index.ts` | Add NULL guard on profile tokens |

---

## Out of Scope

- Strava webhooks
- Activity picker UI  
- Push notifications
- Token refresh retry logic
- CORS hardening
- Deduplication of activity matching
