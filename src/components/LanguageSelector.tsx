// src/components/LanguageSelector.tsx
// Language switcher component — used in ProfileScreen settings

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useLanguage, type Language } from '../lib/i18n';

const LANGUAGES: { code: Language; label: string; flag: string; native: string }[] = [
  { code: 'is', label: 'Icelandic', flag: '🇮🇸', native: 'Íslenska' },
  { code: 'en', label: 'English',   flag: '🇬🇧', native: 'English'  },
];

export default function LanguageSelector() {
  const { lang, setLanguage } = useLanguage();

  return (
    <View style={s.container}>
      {LANGUAGES.map(l => {
        const isActive = lang === l.code;
        return (
          <TouchableOpacity
            key={l.code}
            style={[s.option, isActive && s.optionActive]}
            onPress={() => setLanguage(l.code)}
            activeOpacity={0.8}
          >
            <Text style={s.flag}>{l.flag}</Text>
            <View style={s.info}>
              <Text style={[s.native, isActive && s.nativeActive]}>{l.native}</Text>
              <Text style={s.label}>{l.label}</Text>
            </View>
            {isActive && (
              <View style={s.checkmark}>
                <Text style={s.checkmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1a1a24',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
  },
  optionActive: {
    borderColor: '#00e5a0',
    backgroundColor: 'rgba(0,229,160,0.07)',
  },
  flag:   { fontSize: 28 },
  info:   { flex: 1 },
  native: { fontSize: 15, fontWeight: '700', color: '#f0f0f8' },
  nativeActive: { color: '#00e5a0' },
  label:  { fontSize: 12, color: '#5a5a72', marginTop: 2 },
  checkmark: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#00e5a0',
    alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { fontSize: 12, fontWeight: '800', color: '#000' },
});
