import { useEffect, useRef } from "react";

// Ctrl+Shift+X (Cmd+Shift+X on macOS) closes the open note window.
export const CLOSE_SHORTCUT_LABEL = "Ctrl+Shift+X";

export const isCloseShortcut = (e) =>
  (e.ctrlKey || e.metaKey) &&
  e.shiftKey &&
  !e.altKey &&
  // e.code is the physical key, so it still works on non-QWERTY layouts
  (e.code === "KeyX" || e.key?.toLowerCase() === "x");

/**
 * Calls onClose when the shortcut is pressed anywhere on the page.
 *
 * Keys typed *inside the TinyMCE editor* never reach this listener (the editor
 * lives in an iframe with its own window), so Tiny.jsx registers the same
 * shortcut itself and receives onClose via its `onCloseShortcut` prop.
 */
export function useCloseShortcut(onClose) {
  // Always call the latest onClose without re-subscribing on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isCloseShortcut(e)) return;
      // A dialog on top (code editor, delete confirmation) owns the keyboard:
      // don't yank the note away underneath it.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return;
      e.preventDefault();
      onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
