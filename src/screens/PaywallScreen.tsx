// src/screens/PaywallScreen.tsx
// FitBet Premium subscription screen
// Shows when user tries to access premium feature

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Animated, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  getOfferings, purchasePremium, restorePurchases,
  type PurchasesOffering,
} from '../lib/revenuecat';
import { usePremium } from '../hooks/usePremium';

type Props = {
  feature?: 'leagues' | 'strava' | 'challenges' | 'general';
  onSuccess?: () => void;
  onClose?: () => void;
};

const FEATURE_MESSAGES: Record<string, { title: string; desc: string; emoji: string }> = {
  leagues:    { emoji: '🏅', title: 'Ótakmarkaðar deildir',   desc: 'Búðu til eins margar deildir og þú vilt' },
  strava:     { emoji: '⚡', title: 'Strava tenging',          desc: 'Staðfestu áskoranir sjálfkrafa' },
  challenges: { emoji: '💪', title: 'Sérsniðnar áskoranir',   desc: 'Búðu til eigin áskoranir' },
  general:    { emoji: '🏆', title: 'FitBet Premium',          desc: 'Fáðu allt það besta' },
};

const PREMIUM_FEATURES = [
  { emoji: '🏅', title: 'Ótakmarkaðar deildir',  desc: 'Búðu til eins margar og þú vilt (ókeypis: 2)' },
  { emoji: '⚡', title: 'Strava tenging',          desc: 'Hlaup og hjólreiðar staðfest sjálfkrafa' },
  { emoji: '💪', title: 'Sérsniðnar áskoranir',   desc: 'Veldu hvaða æfingu sem er, hvaða magn' },
  { emoji: '🎯', title: 'Ótakmörkuð veðmál',      desc: 'Engar takmarkanir á fjölda veðmála' },
  { emoji: '📊', title: 'Ítarleg tölfræði',        desc: 'Sjáðu nákvæma greiningu á sigrum og töpum' },
];

export default function PaywallScreen({ feature = 'general', onSuccess, onClose }: Props) {
  const navigation = useNavigation<any>();
  const { refresh } = usePremium();

  const [offering, setOffering]   = useState<PurchasesOffering | null>(null);
  const [loading, setLoading]     = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const featureMsg = FEATURE_MESSAGES[feature];

  useEffect(() => {
    fetchOffering();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 160 }),
    ]).start();
  }, []);

  async function fetchOffering() {
    const o = await getOfferings();
    setOffering(o);
    setLoading(false);
  }

  async function handlePurchase() {
    setPurchasing(true);
    const { success, error } = await purchasePremium();
    setPurchasing(false);

    if (success) {
      await refresh();
      Alert.alert(
        'Velkominn í Premium! 🏆',
        'Þú hefur nú aðgang að öllum Premium eiginleikum FitBet.',
        [{ text: 'Frábært!', onPress: () => { onSuccess?.(); navigation.goBack(); } }]
      );
    } else if (error !== 'cancelled') {
      Alert.alert('Villa', 'Ekki tókst að ljúka kaupum. Reyndu aftur.');
    }
  }

  async function handleRestore() {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);

    if (restored) {
      await refresh();
      Alert.alert('Endurheimt! ✅', 'Premium áskrift þín hefur verið endurheimtt.',
        [{ text: 'Í lagi', onPress: () => { onSuccess?.(); navigation.goBack(); } }]
      );
    } else {
      Alert.alert('Engin áskrift fundust', 'Við fundum engar fyrri kaup tengd þessum reikningi.');
    }
  }

  const price = offering?.availablePackages[0]?.product?.priceString ?? '$8.99';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Close button */}
      <TouchableOpacity
        style={s.closeBtn}
        onPress={() => { onClose?.(); navigation.goBack(); }}
      >
        <Text style={s.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hero */}
          <View style={s.hero}>
            <View style={s.crownWrap}>
              <Text style={s.crown}>👑</Text>
            </View>
            <Text style={s.heroTitle}>FitBet Premium</Text>
            <Text style={s.heroSub}>
              {feature !== 'general'
                ? `Þú þarft Premium til að nota ${featureMsg.title}`
                : 'Fáðu allt það besta úr FitBet'
              }
            </Text>
          </View>

          {/* Feature highlight (if specific feature) */}
          {feature !== 'general' && (
            <View style={s.featureHighlight}>
              <Text style={s.featureHighlightEmoji}>{featureMsg.emoji}</Text>
              <View style={s.featureHighlightText}>
                <Text style={s.featureHighlightTitle}>{featureMsg.title}</Text>
                <Text style={s.featureHighlightDesc}>{featureMsg.desc}</Text>
              </View>
            </View>
          )}

          {/* Features list */}
          <Text style={s.featuresLabel}>PREMIUM INNIHELDUR</Text>
          <View style={s.featuresCard}>
            {PREMIUM_FEATURES.map((f, i) => (
              <View key={i} style={[s.featureRow, i === PREMIUM_FEATURES.length - 1 && s.featureRowLast]}>
                <View style={s.featureIconWrap}>
                  <Text style={s.featureIcon}>{f.emoji}</Text>
                </View>
                <View style={s.featureInfo}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
                <Text style={s.featureCheck}>✓</Text>
              </View>
            ))}
          </View>

          {/* Free vs Premium comparison */}
          <View style={s.comparisonCard}>
            <View style={s.comparisonRow}>
              <Text style={s.comparisonLabel}></Text>
              <Text style={s.comparisonFree}>Ókeypis</Text>
              <Text style={s.comparisonPrem}>Premium</Text>
            </View>
            {[
              { label: 'Deildir',        free: '2',    prem: '∞' },
              { label: 'Strava',         free: '✕',    prem: '✓' },
              { label: 'Sérsniðið',      free: '✕',    prem: '✓' },
              { label: 'Tölfræði',       free: 'Grunn', prem: 'Ítarleg' },
            ].map((row, i) => (
              <View key={i} style={s.comparisonRow}>
                <Text style={s.comparisonLabel}>{row.label}</Text>
                <Text style={[s.comparisonFree, row.free === '✕' && { color: '#ff4a6e' }]}>
                  {row.free}
                </Text>
                <Text style={[s.comparisonPrem, { color: '#ffc940', fontWeight: '800' }]}>
                  {row.prem}
                </Text>
              </View>
            ))}
          </View>

          {/* Price + CTA */}
          <View style={s.priceWrap}>
            <View style={s.priceRow}>
              {loading
                ? <ActivityIndicator color="#ffc940" />
                : <>
                    <Text style={s.priceAmount}>{price}</Text>
                    <Text style={s.pricePeriod}> / mánuð</Text>
                  </>
              }
            </View>
            <Text style={s.priceSub}>Hægt að segja upp hvenær sem er</Text>
          </View>

          <TouchableOpacity
            style={[s.purchaseBtn, purchasing && s.purchaseBtnDisabled]}
            onPress={handlePurchase}
            disabled={purchasing || loading}
            activeOpacity={0.85}
          >
            {purchasing
              ? <ActivityIndicator color="#000" />
              : <>
                  <Text style={s.purchaseBtnText}>Fá Premium — {price}/mán 👑</Text>
                </>
            }
          </TouchableOpacity>

          {/* Restore + legal */}
          <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
            {restoring
              ? <ActivityIndicator color="#9090aa" size="small" />
              : <Text style={s.restoreBtnText}>Endurheimta fyrri kaup</Text>
            }
          </TouchableOpacity>

          <Text style={s.legal}>
            Áskrift er endurnýjuð sjálfkrafa um {price} á mánuði nema hún sé sagt upp minnst 24 klukkustundum fyrir lok núverandi tímabils. Hægt er að stjórna áskrift og slökkva á sjálfvirkri endurnýjun í reikningsstillingum eftir kaup.{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://fitbet.is/privacy')}>
              Persónuvernd
            </Text>
            {' · '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://fitbet.is/terms')}>
              Skilmálar
            </Text>
          </Text>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0f' },
  closeBtn:    {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#9090aa', fontSize: 14, fontWeight: '700' },
  scroll:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Hero
  hero:        { alignItems: 'center', paddingTop: 24, paddingBottom: 28 },
  crownWrap:   {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,201,64,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,201,64,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  crown:       { fontSize: 36 },
  heroTitle:   { fontSize: 28, fontWeight: '900', color: '#f0f0f8', marginBottom: 8 },
  heroSub:     { fontSize: 14, color: '#9090aa', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Feature highlight
  featureHighlight: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,201,64,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,201,64,0.2)',
    borderRadius: 14, padding: 16, marginBottom: 20,
  },
  featureHighlightEmoji: { fontSize: 28 },
  featureHighlightText:  { flex: 1 },
  featureHighlightTitle: { fontSize: 15, fontWeight: '800', color: '#f0f0f8' },
  featureHighlightDesc:  { fontSize: 12, color: '#9090aa', marginTop: 2 },

  // Features
  featuresLabel: {
    fontSize: 10, fontWeight: '700', color: '#5a5a72',
    letterSpacing: 1.5, marginBottom: 10,
  },
  featuresCard: {
    backgroundColor: '#1a1a24', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  featureRowLast:  { borderBottomWidth: 0 },
  featureIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,201,64,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureIcon:  { fontSize: 18 },
  featureInfo:  { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: '#f0f0f8' },
  featureDesc:  { fontSize: 11, color: '#5a5a72', marginTop: 2 },
  featureCheck: { fontSize: 14, color: '#00e5a0', fontWeight: '800' },

  // Comparison
  comparisonCard: {
    backgroundColor: '#1a1a24', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', marginBottom: 20,
  },
  comparisonRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  comparisonLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#9090aa' },
  comparisonFree:  { width: 60, textAlign: 'center', fontSize: 13, color: '#5a5a72', fontWeight: '600' },
  comparisonPrem:  { width: 70, textAlign: 'center', fontSize: 13, color: '#ffc940', fontWeight: '700' },

  // Price
  priceWrap:   { alignItems: 'center', marginBottom: 16 },
  priceRow:    { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontSize: 40, fontWeight: '900', color: '#ffc940' },
  pricePeriod: { fontSize: 16, color: '#9090aa', fontWeight: '600' },
  priceSub:    { fontSize: 12, color: '#5a5a72', marginTop: 4 },

  // Purchase button
  purchaseBtn: {
    backgroundColor: '#ffc940', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  purchaseBtnDisabled: { opacity: 0.6 },
  purchaseBtnText:     { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 0.3 },

  // Restore
  restoreBtn:     { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  restoreBtnText: { fontSize: 13, color: '#5a5a72', fontWeight: '600' },

  // Legal
  legal:     { fontSize: 11, color: '#3a3a52', textAlign: 'center', lineHeight: 17 },
  legalLink: { color: '#5a5a72', textDecorationLine: 'underline' },
});
