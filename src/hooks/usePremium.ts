// src/hooks/usePremium.ts
// Hook to check and manage premium status throughout the app

import { useState, useEffect } from 'react';
import { isPremium } from '../lib/revenuecat';
import { useAuth } from './useAuth';

// ── League gating ────────────────────────────────────────────
export const FREE_LEAGUES = [
  'Premier League',
  'Besta deild karla',
  'Lengjudeild karla',
];

export const PREMIUM_LEAGUES = [
  'UEFA Champions League',
  'FIFA World Cup',
  '2. deild karla',
];

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

const TESTING_PREMIUM = false;

// ── Hook ─────────────────────────────────────────────────────
export function usePremium() {
  const { profile } = useAuth();
  const [premium, setPremium]   = useState(TESTING_PREMIUM);
  const [loading, setLoading]   = useState(!TESTING_PREMIUM);

  useEffect(() => {
    if (TESTING_PREMIUM || !profile?.id) return;
    init();
  }, [profile?.id]);

  async function init() {
    const status = await isPremium();
    setPremium(status);
    setLoading(false);
  }

  async function refresh() {
    const status = await isPremium();
    setPremium(status);
    return status;
  }

  const isAdmin = profile?.is_admin === true;
  const limits = (premium || isAdmin) ? PREMIUM_LIMITS : FREE_LIMITS;

  function canCreateLeague(currentCount: number): boolean {
    return currentCount < limits.maxLeagues;
  }

  function canUseStrava(): boolean {
    return limits.stravaConnected;
  }

  function canUseCustomChallenges(): boolean {
    return limits.customChallenges;
  }

  function canAccessLeague(leagueName: string): boolean {
    if (premium || isAdmin) return true;
    return FREE_LEAGUES.includes(leagueName);
  }

  return {
    premium,
    loading,
    limits,
    refresh,
    canCreateLeague,
    canUseStrava,
    canUseCustomChallenges,
    canAccessLeague,
  };
}
