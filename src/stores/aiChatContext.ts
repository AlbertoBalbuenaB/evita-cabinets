import { create } from 'zustand';

interface AiChatContextState {
  activeProjectTab: string | null;
  setActiveProjectTab: (tab: string | null) => void;
}

export const useAiChatContext = create<AiChatContextState>((set) => ({
  activeProjectTab: null,
  setActiveProjectTab: (tab) => set({ activeProjectTab: tab }),
}));
