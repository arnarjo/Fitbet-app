// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { navigationRef } from './navigationRef';

// Auth screens
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen      from '../screens/auth/LoginScreen';
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
    Heim:       '⚽',
    Leikir:     '📅',
    Áskoranir:  '💪',
    Stigatafla: '🏆',
    Prófíll:    '👤',
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
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: '#050f17',
          borderTopColor: '#0d2030',
          borderTopWidth: 1,
          height: 82,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { marginBottom: 4, fontSize: 10 },
        tabBarItemStyle:  { paddingVertical: 4 },
        tabBarActiveTintColor:   '#21A56A',
        tabBarInactiveTintColor: '#4a6878',
      })}
    >
      <Tab.Screen name="Heim"        component={HomeScreen} />
      <Tab.Screen name="Leikir"      component={MatchesScreen} />
      <Tab.Screen name="Áskoranir"   component={ChallengesScreen} />
      <Tab.Screen name="Stigatafla"  component={LeaderboardScreen} />
      <Tab.Screen name="Prófíll"     component={ProfileScreen} />
    </Tab.Navigator>
  );
}

type RootNavigatorProps = {
  onRouteChange?: (routeName: string) => void;
};

export default function RootNavigator({ onRouteChange }: RootNavigatorProps) {
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
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        const currentRoute = navigationRef.getCurrentRoute();
        if (currentRoute?.name) {
          onRouteChange?.(currentRoute.name);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main"              component={MainTabs} />
            <Stack.Screen name="Tímabilsveðmál"   component={SeasonScreen} />
            <Stack.Screen name="Leaderboard"       component={LeaderboardScreen} />
            <Stack.Screen name="Leagues"           component={LeaguesScreen} />
            <Stack.Screen name="Friends"           component={FriendsScreen} />
            <Stack.Screen name="Admin"             component={AdminScreen} />
            <Stack.Screen name="Paywall"           component={PaywallScreen}
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
