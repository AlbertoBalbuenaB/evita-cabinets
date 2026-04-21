import { create } from 'zustand';

export type TotalMode = 'USD' | 'MXN' | 'Both';

const STORAGE_KEY = 'evita:quote:totalMode';

function readStoredTotalMode(): TotalMode {
  if (typeof window === 'undefined') return 'MXN';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'USD' || raw === 'MXN' || raw === 'Both') return raw;
    return 'MXN';
  } catch {
    return 'MXN';
  }
}

function writeStoredTotalMode(mode: TotalMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

interface QuotationUiStore {
  totalMode: TotalMode;
  setTotalMode: (mode: TotalMode) => void;
}

export const useQuotationUiStore = create<QuotationUiStore>((set) => ({
  totalMode: readStoredTotalMode(),
  setTotalMode: (mode) => {
    writeStoredTotalMode(mode);
    set({ totalMode: mode });
  },
}));
