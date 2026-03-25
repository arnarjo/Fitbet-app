// src/screens/auth/OnboardingScreen.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width, height } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const slides = [
  {
    id: '1',
    emoji: '⚽',
    title: 'Veðjaðu við vini',
    subtitle: 'Spáðu fyrir um niðurstöður leikja í Premier League, Bestu deild og Champions League.',
    accent: '#00e5a0',
  },
  {
    id: '2',
    emoji: '💪',
    title: 'Tapi = Þjálfun',
    subtitle: 'Enginn peningur á í leik. Sá sem tapar þarf að klára líkamsþjálfunaráskorun.',
    accent: '#3d8bff',
  },
  {
    id: '3',
    emoji: '🏆',
    title: 'Safnaðu stigum',
    subtitle: 'Kepptu við vini og vinnufélaga. Vertu efst á stigatöflunni í hópi þínum.',
    accent: '#ffc940',
  },
  {
    id: '4',
    emoji: '📸',
    title: 'Sannaðu þig',
    subtitle: 'Hlaðu upp mynd eða myndskeiði sem sönnun. Vinurinn staðfestir. Einfalt og skemmtilegt.',
    accent: '#ff4a6e',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  function goNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.navigate('Signup');
    }
  }

  function skip() {
    navigation.navigate('Login');
  }

  const currentAccent = slides[currentIndex]?.accent ?? '#00e5a0';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

      {/* Skip button */}
      <View style={s.topBar}>
        <View />
        <TouchableOpacity onPress={skip}>
          <Text style={s.skipText}>Sleppa</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
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
            {/* Big emoji circle */}
            <View style={[s.emojiCircle, { borderColor: item.accent + '40', backgroundColor: item.accent + '15' }]}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>

            {/* Decorative line */}
            <View style={[s.accentLine, { backgroundColor: item.accent }]} />

            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={s.dotsRow}>
        {slides.map((_, i) => {
          const isActive = i === currentIndex;
          return (
            <View
              key={i}
              style={[
                s.dot,
                isActive
                  ? { width: 24, backgroundColor: currentAccent }
                  : { width: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            />
          );
        })}
      </View>

      {/* CTA */}
      <View style={s.bottomArea}>
        <TouchableOpacity
          style={[s.nextBtn, { backgroundColor: currentAccent }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={s.nextBtnText}>
            {currentIndex === slides.length - 1 ? 'Búa til aðgang 🚀' : 'Áfram →'}
          </Text>
        </TouchableOpacity>

        {currentIndex === slides.length - 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkText}>Á nú aðgangi? Skráðu þig inn</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipText: {
    color: '#5a5a72',
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  emoji: {
    fontSize: 64,
  },
  accentLine: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f0f0f8',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#9090aa',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
    gap: 12,
  },
  nextBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  loginLinkText: {
    color: '#5a5a72',
    fontSize: 14,
    fontWeight: '500',
  },
});
