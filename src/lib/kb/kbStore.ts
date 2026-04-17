import { create } from 'zustand';
import { fetchCategories, fetchSuppliers } from './kbApi';
import type { KbCategory, KbSupplier } from './kbTypes';

const CACHE_DURATION = 5 * 60 * 1000;

interface KbStore {
  categories: KbCategory[];
  suppliers: KbSupplier[];
  isLoaded: boolean;
  isLoading: boolean;
  lastFetch: number;
  fetchTaxonomy: () => Promise<void>;
  invalidate: () => void;
}

let pendingFetch: Promise<void> | null = null;

export const useKbStore = create<KbStore>((set, get) => ({
  categories: [],
  suppliers: [],
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
        const [categories, suppliers] = await Promise.all([
          fetchCategories(),
          fetchSuppliers(),
        ]);
        set({
          categories,
          suppliers,
          isLoaded: true,
          isLoading: false,
          lastFetch: Date.now(),
        });
      } catch (err) {
        console.error('[kbStore] fetchTaxonomy failed', err);
        set({ isLoading: false });
      } finally {
        pendingFetch = null;
      }
    })();

    return pendingFetch;
  },

  invalidate: () => set({ isLoaded: false, lastFetch: 0 }),
}));
