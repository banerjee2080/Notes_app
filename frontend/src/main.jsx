import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Toaster, ToastBar } from "react-hot-toast";
import { BrowserRouter } from "react-router";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Easter egg for anyone who opens DevTools.
console.log(
  "%c JS %c Note.js %c\n\nconsole.log('Hello, fellow developer 👋');\n// Your notes are encrypted before they ever leave this tab.\n// Try the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A",
  "background:#f7df1e;color:#111;font-weight:700;font-size:14px;padding:2px 4px;border-radius:3px",
  "font-weight:700;font-size:14px;color:#82aaff",
  "color:#8b93a1;font-family:monospace",
);

// Toasts read like console output:  ✓ console.log("Note deleted")
const TOAST_PREFIX = {
  success: { mark: "✓", cls: "tok-ok", fn: "console.log" },
  error: { mark: "✕", cls: "tok-err", fn: "console.error" },
  loading: { mark: "…", cls: "tok-fn", fn: "await" },
  blank: { mark: "i", cls: "tok-fn", fn: "console.info" },
};

createRoot(document.getElementById("root")).render(
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
            fontFamily: "var(--font-mono)",
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
              const p = TOAST_PREFIX[t.type] || TOAST_PREFIX.blank;
              const custom = t.type === "blank" && t.icon;
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
