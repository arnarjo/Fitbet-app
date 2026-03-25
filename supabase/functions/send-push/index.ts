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

    // 1. Get user's push token
    const { data: tokenRow, error: tokenError } = await sb
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)
      .eq('active', true)
      .single();

    if (tokenError || !tokenRow?.token) {
      // No token — store notification only, don't fail
      await sb.from('notifications').insert({
        user_id,
        type: data?.type ?? 'general',
        title,
        body,
        data: data ?? null,
      });
      return new Response(JSON.stringify({ status: 'no_token', stored: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Build Expo push message
    const message: ExpoPushMessage = {
      to: tokenRow.token,
      title,
      body,
      data,
      badge,
      sound,
      priority: 'high',
      channelId: getChannelId(data?.type as string),
    };

    // 3. Send to Expo Push Service
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const expoData = await expoRes.json();

    // 4. Check for errors from Expo
    const ticket = expoData?.data;
    if (ticket?.status === 'error') {
      console.error('Expo push error:', ticket.details);
      // If token invalid, deactivate it
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await sb.from('push_tokens').update({ active: false }).eq('token', tokenRow.token);
      }
    }

    // 5. Store notification in DB
    await sb.from('notifications').insert({
      user_id,
      type: data?.type ?? 'general',
      title,
      body,
      data: data ?? null,
    });

    return new Response(JSON.stringify({ status: 'sent', ticket }), {
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
