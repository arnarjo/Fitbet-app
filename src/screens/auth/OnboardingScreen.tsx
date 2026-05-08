// src/screens/auth/OnboardingScreen.tsx
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  FlatList, Animated, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLanguage } from '../../hooks/useLanguage';

const { width } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<any> };

export default function OnboardingScreen({ navigation }: Props) {
  const { t, lang, setLang } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const slides = [
    { id: '1', emoji: '⚽', title: t('onb_slide1_title'), subtitle: t('onb_slide1_subtitle'), accent: '#21A56A' },
    { id: '2', emoji: '💪', title: t('onb_slide2_title'), subtitle: t('onb_slide2_subtitle'), accent: '#47C4EE' },
    { id: '3', emoji: '🏆', title: t('onb_slide3_title'), subtitle: t('onb_slide3_subtitle'), accent: '#FFC845' },
    { id: '4', emoji: '📸', title: t('onb_slide4_title'), subtitle: t('onb_slide4_subtitle'), accent: '#ff4a6e' },
  ];

  function goNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.navigate('Signup');
    }
  }

  const currentAccent = slides[currentIndex]?.accent ?? '#21A56A';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#071D2A" />

      <View style={s.topBar}>
        {/* Language toggle */}
        <TouchableOpacity style={s.langToggle} onPress={() => setLang(lang === 'en' ? 'is' : 'en')}>
          <Text style={s.langText}>{lang === 'en' ? '🇮🇸 IS' : '🇬🇧 EN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={s.skipText}>{t('onb_skip')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        renderItem={({ item }) => (
          <View style={s.slide}>
            <View style={[s.emojiCircle, { borderColor: item.accent + '40', backgroundColor: item.accent + '15' }]}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>
            <View style={[s.accentLine, { backgroundColor: item.accent }]} />
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={s.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === currentIndex
                ? { width: 24, backgroundColor: currentAccent }
                : { width: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
            ]}
          />
        ))}
      </View>

      <View style={s.bottomArea}>
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: currentAccent }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.nextBtnText}>
            {currentIndex === slides.length - 1 ? t('onb_create_account') : t('onb_next')}
          </Text>
        </TouchableOpacity>

        {currentIndex === slides.length - 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkText}>{t('onb_have_account')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#071D2A' },
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  langToggle:  { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  langText:    { color: '#eef4f8', fontSize: 13, fontWeight: '700' },
  skipText:    { color: '#4a6878', fontSize: 14, fontWeight: '600' },
  slide:       { width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emojiCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  emoji:       { fontSize: 64 },
  accentLine:  { width: 40, height: 3, borderRadius: 2, marginBottom: 20 },
  title:       { fontSize: 32, fontWeight: '800', color: '#eef4f8', textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 },
  subtitle:    { fontSize: 16, color: '#7a9aaa', textAlign: 'center', lineHeight: 24 },
  dotsRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 20 },
  dot:         { height: 8, borderRadius: 4 },
  bottomArea:  { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 32, gap: 12 },
  nextBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  loginLink:   { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { color: '#4a6878', fontSize: 14, fontWeight: '500' },
});
