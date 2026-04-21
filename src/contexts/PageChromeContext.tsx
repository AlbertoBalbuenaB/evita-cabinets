import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LucideIcon } from 'lucide-react';

export type Crumb = { label: string; to?: string };

export type ChromeActionVariant = 'primary' | 'secondary' | 'danger';

export type ChromeAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: ChromeActionVariant;
  disabled?: boolean;
  loading?: boolean;
};

export type ChromeTab = {
  id: string;
  label: string;
  count?: number | null;
  onClick: () => void;
};

export type PageChrome = {
  title?: string;
  crumbs?: Crumb[];
  primaryAction?: ChromeAction;
  secondaryActions?: ChromeAction[];
  tabs?: ChromeTab[];
  activeTabId?: string;
};

type ChromeContextValue = {
  chrome: PageChrome;
  setChrome: (next: PageChrome) => void;
};

const PageChromeContext = createContext<ChromeContextValue | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<PageChrome>({});
  const setChrome = useCallback((next: PageChrome) => setChromeState(next), []);
  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);
  return (
    <PageChromeContext.Provider value={value}>
      {children}
    </PageChromeContext.Provider>
  );
}

export function useChromeReader(): PageChrome {
  const ctx = useContext(PageChromeContext);
  return ctx?.chrome ?? {};
}

/**
 * Register page chrome (title, breadcrumbs, primary action).
 * Replaces the previous chrome; resets to {} on unmount so the next
 * page falls back to URL-derived crumbs until it registers its own.
 *
 * Caller is responsible for providing a stable `deps` array — the hook
 * writes to the store whenever deps change.
 */
export function usePageChrome(
  chrome: PageChrome,
  deps: ReadonlyArray<unknown>,
) {
  const ctx = useContext(PageChromeContext);
  if (!ctx) {
    throw new Error('usePageChrome must be used within <PageChromeProvider>');
  }
  const { setChrome } = ctx;
  useEffect(() => {
    setChrome(chrome);
    if (chrome.title) {
      const original = document.title;
      document.title = `${chrome.title} · Evita Cabinets`;
      return () => {
        setChrome({});
        document.title = original;
      };
    }
    return () => setChrome({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
