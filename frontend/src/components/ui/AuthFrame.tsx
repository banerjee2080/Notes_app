import { useState } from "react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import CodeWindow from "./CodeWindow";
import { ThemeBadge } from "./Themed";
import { TICKER_FACTS, pick } from "../../lib/jsLore";
import { PYTH_FACTS } from "../../lib/pythagorasLore";
import { useCopy } from "../../lib/voice";
import { useAuthStore } from "../../stores/useAuthStore";

interface AuthFrameProps {
  /** Window tab label: a file name in the JS theme, a plain title otherwise. */
  fileName: string;
  children: ReactNode;
}

const COMMON_POINTS = [
  "Saves as you type",
  "Works offline",
  "Syncs when you're back online",
  "Equations, typed with your keyboard",
];

// Euclid opened Book I with postulates; so does this sign-in page.
const POSTULATES = [
  "Every note is kept the moment it is written.",
  "A note may be written without a connection.",
  "Notes on every device shall agree.",
  "Any equation may be drawn by keyboard alone.",
];

const ROMAN = ["I", "II", "III", "IV"];

// Shared frame for sign-in / sign-up: a welcome panel on the left and the
// form on the right. JS: a code "splash"; Common: Sekka's pines; Pythagoras:
// Euclid's postulates over Byrne's diagram.
const AuthFrame = ({ fileName, children }: AuthFrameProps) => {
  const { theme } = useCopy();
  const isDark = useAuthStore((s) => s.themeMode) === "dark";
  const [jsFact] = useState(() => pick(TICKER_FACTS));
  const [pythFact] = useState(() => pick(PYTH_FACTS));

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-3 md:p-8">
      <CodeWindow
        fileName={fileName}
        className="max-w-4xl ide-window !bg-[var(--win-alpha)]"
        bodyClassName="grid md:grid-cols-[1fr_1.1fr]"
        actions={<ThemeBadge className="w-6 h-6 text-[11px]" />}
      >
        {theme === "js" ? (
          <aside className="hidden md:flex flex-col justify-between border-r ide-divider bg-[color-mix(in_srgb,var(--panel)_60%,transparent)] p-7 text-[13px] leading-7">
            <pre className="font-mono whitespace-pre-wrap">
              <span className="gutter inline-block w-5 mr-3">1</span>
              <span className="tok-com">{"// Note.js — notes that follow you"}</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">2</span>
              <span className="tok-kw">import</span> <span className="tok-punc">{"{ "}</span>notes
              <span className="tok-punc">{" }"}</span> <span className="tok-kw">from</span>{" "}
              <span className="tok-str">"note.js"</span>
              <span className="tok-punc">;</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">3</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">4</span>
              <span className="tok-kw">await</span> notes<span className="tok-punc">.</span>
              <span className="tok-fn">sync</span>
              <span className="tok-punc">();</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">5</span>
              <span className="tok-com">{"// ✓ autosaves as you type"}</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">6</span>
              <span className="tok-com">{"// ✓ works offline"}</span>
              {"\n"}
              <span className="gutter inline-block w-5 mr-3">7</span>
              <span className="tok-com">{"// ✓ syncs when you're back"}</span>
            </pre>
            <div className="flex items-center gap-2 text-[12px] mt-8">
              <span className="js-badge h-5 px-1 !p-0 !px-1 text-[10px] items-center">{jsFact.tag}</span>
              <span className="tok-dim">{jsFact.text}</span>
            </div>
          </aside>
        ) : theme === "common" ? (
          <aside className="hidden md:flex flex-col justify-between border-r ide-divider relative overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{ backgroundImage: `url('/themes/${isDark ? "sekka-village" : "sekka-pines"}.webp')` }}
              aria-hidden="true"
            />
            <div className="relative m-5 mt-auto rounded-[var(--radius)] bg-[var(--win-alpha)] p-5 shadow-sm">
              <p className="text-[20px] font-semibold leading-snug" style={{ fontFamily: "var(--font-content)" }}>
                Notes that follow you.
              </p>
              <ul className="mt-3 space-y-1.5 text-[14px]">
                {COMMON_POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <Check className="size-4 tok-ok shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] tok-dim">
                Kamisaka Sekka, {isDark ? "Fishing Village" : "Pine Trees"}, from Momoyogusa, 1909
              </p>
            </div>
          </aside>
        ) : (
          <aside className="hidden md:flex flex-col justify-between border-r ide-divider p-7 relative overflow-hidden bg-[color-mix(in_srgb,var(--panel)_70%,transparent)]">
            <img src="/themes/byrne-prop47.svg" alt="" className="auth-plate" />
            <div className="relative">
              <p className="text-[12px] tracking-[.25em] uppercase tok-dim">Book I · Postulates</p>
              <ol className="mt-4 space-y-3">
                {POSTULATES.map((p, i) => (
                  <li key={p} className="flex gap-3 text-[16px] leading-snug" style={{ fontFamily: "var(--font-content)" }}>
                    <span className="w-7 shrink-0 text-right tok-fn tabular-nums">{ROMAN[i]}.</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative flex items-center gap-2 text-[12px] mt-8">
              <span className="js-badge h-5 !px-1.5 text-[10px] items-center">{pythFact.tag}</span>
              <span className="tok-dim">{pythFact.text}</span>
            </div>
          </aside>
        )}
        <section className="p-6 sm:p-8">{children}</section>
      </CodeWindow>
    </div>
  );
};

interface CodeFieldProps {
  kw?: string;
  /** The JS variable name, e.g. `email`. */
  name: string;
  /** What the other themes show instead, e.g. "Email". */
  label: string;
  children: ReactNode;
}

// One labelled input on the sign-in screens: `let email =` in the JS theme.
export const CodeField = ({ kw = "let", name, label, children }: CodeFieldProps) => {
  const { isJs } = useCopy();
  return (
    <label className="flex flex-col gap-1.5">
      {isJs ? (
        <span className="text-[12.5px]">
          <span className="tok-kw">{kw}</span> <span className="text-[var(--fg)]">{name}</span>{" "}
          <span className="tok-punc">=</span>
        </span>
      ) : (
        <span className="text-[13px] font-medium text-[var(--fg-muted)]">{label}</span>
      )}
      {children}
    </label>
  );
};

/** The heading and subheading of an auth form. */
export const AuthHeading = ({ js, title, sub }: { js: ReactNode; title: string; sub: ReactNode }) => {
  const { isJs } = useCopy();
  return isJs ? (
    <>{js}</>
  ) : (
    <>
      <h1 className="text-[26px] font-semibold leading-tight mb-1" style={{ fontFamily: "var(--font-content)" }}>
        {title}
      </h1>
      <p className="text-[14px] tok-dim mb-6">{sub}</p>
    </>
  );
};

export const GoogleGlyph = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default AuthFrame;
