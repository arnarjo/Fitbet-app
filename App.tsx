import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import FloatingChallengeButton from './src/components/FloatingChallengeButton';
import { supabase } from './src/lib/supabase';
import { LanguageProvider } from './src/hooks/useLanguage';
import { setupRevenueCat } from './src/lib/revenuecat';
import type { Session } from '@supabase/supabase-js';

function AppInner() {
  const [session, setSession] = useState<Session | null>(null);
  const [currentRouteName, setCurrentRouteName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) setupRevenueCat(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) setupRevenueCat(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hiddenFabRoutes = ['Login', 'Signup', 'Onboarding', 'Challenges', 'Season'];
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
    <LanguageProvider>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <AppInner />
        </SafeAreaView>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}
