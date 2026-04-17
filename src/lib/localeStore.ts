import { create } from 'zustand';

export type Locale = 'es' | 'en';

const STORAGE_KEY = 'evita-locale';

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'es';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
}

export const useLocaleStore = create<LocaleStore>((set, get) => ({
  locale: readStoredLocale(),
  setLocale: (l: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    set({ locale: l });
  },
  toggle: () => {
    const next: Locale = get().locale === 'es' ? 'en' : 'es';
    get().setLocale(next);
  },
}));

/**
 * Pick the localized value for a key on a row. Falls back to the Spanish
 * canonical column when the English overlay is missing or empty.
 *
 * Usage:
 *   pickText(entry, 'title', locale)
 *   → entry.title_en if locale === 'en' and non-empty, else entry.title
 */
export function pickText(
  obj: unknown,
  key: string,
  locale: Locale,
): string {
  if (!obj || typeof obj !== 'object') return '';
  const record = obj as Record<string, unknown>;
  if (locale === 'en') {
    const enVal = record[`${key}_en`];
    if (typeof enVal === 'string' && enVal.trim().length > 0) return enVal;
  }
  const esVal = record[key];
  return typeof esVal === 'string' ? esVal : esVal == null ? '' : String(esVal);
}
