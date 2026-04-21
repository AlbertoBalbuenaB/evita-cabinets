import { describe, it, expect } from 'vitest';
import {
  isThemePreference,
  readStoredPreference,
  resolveTheme,
  writeStoredPreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme';

describe('isThemePreference', () => {
  it('accepts the three valid values', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('midnight')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isThemePreference('dark')).toBe(false);
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(0)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('returns explicit preference when not system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('midnight', true)).toBe('midnight');
    expect(resolveTheme('midnight', false)).toBe('midnight');
  });

  it('follows system preference when set to system', () => {
    expect(resolveTheme('system', true)).toBe('midnight');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

function makeMemoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    snapshot: () => Object.fromEntries(store),
  };
}

describe('readStoredPreference', () => {
  it('returns stored valid value', () => {
    const s = makeMemoryStorage({ [THEME_STORAGE_KEY]: 'midnight' });
    expect(readStoredPreference(s)).toBe('midnight');
  });

  it('falls back to system when value missing', () => {
    const s = makeMemoryStorage();
    expect(readStoredPreference(s)).toBe('system');
  });

  it('falls back to system when value is malformed', () => {
    const s = makeMemoryStorage({ [THEME_STORAGE_KEY]: 'dark' });
    expect(readStoredPreference(s)).toBe('system');
  });

  it('falls back to system when storage is null', () => {
    expect(readStoredPreference(null)).toBe('system');
  });

  it('falls back to system when getItem throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('quota');
      },
    };
    expect(readStoredPreference(throwing)).toBe('system');
  });
});

describe('writeStoredPreference', () => {
  it('persists each preference value', () => {
    const s = makeMemoryStorage();
    const values: ThemePreference[] = ['light', 'midnight', 'system'];
    for (const v of values) {
      writeStoredPreference(s, v);
      expect(s.snapshot()[THEME_STORAGE_KEY]).toBe(v);
    }
  });

  it('silently ignores missing storage', () => {
    expect(() => writeStoredPreference(null, 'midnight')).not.toThrow();
  });

  it('silently ignores setItem errors', () => {
    const throwing = {
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(() => writeStoredPreference(throwing, 'midnight')).not.toThrow();
  });
});
