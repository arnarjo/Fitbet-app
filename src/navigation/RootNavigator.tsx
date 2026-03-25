// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Auth screens
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen     from '../screens/auth/LoginScreen';
import SignupScreen     from '../screens/auth/SignupScreen';

// Main screens
import HomeScreen        from '../screens/HomeScreen';
import MatchesScreen     from '../screens/MatchesScreen';
import ChallengesScreen  from '../screens/ChallengesScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import SeasonScreen      from '../screens/SeasonScreen';
import LeaguesScreen     from '../screens/LeaguesScreen';
import FriendsScreen     from '../screens/FriendsScreen';
import AdminScreen       from '../screens/AdminScreen';
import PaywallScreen     from '../screens/PaywallScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Heim: '⚽', Leikir: '📅', Áskoranir: '💪',
    Stigatafla: '🏆', Vinir: '👥', Deildir: '🏅',
    Tímabil: '📊', Prófíll: '👤',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[name] ?? '●'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111118',
          borderTopColor: 'rgba(255,255,255,0.08)',
          height: 80,
          paddingBottom: 12,
        },
        tabBarActiveTintColor:   '#00e5a0',
        tabBarInactiveTintColor: '#5a5a72',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Heim"       component={HomeScreen} />
      <Tab.Screen name="Leikir"     component={MatchesScreen} />
      <Tab.Screen name="Áskoranir"  component={ChallengesScreen} />
      <Tab.Screen name="Stigatafla" component={LeaderboardScreen} />
      <Tab.Screen name="Vinir"      component={FriendsScreen} />
      <Tab.Screen name="Deildir"    component={LeaguesScreen} />
      <Tab.Screen name="Tímabil"    component={SeasonScreen} />
      <Tab.Screen name="Prófíll"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main"    component={MainTabs} />
            <Stack.Screen name="Admin"   component={AdminScreen} />
            <Stack.Screen name="Paywall" component={PaywallScreen}
              options={{ presentation: 'modal' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login"      component={LoginScreen} />
            <Stack.Screen name="Signup"     component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
