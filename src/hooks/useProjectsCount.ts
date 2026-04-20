import { useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const CACHE_TTL_MS = 60_000;

interface CountStore {
  count: number | null;
  lastFetched: number;
  fetching: boolean;
  refresh: () => Promise<void>;
}

const useStore = create<CountStore>((set, get) => ({
  count: null,
  lastFetched: 0,
  fetching: false,
  refresh: async () => {
    if (get().fetching) return;
    set({ fetching: true });
    try {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      set({ count: count ?? 0, lastFetched: Date.now(), fetching: false });
    } catch {
      set({ fetching: false });
    }
  },
}));

export function useProjectsCount(): number | null {
  const count = useStore((s) => s.count);
  const lastFetched = useStore((s) => s.lastFetched);
  const refresh = useStore((s) => s.refresh);
  useEffect(() => {
    if (Date.now() - lastFetched > CACHE_TTL_MS) {
      void refresh();
    }
  }, [lastFetched, refresh]);
  return count;
}
