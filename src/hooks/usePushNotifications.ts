// src/hooks/usePushNotifications.ts
// Full push notification setup for Expo + Supabase
// Handles: token registration, foreground + background listeners,
// deep link routing, badge count management

import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import type { NavigationContainerRef } from '@react-navigation/native';

// ── Configure how notifications appear while app is open ──
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string;
    // Show all as banners except passive feed events
    const shouldShow = !['friend_accepted'].includes(type);
    return {
      shouldShowAlert: shouldShow,
      shouldPlaySound: shouldShow,
      shouldSetBadge:  true,
    };
  },
});

// ── Android notification channels ────────────────────────────
async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('bets', {
      name: 'Veðmál',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#00e5a0',
    }),
    Notifications.setNotificationChannelAsync('challenges', {
      name: 'Áskoranir',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#ff4a6e',
    }),
    Notifications.setNotificationChannelAsync('social', {
      name: 'Samfélag',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#a855f7',
    }),
    Notifications.setNotificationChannelAsync('default', {
      name: 'Almennt',
      importance: Notifications.AndroidImportance.DEFAULT,
    }),
  ]);
}

// ── Main hook ─────────────────────────────────────────────────
export function usePushNotifications(
  userId: string,
  navigationRef: React.RefObject<NavigationContainerRef<any>>
) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  const notifListener  = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appStateRef    = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    setupAndroidChannels();
    registerForPushNotifications();

    // ── Foreground notification received ──
    notifListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const type = notification.request.content.data?.type as string;
        console.log('[Push] Received in foreground:', type);
        // Badge update is handled by OS
      }
    );

    // ── User tapped a notification ──
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationTap(response.notification.request.content.data);
      }
    );

    // ── App came back to foreground — refresh badge ──
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (appStateRef.current.match(/inactive|background/) && state === 'active') {
        await Notifications.setBadgeCountAsync(0);
        await markNotificationsRead();
      }
      appStateRef.current = state;
    });

    // Handle notification that launched the app
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationTap(response.notification.request.content.data);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
      appStateSub.remove();
    };
  }, [userId]);

  // ── Register device & save token ─────────────────────────
  async function registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log('[Push] Must use physical device for push notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.error('[Push] No project ID found in app config');
      return;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    setExpoPushToken(token);

    // Save token to Supabase
    const platform = Platform.OS as 'ios' | 'android';
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, active: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    console.log('[Push] Token registered:', token.slice(0, 20) + '...');
  }

  // ── Deep link routing on tap ─────────────────────────────
  function handleNotificationTap(data: any) {
    if (!data || !navigationRef.current) return;
    const nav = navigationRef.current;

    console.log('[Push] Tapped notification:', data.type);

    switch (data.type) {
      case 'bet_received':
      case 'bet_accepted':
      case 'bet_declined':
      case 'bet_won':
      case 'bet_lost':
        nav.navigate('Veðmál');
        break;

      case 'challenge_assigned':
      case 'challenge_submitted':
      case 'challenge_approved':
      case 'challenge_rejected':
        nav.navigate('Veðmál', { screen: 'Áskoranir' });
        break;

      case 'friend_request':
      case 'friend_accepted':
        nav.navigate('Vinir');
        break;

      default:
        nav.navigate('Heim');
    }

    // Mark as read
    Notifications.setBadgeCountAsync(0);
  }

  // ── Mark notifications read in DB ────────────────────────
  async function markNotificationsRead() {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }

  // ── Manual: send test push (dev only) ────────────────────
  async function sendTestPush() {
    if (!expoPushToken) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:    expoPushToken,
        title: 'FitBet próf 🎯',
        body:  'Push tilkynningar virka! Vel gert.',
        data:  { type: 'test' },
        sound: 'default',
      }),
    });
  }

  return { expoPushToken, permissionStatus, sendTestPush };
}


// ── Utility: send push via Supabase Edge Function ─────────────
// Call this anywhere in the app to send a push
export async function sendPushToUser(params: {
  userId:  string;
  title:   string;
  body:    string;
  data?:   Record<string, unknown>;
  badge?:  number;
}) {
  const { error } = await supabase.functions.invoke('send-push', {
    body: params,
  });
  if (error) console.error('[Push] Edge function error:', error);
  return { error };
}
