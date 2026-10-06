// KaTeX renders every equation that isn't being edited. It's only downloaded
// once a page actually has math on it. Its stylesheet also registers the
// KaTeX_* fonts that MathLive uses, so both libraries share one set of
// self-hosted fonts (the CSP allows no font CDN).
import { useEffect, useMemo, useState } from "react";

type Katex = typeof import("katex").default;

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;

export function loadKatex(): Promise<Katex> {
  if (katex) return Promise.resolve(katex);
  loading ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")])
    .then(([mod]) => (katex = mod.default))
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

/** True once KaTeX is ready; starts the download when `needed`. */
export function useKatex(needed = true): boolean {
  const [ready, setReady] = useState(() => katex !== null);
  useEffect(() => {
    if (ready || !needed) return;
    let alive = true;
    loadKatex()
      .then(() => alive && setReady(true))
      .catch(() => {}); // offline before first load: the LaTeX source shows instead
    return () => {
      alive = false;
    };
  }, [ready, needed]);
  return ready;
}

/**
 * LaTeX -> HTML. Never throws: a typo shows in red instead of breaking the
 * note. `trust: false` keeps \href, \includegraphics and friends inert,
 * since the LaTeX comes from whoever edited the note.
 */
export function renderLatex(latex: string, displayMode: boolean): string | null {
  if (!katex) return null;
  return katex.renderToString(latex, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    output: "htmlAndMathml",
    maxSize: 50,
    maxExpand: 500,
  });
}

const MATH_SELECTOR = '[data-type="inline-math"], [data-type="block-math"]';

/**
 * For HTML shown outside the editor (note cards, the read-only fallback):
 * fills each saved equation with rendered KaTeX. Call on HTML that has
 * already been sanitized; KaTeX's own output is generated here, not stored.
 */
export function useMathHtml(safeHtml: string): string {
  const hasMath = safeHtml.includes("data-latex");
  const ready = useKatex(hasMath);
  return useMemo(() => {
    if (!hasMath || !ready) return safeHtml;
    const doc = new DOMParser().parseFromString(`<body>${safeHtml}</body>`, "text/html");
    doc.querySelectorAll<HTMLElement>(MATH_SELECTOR).forEach((el) => {
      const html = renderLatex(el.dataset.latex ?? "", el.dataset.type === "block-math");
      if (html !== null) el.innerHTML = html;
    });
    return doc.body.innerHTML;
  }, [safeHtml, hasMath, ready]);
}
