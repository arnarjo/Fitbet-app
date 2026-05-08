// src/lib/revenuecat.ts
// RevenueCat integration for FitBet Freemium
// Install: npx expo install react-native-purchases

import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  LOG_LEVEL,
} from 'react-native-purchases';

export type { PurchasesOffering };
import { Platform } from 'react-native';

const RC_API_KEY_IOS     = process.env.EXPO_PUBLIC_RC_IOS_KEY!;
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_ANDROID_KEY!;

export const ENTITLEMENT_PREMIUM = 'Fitbet Pro';
export const PRODUCT_MONTHLY     = 'fitbet_premium_monthly:monthly';
export const PRODUCT_YEARLY      = 'fitbet_premium_monthly:yearly';

// ── Setup ────────────────────────────────────────────────────
export async function setupRevenueCat(userId: string) {
  Purchases.setLogLevel(LOG_LEVEL.WARN);

  await Purchases.configure({
    apiKey: Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID,
    appUserID: userId,
  });
}

// ── Check premium status ─────────────────────────────────────
export async function isPremium(): Promise<boolean> {
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}

// ── Get offerings ────────────────────────────────────────────
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

// ── Purchase ─────────────────────────────────────────────────
export async function purchasePremium(): Promise<{ success: boolean; error?: string }> {
  try {
    const offering = await getOfferings();
    const pkg = offering?.availablePackages[0];
    if (!pkg) return { success: false, error: 'no_package' };

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = customerInfo.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
    return { success: active };
  } catch (e: any) {
    if (e.userCancelled) return { success: false, error: 'cancelled' };
    return { success: false, error: e.message };
  }
}

// ── Restore purchases ────────────────────────────────────────
export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_PREMIUM] !== undefined;
  } catch {
    return false;
  }
}
