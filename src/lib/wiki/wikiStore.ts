import { create } from 'zustand';
import { fetchWikiCategories } from './wikiApi';
import type { WikiCategory } from './wikiTypes';

const CACHE_DURATION = 5 * 60 * 1000;

interface WikiStore {
  categories: WikiCategory[];
  isLoaded: boolean;
  isLoading: boolean;
  lastFetch: number;
  fetchTaxonomy: () => Promise<void>;
  invalidate: () => void;
}

let pendingFetch: Promise<void> | null = null;

export const useWikiStore = create<WikiStore>((set, get) => ({
  categories: [],
  isLoaded: false,
  isLoading: false,
  lastFetch: 0,

  fetchTaxonomy: async () => {
    const { lastFetch, isLoaded } = get();
    const now = Date.now();
    if (isLoaded && now - lastFetch < CACHE_DURATION) return;
    if (pendingFetch) return pendingFetch;

    pendingFetch = (async () => {
      set({ isLoading: true });
      try {
        const categories = await fetchWikiCategories();
        set({ categories, isLoaded: true, isLoading: false, lastFetch: Date.now() });
      } catch (err) {
        console.error('[wikiStore] fetchTaxonomy failed', err);
        set({ isLoading: false });
      } finally {
        pendingFetch = null;
      }
    })();

    return pendingFetch;
  },

  invalidate: () => set({ isLoaded: false, lastFetch: 0 }),
}));
