import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import FloatingChallengeButton from './src/components/FloatingChallengeButton';
import { navigationRef } from './src/navigation/navigationRef';
import { supabase } from './src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

function AppInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState('');

  usePushNotifications(session?.user?.id ?? '', navigationRef);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hiddenFabRoutes = ['Login', 'Signup', 'Onboarding', 'Áskoranir', 'Tímabilsveðmál'];
  const showFab = !!session && !hiddenFabRoutes.includes(currentRouteName);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator onRouteChange={setCurrentRouteName} />
      {showFab ? <FloatingChallengeButton /> : null}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <AppInner />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
