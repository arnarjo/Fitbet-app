// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { navigationRef } from './navigationRef';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useLanguage } from '../hooks/useLanguage';
import { useBadgeCount } from '../hooks/useBadgeCount';
import { useAuth } from '../hooks/useAuth';

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
import HistoryScreen     from '../screens/HistoryScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home:        '⚽',
  Matches:     '📅',
  Challenges:  '💪',
  Leaderboard: '🏆',
  Profile:     '👤',
};

function MainTabs() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const badgeCount = useBadgeCount(profile?.id ?? '');
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
            {TAB_ICONS[route.name] ?? '●'}
          </Text>
        ),
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
      <Tab.Screen name="Home"        component={HomeScreen}        options={{ tabBarLabel: t('tab_home')        }} />
      <Tab.Screen name="Matches"     component={MatchesScreen}     options={{ tabBarLabel: t('tab_matches')     }} />
      <Tab.Screen name="Challenges"  component={ChallengesScreen}  options={{ tabBarLabel: t('tab_challenges'), tabBarBadge: badgeCount > 0 ? badgeCount : undefined  }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarLabel: t('tab_leaderboard') }} />
      <Tab.Screen name="Profile"     component={ProfileScreen}     options={{ tabBarLabel: t('tab_profile')     }} />
    </Tab.Navigator>
  );
}

type RootNavigatorProps = {
  onRouteChange?: (routeName: string) => void;
};

export default function RootNavigator({ onRouteChange }: RootNavigatorProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  usePushNotifications(session?.user?.id ?? '', navigationRef);

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
            <Stack.Screen name="Main"         component={MainTabs} />
            <Stack.Screen name="Season"       component={SeasonScreen} />
            <Stack.Screen name="LeaguesFull"  component={LeaderboardScreen} />
            <Stack.Screen name="Leagues"      component={LeaguesScreen} />
            <Stack.Screen name="Friends"      component={FriendsScreen} />
            <Stack.Screen name="History"      component={HistoryScreen} />
            <Stack.Screen name="Admin"        component={AdminScreen} />
            <Stack.Screen name="Paywall"      component={PaywallScreen}
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
