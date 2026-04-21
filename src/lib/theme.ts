export type ThemePreference = 'light' | 'midnight' | 'system';
export type ResolvedTheme = 'light' | 'midnight';

export const THEME_STORAGE_KEY = 'evita:theme';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'midnight' || value === 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'midnight' : 'light';
  }
  return preference;
}

export function readStoredPreference(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  if (!storage) return 'system';
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredPreference(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  preference: ThemePreference,
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // localStorage may be disabled (private mode, quota, etc.) — silently fall back.
  }
}
