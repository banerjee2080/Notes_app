// frontend/src/components/code/editorSetup.js
//
// Everything CodeMirror needs, in one place: the base feature set, the theme
// (built from the app's CSS variables so it follows dark / light / custom
// colours automatically), the key bindings, and a Compartment for each
// setting that changes while the editor is open (language, indentation).
import { basicSetup } from "codemirror";
import { EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { completeAnyWord } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import { codeLinter } from "../../lib/code/lint.js";

// Colours come from index.css tokens (--kw, --fn, --str, ...), so the editor
// matches the note editor and the user's chosen theme colours.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: "var(--kw)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "var(--fn)" },
  { tag: [t.string, t.special(t.string), t.character, t.regexp], color: "var(--str)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--num)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--com)", fontStyle: "italic" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "var(--warn)" },
  { tag: [t.propertyName, t.attributeName], color: "color-mix(in oklab, var(--fn) 60%, var(--fg))" },
  { tag: [t.tagName], color: "var(--err)" },
  { tag: [t.processingInstruction, t.meta, t.annotation], color: "var(--kw)", opacity: "0.85" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--fg-muted)" },
  { tag: t.invalid, color: "var(--err)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--fg)", fontSize: "13.5px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--kw)", padding: "10px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--kw)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection) !important",
  },
  ".cm-gutters": { backgroundColor: "var(--panel)", color: "var(--fg-dim)", borderRight: "1px solid var(--line-soft)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--panel-2)", color: "var(--fg)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--panel-2) 55%, transparent)" },
  ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--kw) 25%, transparent)", outline: "1px solid color-mix(in srgb, var(--kw) 60%, transparent)" },
  ".cm-nonmatchingBracket": { color: "var(--err)" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--fn) 18%, transparent)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--fg-muted)" },
  ".cm-placeholder": { color: "var(--fg-dim)", fontStyle: "italic" },
  ".cm-tooltip": { backgroundColor: "var(--win)", border: "1px solid var(--line)", color: "var(--fg)", borderRadius: "6px", boxShadow: "var(--shadow)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "color-mix(in srgb, var(--kw) 25%, var(--panel))", color: "var(--fg)" },
  ".cm-tooltip-lint": { fontFamily: "var(--font-mono)", fontSize: "12.5px" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--err)" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--warn)" },
  ".cm-lintRange-error": {
    // The classic red squiggle, drawn with an SVG so it follows the theme.
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='m0 3 l2 -2 l1 0 l2 2 l1 0' stroke='%23f14c4c' fill='none' stroke-width='1.1'/%3E%3C/svg%3E\")",
  },
  ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--fg)", borderColor: "var(--line)" },
  ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warn) 30%, transparent)" },
  ".cm-textfield": { backgroundColor: "var(--win)", border: "1px solid var(--line)", color: "var(--fg)" },
  ".cm-button": { backgroundImage: "none", backgroundColor: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--fg)" },
});

// Go uses tabs (gofmt), the web languages 2 spaces, everything else 4.
export const indentFor = (langId) =>
  langId === "go" ? "\t" : ["javascript", "typescript", "markup", "css", "json"].includes(langId) ? "  " : "    ";

export const languageSlot = new Compartment();
export const indentSlot = new Compartment();

/**
 * @param doc      initial text
 * @param actions  { run, format, save } - called by the keyboard shortcuts
 * @param onChange (text) => void
 */
export function createEditorState(doc, actions, onChange) {
  return EditorState.create({
    doc,
    extensions: [
      basicSetup,
      // Higher precedence than basicSetup's keymap so Mod-Enter runs code
      // instead of inserting a blank line.
      Prec.highest(
        keymap.of([
          { key: "Mod-Enter", preventDefault: true, run: () => (actions.current.run(), true) },
          { key: "Shift-Alt-f", preventDefault: true, run: () => (actions.current.format(), true) },
          { key: "Mod-s", preventDefault: true, run: () => (actions.current.save(), true) },
        ]),
      ),
      keymap.of([indentWithTab]),
      languageSlot.of([]),
      indentSlot.of(indentUnit.of("    ")),
      EditorState.tabSize.of(4),
      // Words already in the file as completions, on top of what each
      // language provides (JS scope analysis, Python locals, keywords…).
      EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]),
      syntaxHighlighting(highlight),
      theme,
      lintGutter(),
      codeLinter(),
      placeholderExt("// write some code…   Ctrl+Enter to run · Shift+Alt+F to format"),
      EditorView.contentAttributes.of({ "aria-label": "Code editor", spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
      EditorView.updateListener.of((u) => u.docChanged && onChange(u.state.doc.toString())),
    ],
  });
}
