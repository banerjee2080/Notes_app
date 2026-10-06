import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { MathfieldElement } from "mathlive";
import { Check, Keyboard } from "lucide-react";
import { loadMathLive } from "../../lib/math/mathlive";
import { renderLatex } from "../../lib/math/katex";
import type { MathExit } from "./MathView";

type Tab = "visual" | "latex";
const TAB_KEY = "notejs-math-tab";

const savedTab = (): Tab => {
  try {
    return localStorage.getItem(TAB_KEY) === "latex" ? "latex" : "visual";
  } catch {
    return "visual";
  }
};

const touchFirst = () =>
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

// MathLive and its menus/keyboard live in <body>, outside the panel; a click
// there is still "inside" the editor.
const isMathLiveUi = (target: EventTarget) =>
  target instanceof Element &&
  (target.tagName === "MATH-FIELD" ||
    /\b(ML__|ui-menu)/.test(typeof target.className === "string" ? target.className : ""));

interface MathEditorProps {
  /** The rendered equation; the panel opens next to it. */
  anchor: RefObject<HTMLElement | null>;
  initial: string;
  display: boolean;
  /** `null` latex = cancelled. */
  onClose: (latex: string | null, exit: MathExit) => void;
}

/**
 * The equation editor. "Visual" is a MathLive field: type a/b for a
 * fraction, x^2, sqrt, alpha, sum, int… and arrow out of either end to get
 * back into the text. "LaTeX" is the raw source with a live preview.
 * Enter finishes, Esc cancels, Alt+L switches tabs.
 */
export default function MathEditor({ anchor, initial, display, onClose }: MathEditorProps) {
  const [tab, setTab] = useState<Tab>(savedTab);
  const [value, setValue] = useState(initial);
  const valueRef = useRef(initial);
  const [visualFailed, setVisualFailed] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const closed = useRef(false);
  const finish = (latex: string | null, exit: MathExit) => {
    if (closed.current) return;
    closed.current = true;
    window.mathVirtualKeyboard?.hide();
    // Let go of focus before unmounting, so the note can take it back.
    field.current?.blur();
    text.current?.blur();
    closeRef.current(latex === null ? null : latex.trim(), exit);
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  const update = (v: string) => {
    valueRef.current = v;
    setValue(v);
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // remembered for this session only
    }
  };

  // Mount the MathLive field for the visual tab.
  useEffect(() => {
    if (tab !== "visual") return;
    let alive = true;
    let mf: MathfieldElement | null = null;
    loadMathLive()
      .then(({ MathfieldElement }) => {
        if (!alive || !host.current) return;
        mf = new MathfieldElement();
        mf.defaultMode = display ? "math" : "inline-math";
        mf.smartFence = true;
        mf.mathVirtualKeyboardPolicy = touchFirst() ? "auto" : "manual";
        mf.placeholder = "\\text{type math…}";
        host.current.appendChild(mf);
        mf.value = valueRef.current;
        mf.addEventListener("input", () => mf && update(mf.value));
        // Arrowing past either end leaves the equation, like any other character.
        mf.addEventListener("move-out", (e) => {
          e.preventDefault();
          const dir = e.detail.direction;
          finishRef.current(mf?.value ?? valueRef.current, dir === "forward" || dir === "downward" ? "after" : "before");
        });
        field.current = mf;
        // focus() is a no-op until MathLive has built its shadow DOM, so
        // wait for "mount": the caret must land in the field, ready to type.
        const focusField = () => mf?.focus();
        mf.addEventListener("mount", focusField, { once: true });
        requestAnimationFrame(focusField);
      })
      .catch(() => {
        if (!alive) return;
        setVisualFailed(true); // offline before MathLive was ever cached
        setTab("latex");
      });
    return () => {
      alive = false;
      mf?.remove();
      field.current = null;
    };
  }, [tab, display]);

  useEffect(() => {
    if (tab === "latex") text.current?.focus();
  }, [tab]);

  // Keys, caught before MathLive sees them (capture phase on the panel).
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const typingCommand = field.current?.mode === "latex"; // mid "\frac…": let MathLive finish it
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyL") {
        e.preventDefault();
        switchTab(tab === "visual" ? "latex" : "visual");
      } else if (e.key === "Escape" && !typingCommand) {
        e.preventDefault();
        e.stopPropagation();
        finishRef.current(null, "after");
      } else if (e.key === "Enter" && !e.shiftKey && !typingCommand && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        finishRef.current(valueRef.current, "after");
      }
    };
    // Bubble phase, after MathLive: nothing typed here is a page shortcut.
    const contain = (e: KeyboardEvent) => e.stopPropagation();
    el.addEventListener("keydown", onKey, true);
    el.addEventListener("keydown", contain);
    return () => {
      el.removeEventListener("keydown", onKey, true);
      el.removeEventListener("keydown", contain);
    };
  }, [tab]);

  // Clicking anywhere else keeps the edit and closes.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const path = e.composedPath();
      if (path.some((t) => t === panel.current || t === anchor.current || isMathLiveUi(t))) return;
      finishRef.current(valueRef.current, "stay");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [anchor]);

  // Sit under the equation (above it if there's no room), and follow it.
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      let top = a.bottom + 8;
      if (top + h > window.innerHeight - 8 && a.top - h - 8 > 8) top = a.top - h - 8;
      const ideal = display ? a.left + a.width / 2 - w / 2 : a.left - 14;
      const left = Math.max(8, Math.min(ideal, window.innerWidth - w - 8));
      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (anchor.current) ro.observe(anchor.current);
    if (panel.current) ro.observe(panel.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, display]);

  const toggleKeyboard = () => {
    const kb = window.mathVirtualKeyboard;
    if (!kb) return;
    field.current?.focus();
    if (kb.visible) kb.hide();
    else kb.show({ animate: true });
  };

  const preview = tab === "latex" && value.trim() ? renderLatex(value, display) : null;

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label="Equation editor"
      className={`math-editor ide-dialog ${display ? "is-block" : ""}`}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <div className="math-editor-head">
        <div role="tablist" aria-label="Editing mode" className="math-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "visual"}
            onClick={() => switchTab("visual")}
            disabled={visualFailed}
            title="Type math naturally (Alt+L to switch)"
          >
            Visual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "latex"}
            onClick={() => switchTab("latex")}
            title="Edit the LaTeX source (Alt+L to switch)"
          >
            LaTeX
          </button>
        </div>
        <div className="flex items-center gap-1">
          {tab === "visual" && (
            <button type="button" className="ide-icon-btn !w-7 !h-7" onClick={toggleKeyboard} title="On-screen math keyboard" aria-label="Toggle on-screen math keyboard">
              <Keyboard className="size-4" />
            </button>
          )}
          <button type="button" className="ide-btn ide-btn-primary !py-1 !px-2 text-xs" onClick={() => finish(valueRef.current, "after")}>
            <Check className="size-3.5" /> Done
          </button>
        </div>
      </div>

      {tab === "visual" ? (
        <div ref={host} className="math-editor-field" />
      ) : (
        <div className="math-editor-latex">
          <textarea
            ref={text}
            value={value}
            onChange={(e) => update(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            rows={Math.min(8, Math.max(display ? 3 : 1, value.split("\n").length))}
            placeholder={display ? "\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt\\pi}{2}" : "a^2 + b^2 = c^2"}
            aria-label="LaTeX source"
          />
          <div className="math-editor-preview" aria-live="polite">
            {preview ? <span dangerouslySetInnerHTML={{ __html: preview }} /> : <span className="math-empty">preview</span>}
          </div>
        </div>
      )}

      <div className="math-editor-hints">
        {tab === "visual" ? (
          <>
            <kbd>a/b</kbd> fraction <kbd>x^2</kbd> power <kbd>sqrt</kbd> root <kbd>alpha</kbd> α <kbd>\</kbd> any command
          </>
        ) : (
          <>
            <kbd>Shift</kbd>+<kbd>↵</kbd> new line
          </>
        )}
        <span className="ml-auto">
          <kbd>↵</kbd> done <kbd>Esc</kbd> cancel
        </span>
      </div>
    </div>,
    document.body,
  );
}
