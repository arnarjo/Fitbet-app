import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { loadSavedLanguage } from './src/lib/i18n';

function AppInner() {
  usePushNotifications();

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return <AppInner />;
}
