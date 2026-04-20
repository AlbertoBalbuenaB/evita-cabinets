import { create } from 'zustand';

const STORAGE_KEY = 'evita:sidebar:expanded';

function readStoredExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredExpanded(expanded: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, expanded ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

interface SidebarStore {
  expanded: boolean;
  mobileOpen: boolean;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setMobileOpen: (open: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
}

export const useSidebar = create<SidebarStore>((set, get) => ({
  expanded: readStoredExpanded(),
  mobileOpen: false,
  setExpanded: (expanded) => {
    writeStoredExpanded(expanded);
    set({ expanded });
  },
  toggleExpanded: () => {
    const next = !get().expanded;
    writeStoredExpanded(next);
    set({ expanded: next });
  },
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  openMobile: () => set({ mobileOpen: true }),
  closeMobile: () => set({ mobileOpen: false }),
}));
