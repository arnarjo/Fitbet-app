// supabase/functions/send-push/index.ts
// Deploy with: npx supabase functions deploy send-push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
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

    // 1. Get ALL active push tokens for this user
    const { data: tokenRows, error: tokenError } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)
      .eq('active', true);

    if (tokenError || !tokenRows?.length) {
      return new Response(JSON.stringify({ status: 'no_token' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channelId = getChannelId(data?.type as string);

    // 2. Build one Expo push message per token (supports multi-device users)
    const messages: ExpoPushMessage[] = tokenRows.map(({ token }) => ({
      to: token,
      title,
      body,
      data,
      badge,
      sound,
      priority: 'high',
      channelId,
    }));

    // 3. Send to Expo Push Service (accepts array)
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoData = await expoRes.json();

    // 4. Deactivate any invalid tokens reported by Expo
    const tickets: Array<{ status: string; details?: { error?: string } }> =
      Array.isArray(expoData?.data) ? expoData.data : [expoData?.data];

    await Promise.all(
      tokenRows.map(async ({ token }, i) => {
        const ticket = tickets[i];
        if (ticket?.status === 'error') {
          console.error('Expo push error for token', token.slice(0, 20), ticket.details);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await sb.from('push_tokens').update({ active: false }).eq('token', token);
          }
        }
      }),
    );

    return new Response(JSON.stringify({ status: 'sent', tickets }), {
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

function getChannelId(type?: string): string {
  if (!type) return 'default';
  if (type.includes('bet'))       return 'bets';
  if (type.includes('challenge')) return 'challenges';
  if (type.includes('friend'))    return 'social';
  return 'default';
}
