import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

const EMOJIS = ['🏆', '😅', '🔥', '💪', '😂', '👏', '😤', '🫡'];

type Reaction = { id: string; emoji: string; user_id: string };

type Props = {
  betId: string;
  userId: string;
};

export default function BetReactions({ betId, userId }: Props) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchReactions();
    const channel = supabase
      .channel(`reactions_${betId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_reactions', filter: `bet_id=eq.${betId}` },
        () => fetchReactions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [betId]);

  async function fetchReactions() {
    const { data } = await supabase
      .from('bet_reactions')
      .select('id, emoji, user_id')
      .eq('bet_id', betId);
    setReactions(data ?? []);
  }

  async function toggleReaction(emoji: string) {
    const existing = reactions.find(r => r.user_id === userId && r.emoji === emoji);
    if (existing) {
      await supabase.from('bet_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('bet_reactions').insert({ bet_id: betId, user_id: userId, emoji });
    }
    setShowPicker(false);
    fetchReactions();
  }

  // Group by emoji
  const grouped = EMOJIS.map(emoji => ({
    emoji,
    count: reactions.filter(r => r.emoji === emoji).length,
    mine:  reactions.some(r => r.emoji === emoji && r.user_id === userId),
  })).filter(g => g.count > 0);

  return (
    <View style={s.wrap}>
      <View style={s.reactionsRow}>
        {grouped.map(g => (
          <TouchableOpacity
            key={g.emoji}
            style={[s.reactionChip, g.mine && s.reactionChipMine]}
            onPress={() => toggleReaction(g.emoji)}
          >
            <Text style={s.reactionEmoji}>{g.emoji}</Text>
            {g.count > 1 && <Text style={[s.reactionCount, g.mine && { color: '#000' }]}>{g.count}</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.addBtn} onPress={() => setShowPicker(p => !p)}>
          <Text style={s.addBtnText}>{showPicker ? '✕' : '＋'}</Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <View style={s.picker}>
          {EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} style={s.pickerItem} onPress={() => toggleReaction(emoji)}>
              <Text style={s.pickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:             { marginTop: 8 },
  reactionsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  reactionChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  reactionChipMine: { backgroundColor: '#21A56A' },
  reactionEmoji:    { fontSize: 16 },
  reactionCount:    { fontSize: 12, color: '#b0c4d0', fontWeight: '700' },
  addBtn:           { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBtnText:       { color: '#4a6878', fontSize: 16, fontWeight: '700' },
  picker:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, backgroundColor: '#0d2030', borderRadius: 14, padding: 10 },
  pickerItem:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pickerEmoji:      { fontSize: 24 },
});
