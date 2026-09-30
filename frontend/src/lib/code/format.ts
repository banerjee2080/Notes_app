// frontend/src/lib/code/format.ts
//
// "Format document" for every language, entirely offline.
//   * JS / TS / HTML / CSS / JSON -> Prettier (pure JS)
//   * C / C++ / Java / C#         -> clang-format (WebAssembly)
//   * Go                          -> gofmt       (WebAssembly)
//   * Python                      -> Ruff        (WebAssembly)
//   * Kotlin / Ruby / PHP         -> no formatter exists in the browser, so
//                                    the editor re-indents with its grammar
//                                    (handled in CodeEditorModal, returns null here)
//
// Everything is imported lazily: nobody downloads a formatter until they
// press Format for that language. The service worker precaches the files, so
// after the first visit they work with no network.
import type { Language } from "./languages";

// Each loader runs once; the promise is reused on later calls.
const once = <T,>(fn: () => Promise<T>): (() => Promise<T>) => {
  let p: Promise<T> | undefined;
  return () =>
    (p ??= fn().catch((e: unknown) => {
      p = undefined;
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }));
};

const loadPrettier = once(async () => {
  const [prettier, babel, estree, typescript, html, postcss] =
    await Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree"),
      import("prettier/plugins/typescript"),
      import("prettier/plugins/html"),
      import("prettier/plugins/postcss"),
    ]);
  return {
    format: prettier.format,
    plugins: [babel, estree, typescript, html, postcss],
  };
});

const loadClang = once(async () => {
  const mod = await import("@wasm-fmt/clang-format/vite");
  await mod.default(); // fetch + instantiate clang-format.wasm
  return mod;
});

const loadGofmt = once(async () => {
  const mod = await import("@wasm-fmt/gofmt/vite");
  await mod.default();
  return mod;
});

const loadRuff = once(async () => {
  const mod = await import("@wasm-fmt/ruff_fmt/vite");
  await mod.default();
  return mod;
});

const PRETTIER_PARSER: Record<string, string> = {
  "prettier-babel": "babel",
  "prettier-typescript": "typescript",
  "prettier-html": "html",
  "prettier-css": "css",
  "prettier-json": "json",
};

// clang-format picks the language from the file extension.
const CLANG_FILE: Record<string, string> = {
  c: "main.c",
  cpp: "main.cpp",
  java: "Main.java",
  csharp: "Main.cs",
};

// One house style for the brace languages: Google layout, 4-space indent.
const CLANG_STYLE = JSON.stringify({
  BasedOnStyle: "Google",
  IndentWidth: 4,
  ColumnLimit: 100,
  AllowShortFunctionsOnASingleLine: "Empty",
  AllowShortIfStatementsOnASingleLine: "Never",
  AllowShortLoopsOnASingleLine: false,
});

/**
 * Format `code` written in `lang` (an entry from languages.ts).
 * Resolves to the formatted string, or `null` when the editor should
 * re-indent instead. Rejects with a readable Error on a syntax error.
 */
export async function formatCode(
  lang: Language,
  code: string,
): Promise<string | null> {
  const kind = lang.format;

  if (kind in PRETTIER_PARSER) {
    const { format, plugins } = await loadPrettier();
    return format(code, {
      parser: PRETTIER_PARSER[kind],
      plugins,
      tabWidth: 2,
      printWidth: 90,
    });
  }

  if (kind === "clang") {
    const { format } = await loadClang();
    return format(code, CLANG_FILE[lang.id] ?? "main.cpp", CLANG_STYLE);
  }

  if (kind === "gofmt") {
    const { format } = await loadGofmt();
    return format(code); // throws "<line>:<col>: <message>" on bad syntax
  }

  if (kind === "ruff") {
    const { format } = await loadRuff();
    return format(code, "main.py", {
      indent_style: "space",
      indent_width: 4,
      line_width: 88,
    });
  }

  return null; // "reindent"
}

// Turn whatever a formatter threw into one short line for the output panel.
export const formatErrorMessage = (err: unknown): string => {
  const msg = String(
    (err instanceof Error ? err.message : undefined) ??
      err ??
      "Unknown formatter error",
  );
  return msg.split("\n").find((l) => l.trim()) ?? msg;
};
