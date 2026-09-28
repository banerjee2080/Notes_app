import { useState } from "react";
import CodeWindow from "./CodeWindow.jsx";
import { TICKER_FACTS, pick } from "../../lib/jsLore.js";

// Shared frame for login / signup: a floating editor with a code "splash"
// on the left and the form on the right.
const AuthFrame = ({ fileName, children }) => {
  const [fact] = useState(() => pick(TICKER_FACTS));
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-3 md:p-8">
      <CodeWindow
        fileName={fileName}
        className="max-w-4xl ide-window !bg-[var(--win-alpha)]"
        bodyClassName="grid md:grid-cols-[1fr_1.1fr]"
        actions={
          <span className="js-badge w-6 h-6 text-[11px]" aria-hidden="true">
            JS
          </span>
        }
      >
        <aside className="hidden md:flex flex-col justify-between border-r ide-divider bg-[color-mix(in_srgb,var(--panel)_60%,transparent)] p-7 text-[13px] leading-7">
          <pre className="font-mono whitespace-pre-wrap">
            <span className="gutter inline-block w-5 mr-3">1</span>
            <span className="tok-com">{"// Note.js — notes that keep secrets"}</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">2</span>
            <span className="tok-kw">import</span> <span className="tok-punc">{"{ "}</span>vault
            <span className="tok-punc">{" }"}</span> <span className="tok-kw">from</span>{" "}
            <span className="tok-str">"note.js"</span>
            <span className="tok-punc">;</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">3</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">4</span>
            <span className="tok-kw">const</span> notes <span className="tok-punc">=</span>{" "}
            <span className="tok-kw">await</span> vault<span className="tok-punc">.</span>
            <span className="tok-fn">unlock</span>
            <span className="tok-punc">(</span>pin<span className="tok-punc">);</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">5</span>
            <span className="tok-com">{"// ✓ AES-GCM, end to end"}</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">6</span>
            <span className="tok-com">{"// ✓ works offline"}</span>
            {"\n"}
            <span className="gutter inline-block w-5 mr-3">7</span>
            <span className="tok-com">{"// ✓ syncs when you're back"}</span>
          </pre>
          <div className="flex items-center gap-2 text-[12px] mt-8">
            <span className="js-badge h-5 px-1 !p-0 !px-1 text-[10px] items-center">{fact.tag}</span>
            <span className="tok-dim">{fact.text}</span>
          </div>
        </aside>
        <section className="p-6 sm:p-8">{children}</section>
      </CodeWindow>
    </div>
  );
};

// `let email =` label + input row used on the auth screens.
export const CodeField = ({ kw = "let", name, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[12.5px]">
      <span className="tok-kw">{kw}</span> <span className="text-[var(--fg)]">{name}</span>{" "}
      <span className="tok-punc">=</span>
    </span>
    {children}
  </label>
);

export const GoogleGlyph = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default AuthFrame;
