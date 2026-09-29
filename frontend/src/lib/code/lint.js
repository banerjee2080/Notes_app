// frontend/src/lib/code/lint.js
//
// The red squiggly lines. Two sources are merged into one CodeMirror linter:
//
// 1. Live syntax errors (as you type, no compiler needed).
//    CodeMirror's Lezer parsers never give up on bad input - they insert
//    "error nodes" (node.type.isError) where the code doesn't fit the
//    grammar. We walk the syntax tree and underline each one.
//    Languages that only have a simple tokenizer (Kotlin, Ruby, C#) produce
//    no error nodes, so for those we check that brackets balance instead.
//
// 2. Real compiler diagnostics (clang, javac, go, tsc, Python tracebacks),
//    from a background "check" a moment after you stop typing, or from Run.
//    The modal pushes them in with setExternalDiagnostics; they follow the
//    text as you edit and disappear from any range you change.
import { StateEffect, StateField } from "@codemirror/state";
import { ensureSyntaxTree, language as languageFacet, StreamLanguage } from "@codemirror/language";
import { linter } from "@codemirror/lint";

// ---- compiler diagnostics ------------------------------------------------

// Payload: { diagnostics: Diagnostic[], verified: boolean }
// `verified` = a real compiler has checked exactly this text. While that is
// true we trust the compiler over the Lezer grammar, whose C++/Java/TS rules
// lag behind the languages (e.g. Java switch expressions) and can flag valid
// code. Any edit flips it back to false until the next check.
export const setExternalDiagnostics = StateEffect.define();

export const externalDiagnostics = StateField.define({
  create: () => ({ list: [], verified: false }),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setExternalDiagnostics)) return { list: e.value.diagnostics, verified: !!e.value.verified };
    }
    if (!tr.docChanged) return value;
    // Keep diagnostics whose text is untouched and move them with the edit.
    const list = value.list
      .filter((d) => !tr.changes.touchesRange(d.from, d.to))
      .map((d) => ({ ...d, from: tr.changes.mapPos(d.from, 1), to: tr.changes.mapPos(d.to, -1) }))
      .filter((d) => d.to >= d.from);
    return { list, verified: false };
  },
});

/**
 * Convert compiler diagnostics ({ line, column, endLine?, endColumn?,
 * severity, message, source }, 1-based) into CodeMirror ranges for `doc`.
 */
export function toEditorDiagnostics(doc, diags) {
  const out = [];
  for (const d of diags) {
    if (!d.line || d.line < 1 || d.line > doc.lines) continue;
    const line = doc.line(d.line);
    const col = Math.max(1, d.column || 1);
    let from = Math.min(line.from + col - 1, line.to);
    let to;
    if (d.endLine && d.endLine >= d.line && d.endLine <= doc.lines) {
      to = Math.min(doc.line(d.endLine).from + Math.max(1, d.endColumn || 1) - 1, doc.length);
    }
    if (to === undefined || to <= from) {
      // No end position: underline the word at the column, or the whole
      // line when the compiler only gave us a line number.
      if (!d.column || d.column <= 1) {
        const firstNonSpace = line.text.search(/\S/);
        from = line.from + Math.max(0, firstNonSpace);
        to = line.to;
      } else {
        const rest = line.text.slice(from - line.from);
        const word = /^[\w$]+|^\S/.exec(rest);
        to = from + (word ? word[0].length : 0);
      }
    }
    out.push({
      from,
      to: Math.max(from, to),
      severity: d.severity === "warning" ? "warning" : d.severity === "info" ? "info" : "error",
      source: d.source,
      message: d.message,
    });
  }
  return out;
}

// ---- live syntax errors --------------------------------------------------

const MAX_SYNTAX_DIAGNOSTICS = 25;

function treeDiagnostics(state, tree) {
  const out = [];
  tree.iterate({
    enter(node) {
      if (out.length >= MAX_SYNTAX_DIAGNOSTICS) return false;
      if (!node.type.isError) return undefined;
      const { from, to } = node;
      if (from === to) {
        // Zero-width error: the parser expected a token here.
        const at = Math.min(from, state.doc.length);
        const line = state.doc.lineAt(at);
        const end = at < line.to ? at + 1 : at;
        const start = end === at && at > line.from ? at - 1 : at;
        out.push({ from: start, to: end, severity: "error", source: "syntax", message: "Syntax error: something is missing here" });
      } else {
        const text = state.doc.sliceString(from, Math.min(to, from + 40)).split("\n")[0];
        out.push({ from, to, severity: "error", source: "syntax", message: `Syntax error: unexpected "${text}"` });
      }
      return false; // one squiggle per error region is enough
    },
  });
  return out;
}

const OPEN = { "(": ")", "[": "]", "{": "}" };
const CLOSE = { ")": "(", "]": "[", "}": "{" };

// For stream (tokenizer-only) languages: unbalanced brackets outside of
// strings and comments.
function bracketDiagnostics(state, tree) {
  const skip = [];
  tree.iterate({
    enter(node) {
      if (/string|comment|meta|char/i.test(node.name)) skip.push([node.from, node.to]);
    },
  });
  let s = 0;
  const text = state.doc.toString();
  const stack = [];
  const out = [];
  for (let i = 0; i < text.length && out.length < MAX_SYNTAX_DIAGNOSTICS; i++) {
    while (s < skip.length && skip[s][1] <= i) s++;
    if (s < skip.length && skip[s][0] <= i) continue;
    const ch = text[i];
    if (OPEN[ch]) stack.push({ ch, pos: i });
    else if (CLOSE[ch]) {
      const top = stack.pop();
      if (!top) {
        out.push({ from: i, to: i + 1, severity: "error", source: "brackets", message: `Unmatched "${ch}"` });
      } else if (top.ch !== CLOSE[ch]) {
        out.push({ from: i, to: i + 1, severity: "error", source: "brackets", message: `Expected "${OPEN[top.ch]}" but found "${ch}"` });
        stack.push(top); // keep the opener so later closers still pair up
      }
    }
  }
  for (const { ch, pos } of stack.slice(0, MAX_SYNTAX_DIAGNOSTICS)) {
    out.push({ from: pos, to: pos + 1, severity: "error", source: "brackets", message: `"${ch}" is never closed` });
  }
  return out;
}

export function syntaxDiagnostics(state) {
  // Parse the whole document (up to 300 ms) - errors near the end matter too.
  const tree = ensureSyntaxTree(state, state.doc.length, 300);
  if (!tree) return [];
  const lang = state.facet(languageFacet);
  return lang instanceof StreamLanguage ? bracketDiagnostics(state, tree) : treeDiagnostics(state, tree);
}

/** CodeMirror extension: live syntax squiggles + compiler errors. */
export const codeLinter = () => [
  externalDiagnostics,
  linter(
    (view) => {
      const { list, verified } = view.state.field(externalDiagnostics);
      return verified ? list : [...syntaxDiagnostics(view.state), ...list];
    },
    {
      delay: 350,
      // Re-run immediately when a check/run delivers compiler diagnostics.
      needsRefresh: (update) =>
        update.transactions.some((tr) => tr.effects.some((e) => e.is(setExternalDiagnostics))),
    },
  ),
];
