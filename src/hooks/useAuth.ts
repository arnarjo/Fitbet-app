import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';
import type { Session } from '@supabase/supabase-js';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// Web Client ID from Google Cloud Console → APIs & Services → Credentials
const WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
    setLoading(false);
  }

  async function refreshProfile() {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error) setProfile(data);
  }

  async function signUp(email: string, password: string, username: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, full_name: fullName } },
    });
    return { error };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    try { await GoogleSignin.signOut(); } catch {}
  }

  async function signInWithGoogle(): Promise<{ error: Error | null }> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      const idToken = response.data?.idToken ?? (response as any).idToken;
      if (!idToken) return { error: new Error('No ID token returned from Google') };

      const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (authError) return { error: authError };
      if (!authData.user) return { error: new Error('No user returned from Supabase') };

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (!existingProfile) {
        const googleUser = response.data?.user ?? (response as any).user;
        const baseName = (googleUser?.givenName ?? googleUser?.name ?? 'user')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
        const username = await generateUniqueUsername(baseName);
        const fullName = googleUser?.name ?? '';

        await supabase.from('profiles').insert({
          id: authData.user.id,
          username,
          full_name: fullName,
          email: authData.user.email,
        });
      }

      return { error: null };
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { error: null };
      }
      return { error: err };
    }
  }

  async function generateUniqueUsername(base: string): Promise<string> {
    const candidate = base || 'user';

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', candidate)
      .maybeSingle();

    if (!data) return candidate;

    const suffix = Math.floor(1000 + Math.random() * 9000);
    const withSuffix = `${candidate}${suffix}`;

    const { data: data2 } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', withSuffix)
      .maybeSingle();

    if (!data2) return withSuffix;

    return `${candidate}${Date.now().toString().slice(-6)}`;
  }

  return { session, profile, loading, signUp, signIn, signOut, signInWithGoogle, refreshProfile };
}
