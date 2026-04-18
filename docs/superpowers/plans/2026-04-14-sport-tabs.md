# Sport Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Fótbolti / NBA / NFL sport tabs to MatchesScreen, with league sub-tabs only under Fótbolti, and hide the draw option in BetModal for NBA/NFL.

**Architecture:** MatchesScreen gains a `sport` state (`'football' | 'nba' | 'nfl'`). When sport is `'football'`, the existing league filter row is shown and `useMatches` is called with the selected league. When sport is `'nba'` or `'nfl'`, the league row is hidden and `useMatches` is called with `league_name = 'NBA'` or `'NFL'`. BetModal derives the prediction options array from `match.league_name` — NBA/NFL get `['home', 'away']` only.

**Tech Stack:** React Native, TypeScript, existing `useMatches` hook (no changes needed)

---

## Files Changed

- Modify: `src/screens/MatchesScreen.tsx` — add sport tab row, conditional league row
- Modify: `src/components/BetModal.tsx` — hide draw for NBA/NFL

---

### Task 1: Add sport tabs to MatchesScreen

**Files:**
- Modify: `src/screens/MatchesScreen.tsx`

- [ ] **Step 1: Add sport state and SPORT_TABS constant**

  At the top of the file, replace the existing `LEAGUES` constant and add `SPORT_TABS`:

  ```typescript
  const SPORT_TABS = [
    { key: 'football', label: 'Fótbolti' },
    { key: 'nba',      label: 'NBA' },
    { key: 'nfl',      label: 'NFL' },
  ] as const;

  type Sport = typeof SPORT_TABS[number]['key'];

  const FOOTBALL_LEAGUES = [
    { key: 'all',                   label: 'Allir' },
    { key: 'Besta deild karla',     label: 'Besta deildin' },
    { key: 'Lengjudeild karla',     label: 'Lengjudeildin' },
    { key: 'Premier League',        label: 'Premier League' },
    { key: 'UEFA Champions League', label: 'Champions Lg' },
    { key: 'FIFA World Cup',        label: 'World Cup' },
  ];
  ```

  Remove the old `const LEAGUES = [...]` block entirely.

- [ ] **Step 2: Add sport state inside the component**

  Inside `MatchesScreen`, after the existing `useState` declarations, add:

  ```typescript
  const [activeSport, setActiveSport] = useState<Sport>('football');
  ```

- [ ] **Step 3: Derive the league name passed to useMatches**

  Replace the existing:
  ```typescript
  const league = activeLeague === 'all' ? undefined : activeLeague;
  const { matches, loading, error, refetch } = useMatches(league);
  ```

  With:
  ```typescript
  const leagueFilter = (() => {
    if (activeSport === 'nba') return 'NBA';
    if (activeSport === 'nfl') return 'NFL';
    return activeLeague === 'all' ? undefined : activeLeague;
  })();
  const { matches, loading, error, refetch } = useMatches(leagueFilter);
  ```

- [ ] **Step 4: Reset activeLeague when switching sports**

  Update `setActiveSport` calls to also reset the league:

  In the JSX (next step), use this handler:
  ```typescript
  function handleSportChange(sport: Sport) {
    setActiveSport(sport);
    setActiveLeague('all');
  }
  ```

  Add this function inside the component, before the `return`.

- [ ] **Step 5: Add sport tab row and make league row conditional in JSX**

  Replace the existing `<ScrollView horizontal ...>` league tabs block with:

  ```tsx
  {/* Sport tabs */}
  <View style={s.sportTabsRow}>
    {SPORT_TABS.map((st) => (
      <TouchableOpacity
        key={st.key}
        style={[s.sportTab, activeSport === st.key && s.sportTabActive]}
        onPress={() => handleSportChange(st.key)}
        activeOpacity={0.75}
      >
        <Text style={[s.sportTabText, activeSport === st.key && s.sportTabTextActive]}>
          {st.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* League sub-tabs (football only) */}
  {activeSport === 'football' && (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.tabsScroll}
      contentContainerStyle={s.tabsContent}
    >
      {FOOTBALL_LEAGUES.map((lg) => {
        const locked = lg.key !== 'all' && !canAccessLeague(lg.key);
        return (
          <TouchableOpacity
            key={lg.key}
            style={[s.tab, activeLeague === lg.key && s.tabActive, locked && s.tabLocked]}
            onPress={() => {
              if (locked) {
                navigation.navigate('Paywall', { feature: 'general' });
              } else {
                setActiveLeague(lg.key);
              }
            }}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, activeLeague === lg.key && s.tabTextActive, locked && s.tabTextLocked]}>
              {locked ? '🔒 ' : ''}{lg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  )}
  ```

- [ ] **Step 6: Add styles for sport tabs**

  Add to the `StyleSheet.create` at the bottom of the file:

  ```typescript
  sportTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
  },
  sportTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sportTabActive: {
    backgroundColor: '#21A56A',
    borderColor: '#21A56A',
  },
  sportTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7a9aaa',
  },
  sportTabTextActive: {
    color: '#000',
  },
  ```

- [ ] **Step 7: Verify the app renders without errors**

  Run: `npx expo start` and open the Matches screen. Confirm:
  - Three sport tabs visible at top: Fótbolti, NBA, NFL
  - Fótbolti selected by default, league sub-tabs visible below
  - Tapping NBA or NFL hides the league sub-tabs
  - Tapping back to Fótbolti shows league sub-tabs again
  - Matches list updates when switching tabs

- [ ] **Step 8: Commit**

  ```bash
  git add src/screens/MatchesScreen.tsx
  git commit -m "feat: add Fótbolti/NBA/NFL sport tabs to MatchesScreen"
  ```

---

### Task 2: Hide draw option in BetModal for NBA/NFL

**Files:**
- Modify: `src/components/BetModal.tsx`

- [ ] **Step 1: Derive prediction options from league_name**

  In `BetModal.tsx`, find the prediction step render block. Currently at line ~357:

  ```typescript
  {(['home', 'draw', 'away'] as MatchResult[]).map((pred) => {
  ```

  Replace that one line with:

  ```typescript
  {(['home', 'draw', 'away'] as MatchResult[])
    .filter((pred) =>
      pred !== 'draw' || !['NBA', 'NFL'].includes(match.league_name)
    )
    .map((pred) => {
  ```

  This keeps all three options for football and filters out `'draw'` for NBA/NFL.

- [ ] **Step 2: Verify BetModal renders correctly**

  Run: `npx expo start` and open the bet modal on a football match. Confirm:
  - Football match shows Home / Draw / Away (three cards)
  
  If you have NBA/NFL test matches, confirm they show only Home / Away (two cards). If no NBA/NFL matches exist yet, this is fine — the logic is correct and will work when matches are added.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/BetModal.tsx
  git commit -m "feat: hide draw option in BetModal for NBA/NFL matches"
  ```

---

### Task 3: EAS Update to production

- [ ] **Step 1: Push OTA update**

  ```bash
  eas update --branch production --message "Add NBA/NFL sport tabs, hide draw for NBA/NFL bets"
  ```

- [ ] **Step 2: Verify update published**

  Confirm output shows iOS and Android update group IDs.
