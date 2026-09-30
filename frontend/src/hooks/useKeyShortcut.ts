import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, type Location } from "react-router";
import type { ShortcutKeyEvent } from "./useCloseShortcut";

// Ctrl+N is reserved by Chrome/Edge in a normal tab (it opens a new window
// before the page ever sees it). It *does* reach us in the installed PWA
// window, so we bind it anyway and add Alt+N as a backup that works everywhere.
export const NEW_NOTE_SHORTCUT_LABEL = "Ctrl+N / Alt+N";
export const DELETE_NOTE_SHORTCUT_LABEL = "Ctrl+D";

// e.code is the physical key, so these still work on non-QWERTY layouts
// (and on macOS, where Option+N types "˜" instead of "n").
const isKey = (e: ShortcutKeyEvent, letter: string): boolean =>
  e.code === `Key${letter.toUpperCase()}` || e.key?.toLowerCase() === letter;

/** Ctrl+N / Cmd+N, or Alt+N (Option+N on macOS). */
export const isNewNoteShortcut = (e: ShortcutKeyEvent): boolean => {
  if (e.shiftKey || !isKey(e, "n")) return false;
  const mod = e.ctrlKey || e.metaKey;
  // mod && alt together is AltGr on many layouts — not ours.
  return (mod && !e.altKey) || (e.altKey && !mod);
};

/** Ctrl+D / Cmd+D (the browser's "bookmark this page", which we override). */
export const isDeleteNoteShortcut = (e: ShortcutKeyEvent): boolean =>
  (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && isKey(e, "d");

/**
 * Runs `handler` when `test` matches a keydown anywhere on the page.
 * Ignored while a dialog (confirm box, code editor…) has focus, so a shortcut
 * never acts on the page hidden underneath it.
 *
 * Keys typed inside the TinyMCE iframe never reach this listener — Tiny.tsx
 * forwards them through its own props.
 */
export function useKeyShortcut(
  test: (e: KeyboardEvent) => boolean,
  handler: () => void,
  enabled = true,
): void {
  // Always call the latest handler without re-subscribing on every render.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !test(e)) return;
      if (e.target instanceof Element && e.target.closest('[role="dialog"]'))
        return;
      e.preventDefault();
      handlerRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [test, enabled]);
}

/** Opens the "new note" window as a modal over whatever is showing now. */
export function useOpenNewNote(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    if (location.pathname === "/createNote") return; // already creating one
    // If a note is open as a modal, keep the same page behind the new one.
    const bg =
      (location.state as { backgroundLocation?: Location } | null)
        ?.backgroundLocation ?? location;
    navigate("/createNote", { state: { backgroundLocation: bg } });
  }, [navigate, location]);
}
