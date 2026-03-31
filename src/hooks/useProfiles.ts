import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export function useProfiles(currentUserId?: string) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    async function fetchProfiles() {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId)
        .order('username', { ascending: true });

      if (error) {
        console.log('useProfiles error', error);
        setProfiles([]);
      } else {
        setProfiles((data as Profile[]) ?? []);
      }

      setLoading(false);
    }

    fetchProfiles();
  }, [currentUserId]);

  return { profiles, loading };
}