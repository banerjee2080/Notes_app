// frontend/src/runner/prepare.ts
//
// Pure helpers used by the runner page:
//   prepareProject()  - turn "language + code" into the files/entry the
//                       compiler expects (plus small conveniences)
//   collectBuildDiagnostics() / runtimeDiagnostics()
//                     - compiler & traceback text -> {line, column, message}
//   cleanOutput()     - strip the sandbox's internal frames from errors
//
// No DOM, no engine - so the rules are easy to read and to test.
import type {
  CompilerDiagnostic,
  DiagnosticSeverity,
  RunnerLanguage,
} from "../types/runner";

/** What the compiler is handed, plus what diagnostics need to line up again. */
export interface Project {
  language: RunnerLanguage;
  entry: string;
  files: Record<string, string>;
  /** The file that holds the user's code (for diagnostics). */
  userFile: string;
  /** Characters we prepended to line 1 (subtract from columns). */
  line1Offset: number;
}

/** The subset of the engine's BuildResult that diagnostics are read from. */
export interface BuildLike {
  diagnostics?: Array<{
    file?: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    severity: DiagnosticSeverity;
    message: string;
    code?: string;
    source?: string;
  }>;
  stdout?: string;
  stderr?: string;
}

// ---- C++: <bits/stdc++.h> -------------------------------------------------
// That header is a GCC extension; the WebAssembly toolchain uses LLVM's
// libc++, which doesn't ship it. Competitive programmers use it constantly,
// so we provide our own copy and point the include at it.
const BITS_STDCXX = [
  "algorithm", "array", "bit", "bitset", "cassert", "cctype", "cerrno", "cfloat",
  "charconv", "chrono", "cinttypes", "climits", "cmath", "compare", "complex",
  "concepts", "cstddef", "cstdint", "cstdio", "cstdlib", "cstring", "ctime",
  "deque", "exception", "forward_list", "functional", "initializer_list",
  "iomanip", "ios", "iostream", "istream", "iterator", "limits", "list", "map",
  "memory", "numbers", "numeric", "optional", "ostream", "queue", "random",
  "ranges", "set", "span", "sstream", "stack", "stdexcept", "string",
  "string_view", "tuple", "type_traits", "unordered_map", "unordered_set",
  "utility", "valarray", "variant", "vector",
]
  .map((h) => `#include <${h}>`)
  .join("\n");

// ---- JavaScript / TypeScript stdin helpers --------------------------------
// The sandbox runs JS in QuickJS, where stdin is read with node:fs. These
// helpers give LeetCode/Codeforces-style `readline()` / `input()`.
// The import is prepended to line 1 WITHOUT a newline so line numbers in
// errors still match what the user sees.
const IO_IMPORT = 'import "./__notejs_io.js";';
const IO_IMPORT_TS = 'import "./__notejs_io";';

const JS_IO = `import __fs from "node:fs";
let __lines = null, __next = 0;
const __read = () => {
  if (__lines === null) {
    try { __lines = __fs.readFileSync(0, "utf8").split(/\\r?\\n/); } catch { __lines = []; }
    if (__lines.length && __lines[__lines.length - 1] === "") __lines.pop();
  }
  return __next < __lines.length ? __lines[__next++] : null;
};
globalThis.readline = globalThis.input = globalThis.prompt = () => __read();
if (typeof globalThis.require !== "function") {
  globalThis.require = (m) => {
    if (m === "fs" || m === "node:fs") return __fs;
    throw new Error("require('" + m + "') is not available in the offline runner");
  };
}
`;

const TS_IO = `import __fs from "node:fs";
declare global {
  /** Next line of stdin (undefined at end of input). */
  function readline(): string;
  /** Same as readline(). */
  function input(): string;
}
let __lines: string[] | null = null;
let __next = 0;
const __read = (): string => {
  if (__lines === null) {
    try { __lines = __fs.readFileSync(0, "utf8").split(/\\r?\\n/); } catch { __lines = []; }
    if (__lines.length && __lines[__lines.length - 1] === "") __lines.pop();
  }
  return (__next < __lines.length ? __lines[__next++] : undefined) as string;
};
const __g = globalThis as unknown as Record<string, unknown>;
__g.readline = __read;
__g.input = __read;
export {};
`;

// Java: the file must be named after its public class.
function javaEntry(code: string): string {
  const pub =
    /\bpublic\s+(?:(?:final|abstract|static)\s+)*class\s+([A-Za-z_$][\w$]*)/.exec(
      code,
    );
  if (pub) return `${pub[1]}.java`;
  return "Main.java";
}

export function prepareProject(
  language: RunnerLanguage,
  code: string,
): Project {
  switch (language) {
    case "c":
      return {
        language,
        entry: "main.c",
        files: { "main.c": code },
        userFile: "main.c",
        line1Offset: 0,
      };
    case "cpp": {
      const src = code.replace(
        /^(\s*#\s*include\s*)<bits\/stdc\+\+\.h>/m,
        '$1"bits/stdc++.h"',
      );
      const files: Record<string, string> = { "main.cpp": src };
      if (src !== code)
        files["bits/stdc++.h"] = `#pragma once\n${BITS_STDCXX}\n`;
      return {
        language,
        entry: "main.cpp",
        files,
        userFile: "main.cpp",
        line1Offset: 0,
      };
    }
    case "java": {
      const entry = javaEntry(code);
      return {
        language,
        entry,
        files: { [entry]: code },
        userFile: entry,
        line1Offset: 0,
      };
    }
    case "go":
      return {
        language,
        entry: "main.go",
        files: { "main.go": code },
        userFile: "main.go",
        line1Offset: 0,
      };
    case "python":
      return {
        language,
        entry: "main.py",
        files: { "main.py": code },
        userFile: "main.py",
        line1Offset: 0,
      };
    case "javascript":
      return {
        language,
        entry: "main.js",
        files: { "main.js": IO_IMPORT + code, "__notejs_io.js": JS_IO },
        userFile: "main.js",
        line1Offset: IO_IMPORT.length,
      };
    case "typescript":
      return {
        language,
        entry: "main.ts",
        files: { "main.ts": IO_IMPORT_TS + code, "__notejs_io.ts": TS_IO },
        userFile: "main.ts",
        line1Offset: IO_IMPORT_TS.length,
      };
    default:
      throw new Error(`No offline runner for "${String(language)}"`);
  }
}

// ---- diagnostics ------------------------------------------------------------

const basename = (p = ""): string => p.split("/").pop() ?? "";

const fixColumn = (project: Project, line: number, column: number): number =>
  line === 1 && column ? Math.max(1, column - project.line1Offset) : column;

// Matches "path/main.go:4:2: message" and "Main.java:3: error: message".
const LOCATION_LINE =
  /^(?:[^\s:]*\/)?([\w.$-]+\.(?:c|cc|cpp|cxx|h|hpp|go|java|py|js|ts)):(\d+)(?::(\d+))?:\s*(?:(fatal error|error|warning|note):\s*)?(.+)$/gm;

function parseLocationLines(
  project: Project,
  text: string,
): CompilerDiagnostic[] {
  const out: CompilerDiagnostic[] = [];
  for (const m of text.matchAll(LOCATION_LINE)) {
    if (basename(m[1]) !== basename(project.userFile)) continue;
    const severity: DiagnosticSeverity = /warning/.test(m[4] || "")
      ? "warning"
      : m[4] === "note"
        ? "info"
        : "error";
    const line = Number(m[2]);
    out.push({
      line,
      column: fixColumn(project, line, Number(m[3] || 0)),
      severity,
      message: m[5].trim(),
      source: project.language,
    });
  }
  return out;
}

/** Compiler diagnostics for the user's file, from a BuildResult. */
export function collectBuildDiagnostics(
  project: Project,
  build: BuildLike,
): CompilerDiagnostic[] {
  const structured = (build.diagnostics ?? [])
    .filter((d) => basename(d.file) === basename(project.userFile))
    .filter((d) => !/failed without a diagnostic/i.test(d.message))
    .map(
      (d): CompilerDiagnostic => ({
        line: d.line,
        column: fixColumn(project, d.line, d.column),
        endLine: d.endLine,
        endColumn:
          d.endLine === 1
            ? fixColumn(project, 1, d.endColumn ?? 0)
            : d.endColumn,
        severity: d.severity,
        message: d.code ? `${d.message} (${d.code})` : d.message,
        source: d.source,
      }),
    );
  if (structured.length) return structured;
  // Some toolchains (Go) print their errors instead of structuring them.
  return parseLocationLines(
    project,
    `${build.stdout || ""}\n${build.stderr || ""}`,
  );
}

/** Point at the line that crashed (Python tracebacks, JS stack traces). */
export function runtimeDiagnostics(
  project: Project,
  stderr: string | undefined,
): CompilerDiagnostic[] {
  if (!stderr) return [];
  const lastLine = stderr.trim().split("\n").pop() || "Runtime error";

  if (project.language === "python") {
    const frames = [
      ...stderr.matchAll(/File "(?:[^"]*\/)?main\.py", line (\d+)/g),
    ];
    if (!frames.length) return [];
    return [
      {
        line: Number(frames[frames.length - 1][1]),
        column: 0,
        severity: "error",
        message: lastLine,
        source: "python",
      },
    ];
  }

  if (project.language === "javascript" || project.language === "typescript") {
    const at = new RegExp(
      `${project.userFile.replace(".", "\\.")}:(\\d+):(\\d+)`,
    ).exec(stderr);
    if (!at) return [];
    const line = Number(at[1]);
    const message =
      stderr.split("\n").find((l) => /Error|error/.test(l)) || lastLine;
    return [
      {
        line,
        column: fixColumn(project, line, Number(at[2])),
        severity: "error",
        message: message.trim(),
        source: project.language,
      },
    ];
  }
  return [];
}

// ---- output clean-up --------------------------------------------------------

/** Remove sandbox plumbing from error output so users see *their* stack. */
export function cleanOutput(
  project: Project,
  text: string | undefined,
): string | undefined {
  if (!text) return text;
  let t = text.replace(/\/(?:project|work)\//g, "");

  if (project.language === "python") {
    // Drop frames that belong to the runner itself, e.g.
    //   File ".wasm-oj/deterministic_runner.py", line 44, in <module>
    //       _runpy.run_path(...)
    //       ~~~~~~^^^^^^^
    //   File "<frozen runpy>", line 293, in run_path
    const lines = t.split("\n");
    const kept: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*File "(?:\.wasm-oj\/|<frozen )/.test(l)) {
        while (
          i + 1 < lines.length &&
          /^\s{4,}/.test(lines[i + 1]) &&
          !/^\s*File "/.test(lines[i + 1])
        )
          i++;
        continue;
      }
      kept.push(l);
    }
    t = kept.join("\n");
  }

  if (project.language === "javascript" || project.language === "typescript") {
    t = t
      .replace(/Possibly unhandled promise rejection: /g, "")
      .split("\n")
      .filter((l) => !/__wasm_oj_eval_module|bundle\.js|__notejs_io/.test(l))
      .join("\n");
    // QuickJS reports a top-level failure twice; show it once.
    const blocks = t.split(/\n{2,}/);
    t = blocks.filter((b, i) => b.trim() && blocks.indexOf(b) === i).join("\n\n");
    if (t) t += "\n";
  }
  return t;
}
