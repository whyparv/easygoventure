import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

/** The CRM record the agent is currently viewing, shared with the AI assistant. */
export interface AiContext {
  label: string;
  text: string;
  /** The entity the assistant can act on (e.g. schedule a follow-up for this lead). */
  entity?: { type: 'lead'; id: string };
}

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  aiOpen: boolean;
  aiContext: AiContext | null;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setAiOpen: (open: boolean) => void;
  setAiContext: (context: AiContext | null) => void;
}

/** Global UI preferences. Persisted: theme + sidebar. Transient: command/ai. */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      commandOpen: false,
      aiOpen: false,
      aiContext: null,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setAiContext: (aiContext) => set({ aiContext }),
    }),
    {
      name: 'dmc-crm-ui',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
