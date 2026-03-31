import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigate } from '../navigation/navigationRef';

const TAB_BAR_HEIGHT = 60;

export default function FloatingChallengeButton() {
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      style={[s.fab, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}
      onPress={() => navigate('Main', { screen: 'Leikir' })}
      activeOpacity={0.9}
    >
      <Text style={s.fabText}>Veðja á leik</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    minWidth: 160,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: '#00e5a0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 18,
  },
});