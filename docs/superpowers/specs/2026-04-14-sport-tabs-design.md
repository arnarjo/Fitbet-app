# Sport Tabs Design — MatchesScreen

**Date:** 2026-04-14

## Summary

Add top-level sport tabs (Fótbolti / NBA / NFL) to MatchesScreen. NBA and NFL show no draw option in BetModal. Backend sync deferred until API subscription is upgraded.

## UI Structure

MatchesScreen gains two tab rows:

**Row 1 — sport selector (always visible):**
```
[ Fótbolti ]  [ NBA ]  [ NFL ]
```

**Row 2 — league filter (only when Fótbolti is active):**
```
[ Allir | Besta deildin | Lengjudeildin | Premier League | Champions Lg | World Cup ]
```

When NBA or NFL is selected:
- League row is hidden
- Matches are filtered by `league_name = 'NBA'` or `league_name = 'NFL'`
- Grouped by TODAY / TOMORROW / LATER (same as football)
- Empty state shown until API sync is set up

## BetModal Change

When `match.league_name` is `'NBA'` or `'NFL'`, the draw/jafntefli prediction button is hidden. Only home and away options are shown.

## Data Model

No schema changes needed. NBA and NFL matches will use the existing `matches` table with:
- `league_name = 'NBA'` or `league_name = 'NFL'`
- `result` = `'home'` or `'away'` only (never `'draw'`)

## Out of Scope (deferred)

- NBA/NFL team records in `teams` table
- `sync-matches` extension for basketball/american-football APIs
- Requires api-sports.io all-sports subscription upgrade

## Files Changed

- `src/screens/MatchesScreen.tsx` — add sport tabs, conditional league row
- `src/components/BetModal.tsx` — hide draw option for NBA/NFL
