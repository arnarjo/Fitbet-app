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
import type { NavigationContainerRef, NavigationContainerRefWithCurrent } from '@react-navigation/native';

// ── Configure how notifications appear while app is open ──
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string;
    // Show all as banners except passive feed events
    const shouldShow = !['friend_accepted'].includes(type);
    return {
      shouldShowAlert:  shouldShow,
      shouldShowBanner: shouldShow,
      shouldShowList:   shouldShow,
      shouldPlaySound:  shouldShow,
      shouldSetBadge:   true,
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
  navigationRef: NavigationContainerRefWithCurrent<any>
) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [tokenError, setTokenError] = useState<string | null>(null);

  const notifListener    = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const appStateRef    = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    setupAndroidChannels();
    registerForPushNotifications();

    // ── Foreground notification received ──
    notifListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
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
      setTokenError('not_a_device');
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
      setTokenError('permission_denied:' + finalStatus);
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId
      ?? 'b521fa2f-ed33-4a86-a63a-5787c27830d5';

    let token: string | undefined;
    try {
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      token = result.data;
    } catch (err: any) {
      setTokenError('token_fetch_failed:' + String(err?.message ?? err));
      return;
    }

    if (!token) {
      setTokenError('token_empty');
      return;
    }

    setExpoPushToken(token);

    // Save token to Supabase
    const platform = Platform.OS as 'ios' | 'android';
    const { error: upsertError } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform, active: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (upsertError) {
      setTokenError('upsert_failed:' + upsertError.message);
    } else {
      // Success — token saved, clear any previous error
      setTokenError(null);
    }
  }

  // ── Deep link routing on tap ─────────────────────────────
  function handleNotificationTap(data: any) {
    if (!data || !navigationRef.isReady()) return;
    const nav = navigationRef;

    switch (data.type) {
      case 'bet_received':
      case 'bet_accepted':
      case 'bet_declined':
      case 'bet_won':
      case 'bet_lost':
      case 'bet_created':
        nav.navigate('Main', { screen: 'Challenges' });
        break;

      case 'season_bet_received':
      case 'season_bet_accepted':
      case 'season_bet_declined':
      case 'season_bet_created':
        nav.navigate('Season');
        break;

      case 'challenge_assigned':
      case 'challenge_submitted':
      case 'challenge_approved':
      case 'challenge_rejected':
      case 'challenge_reminder':
        nav.navigate('Main', { screen: 'Challenges' });
        break;

      case 'friend_request':
      case 'friend_accepted':
        nav.navigate('Friends');
        break;

      default:
        nav.navigate('Main', { screen: 'Home' });
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

  return { expoPushToken, permissionStatus, tokenError };
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
  return { error };
}
