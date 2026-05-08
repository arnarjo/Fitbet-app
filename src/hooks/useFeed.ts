// src/hooks/useFeed.ts
// Realtime activity feed hook — combines personal notifications
// with friends' public activity into a single sorted stream

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type FeedEvent = {
  id: string;
  userId: string;
  actorName: string;
  actorUsername: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read: boolean;
  isMe: boolean;
  createdAt: string;
};

export function useFeed(currentUserId: string) {
  const [events, setEvents]         = useState<FeedEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [unreadCount, setUnread]    = useState(0);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!currentUserId) return;
    fetchFeed();
    subscribeRealtime();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [currentUserId]);

  async function fetchFeed() {
    setLoading(true);

    // 1. My own notifications
    const { data: myNotifs } = await supabase
      .from('notifications')
      .select('*, profile:profiles!user_id(id, username, full_name)')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(25);

    // 2. Friends' public activity (won/lost/challenge done)
    const { data: friendIds } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

    const friendList = (friendIds ?? []).map((f: any) =>
      f.requester_id === currentUserId ? f.addressee_id : f.requester_id
    );

    let friendEvents: FeedEvent[] = [];
    if (friendList.length > 0) {
      const { data: friendNotifs } = await supabase
        .from('notifications')
        .select('*, profile:profiles!user_id(id, username, full_name)')
        .in('user_id', friendList)
        .in('type', ['bet_won', 'bet_lost', 'challenge_approved', 'challenge_submitted'])
        .order('created_at', { ascending: false })
        .limit(20);

      friendEvents = (friendNotifs ?? []).map((n: any) => mapNotif(n, false));
    }

    const myEvents = (myNotifs ?? []).map((n: any) => mapNotif(n, true));

    // Merge and sort by time
    const merged = [...myEvents, ...friendEvents]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = merged.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });

    setEvents(unique);
    setUnread(myEvents.filter(e => !e.read).length);
    setLoading(false);
  }

  function subscribeRealtime() {
    channelRef.current = supabase
      .channel(`feed_${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUserId}`,
      }, (payload) => {
        // Optimistically prepend new event
        const newEvent = mapRawNotif(payload.new as any, true);
        setEvents(prev => [newEvent, ...prev].slice(0, 30));
        setUnread(prev => prev + 1);
      })
      .subscribe();
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUserId)
      .eq('read', false);
    setEvents(prev => prev.map(e => ({ ...e, read: true })));
    setUnread(0);
  }

  async function markRead(notifId: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', notifId);
    setEvents(prev => prev.map(e => e.id === notifId ? { ...e, read: true } : e));
    setUnread(prev => Math.max(0, prev - 1));
  }

  const refetch = useCallback(() => fetchFeed(), [currentUserId]);

  return { events, loading, unreadCount, markAllRead, markRead, refetch };
}

// ── Helpers ──────────────────────────────────────────────────
function mapNotif(n: any, isMe: boolean): FeedEvent {
  return {
    id:            n.id,
    userId:        n.user_id,
    actorName:     n.profile?.full_name  ?? n.profile?.username ?? 'Notandi',
    actorUsername: n.profile?.username   ?? '',
    type:          n.type,
    title:         n.title,
    body:          n.body,
    data:          n.data,
    read:          n.read,
    isMe,
    createdAt:     n.created_at,
  };
}

function mapRawNotif(n: any, isMe: boolean): FeedEvent {
  return {
    id:            n.id,
    userId:        n.user_id,
    actorName:     'Þú',
    actorUsername: '',
    type:          n.type,
    title:         n.title,
    body:          n.body,
    data:          n.data,
    read:          false,
    isMe,
    createdAt:     n.created_at,
  };
}


// ── Feed event message builder (Icelandic) ───────────────────
export function buildFeedMessage(event: FeedEvent, myName: string): {
  actor: string;
  message: string;
  color: string;
  emoji: string;
} {
  const actor = event.isMe ? 'Þú' : event.actorName;

  const map: Record<string, { message: string; color: string; emoji: string }> = {
    bet_won:             { message: 'vannst veðmál',            color: '#00e5a0', emoji: '🏆' },
    bet_lost:            { message: 'tapaðir veðmáli',          color: '#ff4a6e', emoji: '😅' },
    bet_received:        { message: 'fékk nýja veðmálsbeiðni', color: '#ffc940', emoji: '🎯' },
    bet_accepted:        { message: 'samþykkti veðmál',         color: '#3d8bff', emoji: '✅' },
    bet_declined:        { message: 'hafnaði veðmáli',          color: '#9090aa', emoji: '❌' },
    challenge_assigned:  { message: 'þarft að klára áskorun',  color: '#ff4a6e', emoji: '💪' },
    challenge_submitted: { message: 'sendi sönnun',             color: '#ffc940', emoji: '📸' },
    challenge_approved:  { message: 'kláraði áskorun',         color: '#00e5a0', emoji: '✓' },
    challenge_rejected:  { message: 'sönnun var hafnað',        color: '#9090aa', emoji: '🔄' },
    friend_request:      { message: 'sendi þér vinarbeiðni',   color: '#a855f7', emoji: '👋' },
    friend_accepted:     { message: 'er nú vinur þinn',        color: '#00e5a0', emoji: '🤝' },
  };

  const cfg = map[event.type] ?? { message: event.body, color: '#9090aa', emoji: '📣' };
  return { actor, ...cfg };
}
