import { create } from "zustand";
import { persist } from "zustand/middleware";

const isMobile = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px)").matches;

interface UiState {
  sidebarOpen: boolean;
  drawerOpen: boolean;
  maximized: boolean;
  consoleOpen: boolean;
  toggleSidebar: () => void;
  closeDrawer: () => void;
  toggleMaximized: () => void;
  setConsoleOpen: (open: boolean) => void;
}

/** The slice that survives a reload; the rest always starts fresh. */
type PersistedUiState = Pick<UiState, "sidebarOpen" | "maximized">;

// Purely cosmetic window state for the IDE shell. Persisted per-browser; safe to lose.
//  - sidebarOpen: desktop sidebar expanded/collapsed (remembered)
//  - drawerOpen:  mobile slide-in drawer (always starts closed)
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      drawerOpen: false,
      maximized: false,
      consoleOpen: false,
      toggleSidebar: () =>
        set((s) =>
          isMobile()
            ? { drawerOpen: !s.drawerOpen }
            : { sidebarOpen: !s.sidebarOpen },
        ),
      closeDrawer: () => set({ drawerOpen: false }),
      toggleMaximized: () => set((s) => ({ maximized: !s.maximized })),
      setConsoleOpen: (open) => set({ consoleOpen: open }),
    }),
    {
      name: "notejs-ui",
      partialize: (s): PersistedUiState => ({
        sidebarOpen: s.sidebarOpen,
        maximized: s.maximized,
      }),
    },
  ),
);
