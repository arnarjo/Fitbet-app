// src/lib/strava.ts
// Strava OAuth integration for FitBet
// Uses expo-web-browser for OAuth flow + deep linking

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const STRAVA_CLIENT_ID     = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID!;
const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET!;
const REDIRECT_URI         = Linking.createURL('strava-callback');

const STRAVA_AUTH_URL    = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL   = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES  = 'https://www.strava.com/api/v3/athlete/activities';

// ── Types ────────────────────────────────────────────────────
export interface StravaActivity {
  id: number;
  name: string;
  type: string;           // 'Run', 'Ride', 'Walk', etc.
  sport_type: string;
  distance: number;       // metres
  moving_time: number;    // seconds
  start_date: string;     // ISO
  start_date_local: string;
  elapsed_time: number;
}

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;     // Unix timestamp
  athlete_id: number;
}

// ── OAuth flow ───────────────────────────────────────────────

/**
 * Opens Strava OAuth in a browser, exchanges code for tokens,
 * saves tokens to Supabase, returns token data.
 */
export async function connectStrava(userId: string): Promise<{ error?: string; tokens?: StravaTokens }> {
  const authUrl = buildAuthUrl();

  // Open browser
  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

  if (result.type !== 'success' || !result.url) {
    return { error: result.type === 'cancel' ? 'cancelled' : 'auth_failed' };
  }

  // Extract code from redirect URL
  const params  = new URL(result.url).searchParams;
  const code    = params.get('code');
  const scope   = params.get('scope');

  if (!code) return { error: 'no_code' };
  if (!scope?.includes('activity:read')) return { error: 'missing_scope' };

  // Exchange code for tokens
  const { tokens, error } = await exchangeCodeForTokens(code);
  if (error || !tokens) return { error };

  // Save to Supabase
  const { error: dbError } = await supabase.from('profiles').update({
    strava_connected:     true,
    strava_access_token:  tokens.access_token,
    strava_refresh_token: tokens.refresh_token,
    strava_expires_at:    tokens.expires_at,
    strava_athlete_id:    tokens.athlete_id,
  }).eq('id', userId);

  if (dbError) return { error: dbError.message };

  return { tokens };
}

/**
 * Disconnect Strava — clears tokens from profile.
 */
export async function disconnectStrava(userId: string) {
  await supabase.from('profiles').update({
    strava_connected:     false,
    strava_access_token:  null,
    strava_refresh_token: null,
    strava_expires_at:    null,
    strava_athlete_id:    null,
  }).eq('id', userId);
}

// ── Token management ─────────────────────────────────────────

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string): Promise<{ tokens?: StravaTokens; error?: string }> {
  try {
    const res = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) return { error: `token_error_${res.status}` };

    const data = await res.json();
    return {
      tokens: {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
        athlete_id:    data.athlete?.id,
      },
    };
  } catch (e) {
    return { error: String(e) };
  }
}

/**
 * Refresh token if expired. Call before any API request.
 */
async function getValidToken(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_expires_at')
    .eq('id', userId)
    .single();

  if (!profile?.strava_access_token) return null;

  // Still valid
  if (profile.strava_expires_at && profile.strava_expires_at > Math.floor(Date.now() / 1000) + 60) {
    return profile.strava_access_token;
  }

  // Refresh
  try {
    const res = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: profile.strava_refresh_token,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    await supabase.from('profiles').update({
      strava_access_token:  data.access_token,
      strava_refresh_token: data.refresh_token,
      strava_expires_at:    data.expires_at,
    }).eq('id', userId);

    return data.access_token;
  } catch {
    return null;
  }
}

// ── Activity fetching ─────────────────────────────────────────

/**
 * Fetch recent Strava activities (last 7 days).
 */
export async function getRecentActivities(userId: string): Promise<StravaActivity[]> {
  const token = await getValidToken(userId);
  if (!token) return [];

  const after = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

  try {
    const res = await fetch(`${STRAVA_ACTIVITIES}?after=${after}&per_page=30`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Try to auto-match a Strava activity to a challenge.
 * Returns matching activity or null.
 */
export async function findMatchingActivity(
  userId: string,
  exercise: string,
  amount: number,
  unit: string,
  challengeCreatedAt: string
): Promise<StravaActivity | null> {
  const activities = await getRecentActivities(userId);

  const createdTime = new Date(challengeCreatedAt).getTime();

  for (const act of activities) {
    const actTime = new Date(act.start_date).getTime();
    // Only look at activities AFTER challenge was assigned
    if (actTime < createdTime) continue;

    if (exercise === 'hlaup' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if ((type === 'run' || type === 'virtualrun') && km >= amount * 0.95) {
        return act;
      }
    }

    if (exercise === 'hjólreiðar' && unit === 'km') {
      const km = act.distance / 1000;
      const type = act.sport_type?.toLowerCase();
      if ((type === 'ride' || type === 'virtualride' || type === 'ebikeride') && km >= amount * 0.95) {
        return act;
      }
    }
  }

  return null;
}

/**
 * Auto-approve challenge via Strava if matching activity found.
 * Returns true if auto-approved.
 */
export async function tryAutoApproveChallenge(
  userId: string,
  challengeId: string,
  exercise: string,
  amount: number,
  unit: string,
  challengeCreatedAt: string,
  winnerId: string
): Promise<boolean> {
  const match = await findMatchingActivity(userId, exercise, amount, unit, challengeCreatedAt);
  if (!match) return false;

  const stravaUrl = `https://www.strava.com/activities/${match.id}`;

  // Submit Strava proof
  const { error: proofError } = await supabase.from('challenge_proofs').insert({
    challenge_id:        challengeId,
    submitted_by:        userId,
    proof_type:          'strava',
    strava_activity_url: stravaUrl,
    notes:               `Sjálfvirk Strava staðfesting — ${match.name} (${(match.distance / 1000).toFixed(1)} km)`,
    status:              'approved',
    reviewed_by:         userId,
  });

  if (proofError) return false;

  // Update challenge to approved
  await supabase.from('challenges').update({
    status:              'approved',
    strava_activity_id:  String(match.id),
    completed_at:        new Date().toISOString(),
  }).eq('id', challengeId);

  // Notify winner
  await supabase.from('notifications').insert({
    user_id: winnerId,
    type:    'challenge_approved',
    title:   'Áskorun staðfest sjálfkrafa ⚡',
    body:    'Strava staðfesti áskorunina sjálfkrafa.',
    data:    { challenge_id: challengeId, strava_activity_id: match.id },
  });

  return true;
}
