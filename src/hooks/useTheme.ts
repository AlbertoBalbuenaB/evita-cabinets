import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

/**
 * Theme hook: reads/writes `evita:theme` in localStorage, subscribes to
 * `matchMedia` while in `'system'` mode, and applies `data-theme` to the
 * <html> element. The <head> script in index.html sets the attribute
 * pre-paint to avoid FOUC; this hook keeps it in sync after hydration
 * and exposes the three-way preference plus its resolved value.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system';
    return readStoredPreference(window.localStorage);
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => systemPrefersDark());

  const resolved: ResolvedTheme = useMemo(
    () => resolveTheme(preference, systemDark),
    [preference, systemDark],
  );

  // Keep <html data-theme> in sync.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  // Enable blanket color transitions only after first paint — avoids a
  // 300ms fade on initial load. index.css gates transitions on .theme-ready.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = window.setTimeout(() => {
      document.documentElement.classList.add('theme-ready');
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  // Listen to OS preference changes — only relevant while user picked 'system',
  // but we keep the subscription live so `resolved` flips instantly if they
  // toggle back to 'system' later.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(DARK_QUERY);
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // Safari <14 fallback
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    if (!isThemePreference(next)) return;
    setPreference(next);
    if (typeof window !== 'undefined') {
      writeStoredPreference(window.localStorage, next);
    }
  }, []);

  return { theme: preference, resolved, setTheme } as const;
}
