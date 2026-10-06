// How the app talks in the Common and Pythagoras themes. The JS theme's
// voice is the original code-flavoured JSX, left where it was; components
// render that when the theme is "js" and these strings otherwise.
import { useThemeStore } from "../stores/useThemeStore";
import type { ThemeId } from "./themes";

export interface Voice {
  brand: string;
  newNote: string;
  nav: { notes: string; bin: string; profile: string; history: string };
  recent: string;
  recentEmpty: string;
  signedIn: string;
  ready: string;
  offline: string;
  syncing: string;
  online: [on: string, off: string];
  search: string;
  monthFilter: string;
  cardSaved: string;
  cardInBin: string;
  empty: { title: string; body: string; cta: string };
  editorPlaceholder: string;
  editorFooter: string;
  /** Text before a toast message, by toast type. */
  toastMark: { success: string; error: string; loading: string; blank: string };
}

const COMMON: Voice = {
  brand: "Notes",
  newNote: "New note",
  nav: { notes: "All notes", bin: "Bin", profile: "Profile", history: "History" },
  recent: "Recent",
  recentEmpty: "Your latest notes will show up here.",
  signedIn: "Signed in",
  ready: "All changes saved",
  offline: "Offline. Saving on this device",
  syncing: "Syncing…",
  online: ["Online", "Offline"],
  search: "Search your notes",
  monthFilter: "Month",
  cardSaved: "Saved",
  cardInBin: "In the bin for up to 30 days",
  empty: {
    title: "No notes yet",
    body: "Start with a blank page. Everything you write saves as you go, even offline.",
    cta: "Write your first note",
  },
  editorPlaceholder: "Start writing… anyone else on this note sees it live",
  editorFooter: "Saved automatically",
  toastMark: { success: "✓", error: "!", loading: "…", blank: "•" },
};

const EUCLID: Voice = {
  brand: "Elements",
  newNote: "Construct a note",
  nav: { notes: "Propositions", bin: "Erased", profile: "Geometer", history: "Chronology" },
  recent: "Lately proved",
  recentEmpty: "Nothing proved yet.",
  signedIn: "Geometer",
  ready: "Q.E.D.",
  offline: "Off the grid. Kept on this tablet",
  syncing: "Constructing…",
  online: ["In concord", "Off the grid"],
  search: "Seek a proposition…",
  monthFilter: "Epoch",
  cardSaved: "Q.E.D.",
  cardInBin: "Erased. Recoverable for 30 days",
  empty: {
    title: "Let a note be constructed.",
    body: "Euclid began with five postulates. You may begin with a single line.",
    cta: "Construct the first note",
  },
  editorPlaceholder: "Let it be granted that…",
  editorFooter: "Q.E.D.",
  toastMark: { success: "∴", error: "✕", loading: "…", blank: "·" },
};

export const VOICES: Record<Exclude<ThemeId, "js">, Voice> = {
  common: COMMON,
  pythagoras: EUCLID,
};

/** The current theme, plus its voice (null for JS: render the original JSX). */
export function useVoice(): { theme: ThemeId; voice: Voice | null } {
  const theme = useThemeStore((s) => s.theme);
  return { theme, voice: theme === "js" ? null : VOICES[theme] };
}

/** One piece of copy per theme. Pythagoras falls back to Common. */
export interface Copy<T> {
  js: T;
  common: T;
  pythagoras?: T;
}

export const pickCopy = <T,>(theme: ThemeId, c: Copy<T>): T =>
  theme === "pythagoras" ? (c.pythagoras ?? c.common) : c[theme];

/** `t({ js, common, pythagoras })` -> the current theme's version. */
export function useCopy() {
  const theme = useThemeStore((s) => s.theme);
  return {
    theme,
    isJs: theme === "js",
    t: <T,>(c: Copy<T>): T => pickCopy(theme, c),
  };
}
