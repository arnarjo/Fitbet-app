// supabase/functions/send-push/index.ts
// Deploy with: npx supabase functions deploy send-push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { JWT } from 'npm:google-auth-library@9';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const payload: PushPayload = await req.json();
    const { user_id, title, body, data, badge, sound = 'default' } = payload;

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Get user's push tokens from profiles (primary) and push_tokens (history)
    const { data: profile } = await sb.from('profiles').select('push_token').eq('id', user_id).single();
    const { data: historyTokens } = await sb.from('push_tokens').select('token, platform').eq('user_id', user_id).eq('active', true);

    const tokensToNotify: Array<{ token: string; platform: string }> = [];

    if (profile?.push_token) {
      // Basic heuristic: Expo tokens usually start with ExponentPushToken, others are native FCM/APNS
      const isExpo = profile.push_token.startsWith('ExponentPushToken');
      tokensToNotify.push({
        token: profile.push_token,
        platform: isExpo ? 'ios' : 'android'
      });
    }

    if (historyTokens) {
      historyTokens.forEach((row: any) => {
        if (!tokensToNotify.find(t => t.token === row.token)) {
          tokensToNotify.push(row);
        }
      });
    }

    if (tokensToNotify.length === 0) {
      await storeNotification(sb, user_id, title, body, data);
      return new Response(JSON.stringify({ status: 'no_token', stored: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const row of tokensToNotify) {
      try {
        let res;
        if (row.platform === 'android') {
          // Direct FCM v1 for Android
          res = await sendFCMv1(row.token, title, body, data);
        } else {
          // Expo Push Service for iOS (default)
          res = await sendExpo(row.token, title, body, data, badge, sound);
        }
        results.push({ token: row.token, ...res });

        // Deactivate invalid tokens
        if (res.error === 'DeviceNotRegistered' || res.error === 'InvalidToken') {
          await sb.from('push_tokens').update({ active: false }).eq('token', row.token);
          await sb.from('profiles').update({ push_token: null }).eq('id', user_id).eq('push_token', row.token);
        }
      } catch (e) {
        console.error(`Error sending to token ${row.token}:`, e);
        results.push({ token: row.token, error: String(e) });
      }
    }

    // 2. Store notification in DB
    await storeNotification(sb, user_id, title, body, data);

    return new Response(JSON.stringify({ status: 'processed', results }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Push function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function storeNotification(sb: any, user_id: string, title: string, body: string, data: any) {
  await sb.from('notifications').insert({
    user_id,
    type: data?.type ?? 'general',
    title,
    body,
    data: data ?? null,
  });
}

async function sendExpo(token: string, title: string, body: string, data: any, badge?: number, sound?: string) {
  const message = {
    to: token,
    title,
    body,
    data,
    badge,
    sound,
    priority: 'high',
    channelId: getChannelId(data?.type),
  };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const expoData = await res.json();
  const ticket = expoData?.data;
  if (ticket?.status === 'error') {
    return { error: ticket.details?.error ?? 'ExpoError', details: ticket.details };
  }
  return { success: true, ticket };
}

async function sendFCMv1(token: string, title: string, body: string, data: any) {
  const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!fcmServiceAccount) {
    return { error: 'Missing FCM_SERVICE_ACCOUNT' };
  }

  const serviceAccount = JSON.parse(fcmServiceAccount);
  const jwt = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });

  const tokens = await jwt.authorize();
  const accessToken = tokens.access_token;

  // FCM v1 data values must be strings
  const stringData: Record<string, string> = {};
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      stringData[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }

  const message = {
    message: {
      token: token,
      notification: { title, body },
      data: stringData,
      android: {
        priority: 'high',
        notification: {
          channel_id: getChannelId(data?.type),
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    }
  );

  const fcmData = await res.json();
  if (!res.ok) {
    const errorCode = fcmData?.error?.details?.[0]?.errorCode || fcmData?.error?.status;
    if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
      return { error: 'DeviceNotRegistered', details: fcmData.error };
    }
    return { error: 'FCMError', details: fcmData.error };
  }

  return { success: true, messageId: fcmData.name };
}

function getChannelId(type?: string): string {
  if (!type) return 'default';
  if (type.includes('bet'))       return 'bets';
  if (type.includes('challenge')) return 'challenges';
  if (type.includes('friend'))    return 'social';
  return 'default';
}
