# Strava Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Strava auto-approval to cover sund/rowing/interval_run, show a banner when challenges are auto-approved, and replace the broken proof-upload stub with an honest "Strava handles this automatically" message.

**Architecture:** All changes are additive. `findMatchingActivity` in `lib/strava.ts` gains three new exercise blocks. `ChallengesScreen` adds a `stravaApprovedCount` state fed by the existing `checkAndAutoApprove` call. `ProofUploadSheet` introduces a `STRAVA_TRACKABLE_EXERCISES` constant and replaces the stub Strava button with conditional UI. The edge function already has a null guard — no change needed there.

**Tech Stack:** React Native, TypeScript, Supabase, Strava API v3

---

## File Map

| File | Change |
|---|---|
| `src/lib/strava.ts` | Add sund/rowing/interval_run blocks in `findMatchingActivity` |
| `src/screens/ChallengesScreen.tsx` | Add `stravaApprovedCount` state + banner UI |
| `src/components/ProofUploadSheet.tsx` | Add `STRAVA_TRACKABLE_EXERCISES`, replace stub with conditional UI |

---

## Task 1: Add sund, rowing, interval_run matching in `src/lib/strava.ts`

**Files:**
- Modify: `src/lib/strava.ts:200-218`

- [ ] **Step 1: Add three new exercise blocks in `findMatchingActivity`**

Find lines 208-215 in `src/lib/strava.ts` (the end of the `hjólreiðar` block):

```typescript
    if (exercise === 'hjólreiðar' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if ((type === 'ride' || type === 'virtualride' || type === 'ebikeride') && km >= amount * 0.95) {
        return act;
      }
    }
  }

  return null;
```

Replace with:

```typescript
    if (exercise === 'hjólreiðar' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if ((type === 'ride' || type === 'virtualride' || type === 'ebikeride') && km >= amount * 0.95) {
        return act;
      }
    }

    if (exercise === 'sund' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if (type === 'swim' && km >= amount * 0.95) {
        return act;
      }
    }

    if (exercise === 'rowing' && unit === 'm') {
      const type = act.sport_type?.toLowerCase();
      if (type === 'rowing' && act.distance >= amount * 0.95) {
        return act;
      }
    }

    if (exercise === 'interval_run' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if ((type === 'run' || type === 'virtualrun') && km >= amount * 0.95) {
        return act;
      }
    }
  }

  return null;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: only pre-existing Deno errors in supabase/functions, nothing new.

- [ ] **Step 3: Commit**

```bash
git add src/lib/strava.ts
git commit -m "feat: add Strava matching for sund, rowing, interval_run"
```

---

## Task 2: Auto-approval banner in `src/screens/ChallengesScreen.tsx`

**Files:**
- Modify: `src/screens/ChallengesScreen.tsx`

- [ ] **Step 1: Add `stravaApprovedCount` state**

Find line 54 in `ChallengesScreen.tsx` (after `const [showOnboarding, setShowOnboarding] = useState(false);`):

```typescript
  const [showOnboarding, setShowOnboarding] = useState(false);
```

Replace with:

```typescript
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stravaApprovedCount, setStravaApprovedCount] = useState(0);
```

- [ ] **Step 2: Update `useFocusEffect` to capture and auto-clear the count**

Find lines 63-70 in `ChallengesScreen.tsx`:

```typescript
  useFocusEffect(useCallback(() => {
    if (!stravaConnected) return;
    let active = true;
    checkAndAutoApprove().then(count => {
      if (active && count > 0) fetchChallenges();
    });
    return () => { active = false; };
  }, [stravaConnected, checkAndAutoApprove]));
```

Replace with:

```typescript
  useFocusEffect(useCallback(() => {
    if (!stravaConnected) return;
    let active = true;
    checkAndAutoApprove().then(count => {
      if (!active) return;
      if (count > 0) {
        fetchChallenges();
        setStravaApprovedCount(count);
        setTimeout(() => { if (active) setStravaApprovedCount(0); }, 4000);
      }
    });
    return () => { active = false; };
  }, [stravaConnected, checkAndAutoApprove]));
```

- [ ] **Step 3: Add banner UI between tabs and content**

Find lines 553-555 in `ChallengesScreen.tsx`:

```typescript
        </View>

        {/* ── Content ── */}
```

Replace with:

```typescript
        </View>

        {stravaApprovedCount > 0 && (
          <View style={s.stravaBanner}>
            <Text style={s.stravaBannerText}>
              ⚡ Strava samþykkti {stravaApprovedCount} {stravaApprovedCount === 1 ? 'challenge' : 'challenges'} sjálfkrafa
            </Text>
          </View>
        )}

        {/* ── Content ── */}
```

- [ ] **Step 4: Add banner styles**

Find the StyleSheet in `ChallengesScreen.tsx` (look for `const s = StyleSheet.create({`). Add these two styles inside the object, before the closing `}`):

```typescript
  stravaBanner: {
    backgroundColor: 'rgba(252, 82, 0, 0.1)',
    borderColor: '#FC5200',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  stravaBannerText: {
    color: '#FC5200',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: only pre-existing Deno errors, nothing new.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ChallengesScreen.tsx
git commit -m "feat: show banner when Strava auto-approves challenges"
```

---

## Task 3: Replace proof stub in `src/components/ProofUploadSheet.tsx`

**Files:**
- Modify: `src/components/ProofUploadSheet.tsx`

- [ ] **Step 1: Add `STRAVA_TRACKABLE_EXERCISES` constant**

Find the top of `ProofUploadSheet.tsx` where other constants are defined. Add this constant before the component function (after the imports):

```typescript
const STRAVA_TRACKABLE_EXERCISES = ['hlaup', 'hjólreiðar', 'sund', 'rowing', 'interval_run'];
```

- [ ] **Step 2: Replace the idle-state Strava stub**

Find lines 275-328 in `ProofUploadSheet.tsx` (the entire `{/* ── STATE: idle ── */}` block):

```typescript
        {/* ── STATE: idle ── */}
        {uploadState === 'idle' && (
          <View style={s.body}>
            <Text style={s.sectionLabel}>VELDU TEGUND SÖNNUNAR</Text>

            <TouchableOpacity style={s.optionRow} onPress={openCamera} activeOpacity={0.8}>
              <View style={[s.optionIcon, { backgroundColor: 'rgba(0,229,160,0.12)' }]}>
                <Text style={s.optionEmoji}>📷</Text>
              </View>
              <View style={s.optionInfo}>
                <Text style={s.optionTitle}>Taka mynd núna</Text>
                <Text style={s.optionSub}>Opnar myndavél beint</Text>
              </View>
              <Text style={s.optionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('photo')} activeOpacity={0.8}>
              <View style={[s.optionIcon, { backgroundColor: 'rgba(61,139,255,0.12)' }]}>
                <Text style={s.optionEmoji}>🖼</Text>
              </View>
              <View style={s.optionInfo}>
                <Text style={s.optionTitle}>Velja mynd úr safni</Text>
                <Text style={s.optionSub}>Myndir á símanum þínum</Text>
              </View>
              <Text style={s.optionArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('video')} activeOpacity={0.8}>
              <View style={[s.optionIcon, { backgroundColor: 'rgba(255,201,64,0.12)' }]}>
                <Text style={s.optionEmoji}>🎬</Text>
              </View>
              <View style={s.optionInfo}>
                <Text style={s.optionTitle}>Hlaða upp myndband</Text>
                <Text style={s.optionSub}>Hámark 60 sekúndur</Text>
              </View>
              <Text style={s.optionArrow}>›</Text>
            </TouchableOpacity>

            {stravaConnected && (
              <TouchableOpacity style={[s.optionRow, s.stravaOption]} onPress={handleStravaLink} activeOpacity={0.8}>
                <View style={[s.optionIcon, { backgroundColor: 'rgba(0,229,160,0.12)' }]}>
                  <Text style={s.optionEmoji}>⚡</Text>
                </View>
                <View style={s.optionInfo}>
                  <Text style={[s.optionTitle, { color: '#00e5a0' }]}>Tengja Strava æfingu</Text>
                  <Text style={s.optionSub}>Sjálfvirk staðfesting</Text>
                </View>
                <View style={s.stravaBadge}>
                  <Text style={s.stravaBadgeText}>Tengt</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
```

Replace with:

```typescript
        {/* ── STATE: idle ── */}
        {uploadState === 'idle' && (
          <View style={s.body}>
            {STRAVA_TRACKABLE_EXERCISES.includes(challenge.exercise) && stravaConnected ? (
              <View style={s.stravaAutoBox}>
                <Text style={s.stravaAutoEmoji}>🟠</Text>
                <Text style={s.stravaAutoTitle}>Strava sér um þetta sjálfkrafa</Text>
                <Text style={s.stravaAutoSub}>
                  Opnaðu appið eftir æfinguna og við finnum hana sjálfkrafa.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionLabel}>VELDU TEGUND SÖNNUNAR</Text>

                <TouchableOpacity style={s.optionRow} onPress={openCamera} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(0,229,160,0.12)' }]}>
                    <Text style={s.optionEmoji}>📷</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Taka mynd núna</Text>
                    <Text style={s.optionSub}>Opnar myndavél beint</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('photo')} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(61,139,255,0.12)' }]}>
                    <Text style={s.optionEmoji}>🖼</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Velja mynd úr safni</Text>
                    <Text style={s.optionSub}>Myndir á símanum þínum</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.optionRow} onPress={() => openLibrary('video')} activeOpacity={0.8}>
                  <View style={[s.optionIcon, { backgroundColor: 'rgba(255,201,64,0.12)' }]}>
                    <Text style={s.optionEmoji}>🎬</Text>
                  </View>
                  <View style={s.optionInfo}>
                    <Text style={s.optionTitle}>Hlaða upp myndband</Text>
                    <Text style={s.optionSub}>Hámark 60 sekúndur</Text>
                  </View>
                  <Text style={s.optionArrow}>›</Text>
                </TouchableOpacity>

                {STRAVA_TRACKABLE_EXERCISES.includes(challenge.exercise) && !stravaConnected && (
                  <View style={s.stravaPrompt}>
                    <Text style={s.stravaPromptText}>
                      💡 Tengdu Strava til að fá sjálfvirka samþykkt
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
```

- [ ] **Step 3: Add new styles**

Find the StyleSheet in `ProofUploadSheet.tsx`. Add these styles inside the object:

```typescript
  stravaAutoBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  stravaAutoEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  stravaAutoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  stravaAutoSub: {
    fontSize: 14,
    color: '#7a9aaa',
    textAlign: 'center',
    lineHeight: 20,
  },
  stravaPrompt: {
    marginTop: 12,
    backgroundColor: 'rgba(252,82,0,0.08)',
    borderRadius: 8,
    padding: 10,
  },
  stravaPromptText: {
    fontSize: 13,
    color: '#FC5200',
    textAlign: 'center',
  },
```

- [ ] **Step 4: Remove dead `handleStravaLink` function**

Find and delete the entire `handleStravaLink` function (lines 196-224):

```typescript
  async function handleStravaLink() {
    if (!challenge) return;
    // In production: open Strava OAuth, find matching activity, auto-approve
    Alert.alert(
      'Strava',
      'Við leitum að samsvarandi Strava æfingu á síðustu 7 dögum. Ef við finnum hana verður áskorunin sjálfkrafa samþykkt.',
      [
        { text: 'Hætta við', style: 'cancel' },
        {
          text: 'Tengja',
          onPress: async () => {
            // Insert a strava-type proof
            await supabase.from('challenge_proofs').insert({
              challenge_id: challenge.id,
              submitted_by: currentUserId,
              proof_type: 'strava',
              strava_activity_url: 'https://www.strava.com/activities/auto',
              notes: 'Sjálfvirk Strava tenging',
            });
            await supabase.from('challenges')
              .update({ status: 'submitted' })
              .eq('id', challenge.id);
            onSuccess();
            onClose();
          },
        },
      ]
    );
  }
```

Delete the whole block. This function is no longer called anywhere.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: only pre-existing Deno errors, nothing new.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProofUploadSheet.tsx
git commit -m "feat: replace Strava proof stub with auto-approval info UI"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Start the app**

```bash
npx expo start
```

- [ ] **Step 2: Verify Strava auto-approval banner**

With a Strava-connected account that has a matching open challenge:
- Open Challenges screen
- Banner "⚡ Strava samþykkti X challenges sjálfkrafa" should appear if any were auto-approved
- Banner should disappear after 4 seconds

- [ ] **Step 3: Verify ProofUploadSheet for Strava-trackable exercises**

Open proof upload for a `hlaup`, `sund`, `rowing`, or `interval_run` challenge while Strava is connected:
- Should show the orange info box ("Strava sér um þetta sjálfkrafa"), no upload buttons

Open proof upload for the same exercise types while Strava is NOT connected:
- Should show photo/video options + "💡 Tengdu Strava..." prompt at bottom

Open proof upload for a non-trackable exercise (e.g. `pullups`, `hiit`, `box_jumps`):
- Should show photo/video options only, no Strava mention

- [ ] **Step 4: Push to origin**

```bash
git push origin main
```
