import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "../lib/themes";

interface ThemeState {
  theme: ThemeId;
  /** Pythagoras theme: monochord tones on actions. Off until asked for. */
  soundOn: boolean;
  setTheme: (theme: ThemeId) => void;
  toggleSound: () => void;
}

// Per-browser, like dark/light mode. Safe to lose.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      soundOn: false,
      setTheme: (theme) => set({ theme }),
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
    }),
    {
      name: "notejs-theme",
      // A stale or hand-edited value falls back to the default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ThemeState>;
        return {
          ...current,
          theme: isThemeId(p.theme) ? p.theme : current.theme,
          soundOn: p.soundOn === true,
        };
      },
    },
  ),
);

/** Read outside React (toasts, sounds). */
export const currentTheme = (): ThemeId => useThemeStore.getState().theme;
