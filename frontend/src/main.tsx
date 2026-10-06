import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Toaster, ToastBar, type ToastType } from "react-hot-toast";
import { BrowserRouter } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useThemeStore } from "./stores/useThemeStore";
import { VOICES } from "./lib/voice";
import ToastSound from "./components/ui/ToastSound";

// Set the theme before the first paint so there's no flash of the wrong one.
// (App keeps these in sync afterwards.)
document.documentElement.dataset.theme = useThemeStore.getState().theme;
document.documentElement.dataset.mode =
  localStorage.getItem("themeMode") === "light" ? "light" : "dark";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Easter egg for anyone who opens DevTools.
console.log(
  "%c JS %c Note.js %c\n\nconsole.log('Hello, fellow developer 👋');\n// Offline-first: every note is written to IndexedDB before it syncs.\n// Try the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A",
  "background:#f7df1e;color:#111;font-weight:700;font-size:14px;padding:2px 4px;border-radius:3px",
  "font-weight:700;font-size:14px;color:#82aaff",
  "color:#8b93a1;font-family:monospace",
);

/** How each toast type is rendered as a line of console output. */
interface ToastPrefix {
  mark: string;
  cls: string;
  fn: string;
}

// Toasts read like console output:  ✓ console.log("Note deleted")
const TOAST_PREFIX: Partial<Record<ToastType, ToastPrefix>> = {
  success: { mark: "✓", cls: "tok-ok", fn: "console.log" },
  error: { mark: "✕", cls: "tok-err", fn: "console.error" },
  loading: { mark: "…", cls: "tok-fn", fn: "await" },
  blank: { mark: "i", cls: "tok-fn", fn: "console.info" },
};

const BLANK_PREFIX: ToastPrefix = {
  mark: "i",
  cls: "tok-fn",
  fn: "console.info",
};

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('No #root element to mount into');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--win)",
            color: "var(--fg)",
            border: "1px solid var(--line)",
            borderRadius: "6px",
            boxShadow: "var(--shadow)",
            fontFamily: "var(--font-ui)",
            fontSize: "12.5px",
            maxWidth: "460px",
            padding: "6px 10px",
          },
          error: { style: { borderLeft: "3px solid var(--err)" } },
          success: { style: { borderLeft: "3px solid var(--ok)" } },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon }) => {
              const message =
                typeof t.message === "function" ? t.message(t) : t.message;
              const p = TOAST_PREFIX[t.type] || BLANK_PREFIX;
              const custom = t.type === "blank" && t.icon;
              // Common / Pythagoras: plain sentences, no console.log("…").
              const theme = useThemeStore.getState().theme;
              if (theme !== "js") {
                const marks = VOICES[theme].toastMark;
                const mark = marks[t.type as keyof typeof marks] ?? marks.blank;
                return (
                  <ToastSound id={t.id} type={t.type}>
                    <div className="flex items-start gap-2 py-0.5" role="status" aria-live="polite">
                      <span className={`shrink-0 font-bold ${p.cls}`}>{custom ? icon : mark}</span>
                      <span className="leading-5">{message}</span>
                    </div>
                  </ToastSound>
                );
              }
              return (
                <div className="flex items-start gap-2 py-0.5">
                  {custom ? (
                    <span className="shrink-0">{icon}</span>
                  ) : (
                    <span className={`shrink-0 font-bold ${p.cls}`}>{p.mark}</span>
                  )}
                  <span className="leading-5" role="status" aria-live="polite">
                    {!custom && (
                      <span className="tok-dim">
                        {p.fn}
                        {"("}
                      </span>
                    )}
                    <span className={custom ? "" : "tok-str"}>
                      {custom ? message : <>"{message}"</>}
                    </span>
                    {!custom && <span className="tok-dim">{")"}</span>}
                  </span>
                </div>
              );
            }}
          </ToastBar>
        )}
      </Toaster>
    </BrowserRouter>
  </StrictMode>,
);
