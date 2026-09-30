// frontend/src/lib/code/languages.js
//
// One table that every part of the code editor reads from:
//   * `prism`   - the class TinyMCE stores:  <pre class="language-<prism>">
//                 (kept identical to TinyMCE's own names so old notes still open)
//   * `load`    - lazily imports the CodeMirror grammar (syntax colours,
//                 bracket matching, auto-indent and the syntax tree the
//                 red-line linter walks)
//   * `format`  - which formatter lib/code/format.js uses
//   * `run`     - which offline runtime executes it (null = cannot run)
//   * `starter` - a small program that reads stdin, so "Run" is discoverable

import type { Extension } from "@codemirror/state";
import type { RunnerLanguage, RunTarget } from "../../types/runner";

/** Which formatter lib/code/format.ts should use ("reindent" = none exists). */
export type FormatterKind =
  | "prettier-babel"
  | "prettier-typescript"
  | "prettier-html"
  | "prettier-css"
  | "prettier-json"
  | "clang"
  | "gofmt"
  | "ruff"
  | "reindent";

export interface Language {
  id: string;
  label: string;
  /** The class TinyMCE stores: <pre class="language-<prism>"> */
  prism: string;
  format: FormatterKind;
  /** Which offline runtime executes it, or null when it cannot be run. */
  run: RunTarget;
  /** Why this language cannot be run, shown when Run is unavailable. */
  runNote?: string;
  /** Lazily imports the CodeMirror grammar for this language. */
  load: () => Promise<Extension>;
  /** A small program that reads stdin, so "Run" is discoverable. */
  starter: string;
  sampleInput: string;
}

export const LANGUAGES: Language[] = [
  {
    id: "javascript",
    label: "JavaScript",
    prism: "javascript",
    format: "prettier-babel",
    run: "javascript",
    load: async () => (await import("@codemirror/lang-javascript")).javascript(),
    starter: `// stdin helpers: readline() / input() return the next line (null at EOF)
const n = Number(readline());
const nums = readline().split(" ").map(Number);

console.log(\`sum of \${n} numbers =\`, nums.reduce((a, b) => a + b, 0));
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "typescript",
    label: "TypeScript",
    prism: "typescript",
    format: "prettier-typescript",
    run: "typescript",
    load: async () =>
      (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
    starter: `// stdin helpers: readline() / input() return the next line
const n: number = Number(readline());
const nums: number[] = readline().split(" ").map(Number);

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
console.log(\`sum of \${n} numbers =\`, sum(nums));
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "python",
    label: "Python",
    prism: "python",
    format: "ruff",
    run: "python",
    load: async () => (await import("@codemirror/lang-python")).python(),
    starter: `n = int(input())
nums = list(map(int, input().split()))

print(f"sum of {n} numbers =", sum(nums))
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "c",
    label: "C",
    prism: "c",
    format: "clang",
    run: "c",
    load: async () => (await import("@codemirror/lang-cpp")).cpp(),
    starter: `#include <stdio.h>

int main(void) {
    int n;
    long long sum = 0;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        sum += x;
    }
    printf("sum of %d numbers = %lld\\n", n, sum);
    return 0;
}
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "cpp",
    label: "C++",
    prism: "cpp",
    format: "clang",
    run: "cpp",
    load: async () => (await import("@codemirror/lang-cpp")).cpp(),
    starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;

    cout << "sum of " << n << " numbers = " << accumulate(a.begin(), a.end(), 0LL) << "\\n";
    return 0;
}
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "java",
    label: "Java",
    prism: "java",
    format: "clang",
    run: "java",
    load: async () => (await import("@codemirror/lang-java")).java(),
    starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt();
        long sum = 0;
        for (int i = 0; i < n; i++) sum += in.nextLong();
        System.out.println("sum of " + n + " numbers = " + sum);
    }
}
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "go",
    label: "Go",
    prism: "go",
    format: "gofmt",
    run: "go",
    load: async () => (await import("@codemirror/lang-go")).go(),
    starter: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	in := bufio.NewReader(os.Stdin)
	var n int
	fmt.Fscan(in, &n)
	sum := 0
	for i := 0; i < n; i++ {
		var x int
		fmt.Fscan(in, &x)
		sum += x
	}
	fmt.Printf("sum of %d numbers = %d\\n", n, sum)
}
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "kotlin",
    label: "Kotlin",
    prism: "kotlin",
    format: "reindent",
    run: null,
    runNote:
      "Kotlin can't run offline: there is no WebAssembly build of the Kotlin compiler yet. Editing, highlighting, bracket checks and re-indenting still work.",
    load: async () => {
      const [{ StreamLanguage }, { kotlin }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      return StreamLanguage.define(kotlin);
    },
    starter: `fun main() {
    val n = readln().trim().toInt()
    val nums = readln().split(" ").map { it.toLong() }
    println("sum of $n numbers = \${nums.sum()}")
}
`,
    sampleInput: "3\n4 5 6\n",
  },
  {
    id: "markup",
    label: "HTML/XML",
    prism: "markup",
    format: "prettier-html",
    run: "html-preview",
    load: async () => (await import("@codemirror/lang-html")).html(),
    starter: `<!doctype html>
<html>
  <body>
    <h1 id="t">Hello from Note.js</h1>
    <script>
      document.getElementById("t").textContent += " - " + new Date().toLocaleTimeString();
    </script>
  </body>
</html>
`,
    sampleInput: "",
  },
  {
    id: "css",
    label: "CSS",
    prism: "css",
    format: "prettier-css",
    run: null,
    load: async () => (await import("@codemirror/lang-css")).css(),
    starter: "",
    sampleInput: "",
  },
  {
    id: "json",
    label: "JSON",
    prism: "json",
    format: "prettier-json",
    run: null,
    load: async () => (await import("@codemirror/lang-json")).json(),
    starter: "",
    sampleInput: "",
  },
  // Kept so code blocks created by TinyMCE's old dialog still open with their
  // highlighting; they can be edited and re-indented but not run.
  {
    id: "csharp",
    label: "C#",
    prism: "csharp",
    format: "clang",
    run: null,
    load: async () => {
      const [{ StreamLanguage }, { csharp }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/clike"),
      ]);
      return StreamLanguage.define(csharp);
    },
    starter: "",
    sampleInput: "",
  },
  {
    id: "php",
    label: "PHP",
    prism: "php",
    format: "reindent",
    run: null,
    load: async () => (await import("@codemirror/lang-html")).html(),
    starter: "",
    sampleInput: "",
  },
  {
    id: "ruby",
    label: "Ruby",
    prism: "ruby",
    format: "reindent",
    run: null,
    load: async () => {
      const [{ StreamLanguage }, { ruby }] = await Promise.all([
        import("@codemirror/language"),
        import("@codemirror/legacy-modes/mode/ruby"),
      ]);
      return StreamLanguage.define(ruby);
    },
    starter: "",
    sampleInput: "",
  },
];

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));
const BY_PRISM = new Map(LANGUAGES.map((l) => [l.prism, l]));

const FALLBACK = LANGUAGES[0]; // JavaScript

export const getLanguage = (id: string | undefined): Language =>
  (id ? BY_ID.get(id) : undefined) ?? FALLBACK;

// "language-cpp" (TinyMCE's stored class) -> language entry.
// Unknown classes fall back to plain JavaScript mode rather than failing.
export const languageFromClass = (className = ""): Language | null => {
  const m = /(?:^|\s)language-([\w+#-]+)/.exec(className);
  if (!m) return null;
  return BY_PRISM.get(m[1]) ?? BY_ID.get(m[1]) ?? null;
};

// Remember the last language the user picked (per browser, not synced).
const LAST_KEY = "notejs:last-code-language";
export const lastLanguageId = (): string => {
  try {
    return localStorage.getItem(LAST_KEY) || "cpp";
  } catch {
    return "cpp";
  }
};
export const rememberLanguage = (id: string): void => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* private mode - not important */
  }
};

// Languages whose "Run" goes through the offline WASM runner.
export const RUNNER_LANGUAGES: RunnerLanguage[] = [
  "c",
  "cpp",
  "go",
  "java",
  "python",
  "javascript",
  "typescript",
];

/** True when `run` names a language the WebAssembly runner can execute. */
export const isRunnerLanguage = (run: RunTarget): run is RunnerLanguage =>
  run !== null && (RUNNER_LANGUAGES as string[]).includes(run);
