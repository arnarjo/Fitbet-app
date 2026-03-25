// src/hooks/usePremium.ts
// Hook to check and manage premium status throughout the app

import { useState, useEffect, createContext, useContext } from 'react';
import { isPremium, setupRevenueCat } from '../lib/revenuecat';
import { useAuth } from './useAuth';

// ── Limits ───────────────────────────────────────────────────
export const FREE_LIMITS = {
  maxLeagues:          2,
  stravaConnected:     false,
  customChallenges:    false,
};

export const PREMIUM_LIMITS = {
  maxLeagues:          999,
  stravaConnected:     true,
  customChallenges:    true,
};

// ── Hook ─────────────────────────────────────────────────────
export function usePremium() {
  const { profile } = useAuth();
  const [premium, setPremium]   = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    init();
  }, [profile?.id]);

  async function init() {
    await setupRevenueCat(profile!.id);
    const status = await isPremium();
    setPremium(status);
    setLoading(false);
  }

  async function refresh() {
    const status = await isPremium();
    setPremium(status);
    return status;
  }

  const limits = premium ? PREMIUM_LIMITS : FREE_LIMITS;

  function canCreateLeague(currentCount: number): boolean {
    return currentCount < limits.maxLeagues;
  }

  function canUseStrava(): boolean {
    return limits.stravaConnected;
  }

  function canUseCustomChallenges(): boolean {
    return limits.customChallenges;
  }

  return {
    premium,
    loading,
    limits,
    refresh,
    canCreateLeague,
    canUseStrava,
    canUseCustomChallenges,
  };
}
