import { InputRule, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MathView from "./MathView";
import { markMathEdit, requestMathEdit } from "./mathEditRequest";

// Equations are atoms holding one attribute: their LaTeX source.
//   <span data-type="inline-math" data-latex="a^2+b^2=c^2">a^2+b^2=c^2</span>
//   <div  data-type="block-math"  data-latex="\int_0^1 x\,dx">\int_0^1 x\,dx</div>
// The LaTeX is also the element's text, so search, previews and old clients
// still see something readable. The schema half of this file (names,
// attributes, parse/render) must match backend/src/collab/mathNodes.js.

export type MathKind = "inline" | "block";

const latexAttribute = {
  latex: {
    default: "",
    parseHTML: (el: HTMLElement) => el.getAttribute("data-latex") ?? el.textContent ?? "",
    renderHTML: (attrs: Record<string, unknown>) => ({ "data-latex": attrs.latex }),
  },
};

// $x^2$ -> inline equation. Both $ must hug the formula, so prices like
// "$5 and $10" stay text. A backslash-escaped \$ never opens one.
const INLINE_DOLLARS = /(^|[^$\\])\$([^$\s](?:[^$\n]*[^$\s\\])?)\$$/;

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => latexAttribute,
  parseHTML: () => [{ tag: 'span[data-type="inline-math"]' }],
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "inline-math" }), node.attrs.latex];
  },
  renderText: ({ node }) => `$${node.attrs.latex}$`,

  addNodeView() {
    return ReactNodeViewRenderer(MathView, { as: "span", className: "math-host" });
  },

  addInputRules() {
    return [
      new InputRule({
        find: INLINE_DOLLARS,
        handler: ({ state, range, match }) => {
          const start = range.from + match[1].length;
          state.tr.replaceWith(start, range.to, this.type.create({ latex: match[2] }));
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return { Enter: () => editSelectedMath(this.editor, this.name) };
  },
});

export const BlockMath = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes: () => latexAttribute,
  parseHTML: () => [{ tag: 'div[data-type="block-math"]' }],
  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "block-math" }), node.attrs.latex];
  },
  renderText: ({ node }) => `$$${node.attrs.latex}$$`,

  addNodeView() {
    return ReactNodeViewRenderer(MathView, { className: "math-host" });
  },

  addInputRules() {
    // "$$" then space at the start of an empty line -> a display equation.
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          // Only when "$$ " is the whole line. (Tiptap may or may not have
          // inserted the typed space yet; the range covers it either way.)
          const $from = state.doc.resolve(range.from);
          if (range.from !== $from.start() || range.to < $from.end()) return null;
          const at = $from.before();
          state.tr.replaceWith(at, $from.after(), this.type.create());
          markMathEdit(this.editor, at);
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return { Enter: () => editSelectedMath(this.editor, this.name) };
  },
});

// Enter on a selected equation opens it, so it never needs the mouse.
function editSelectedMath(editor: Editor, typeName: string): boolean {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== typeName) return false;
  if (!editor.isEditable) return false;
  requestMathEdit(editor, selection.from);
  return true;
}

/**
 * Inserts an equation at the caret and opens its editor. With text selected
 * inside one line, the selection becomes the equation's LaTeX.
 */
export function insertMath(editor: Editor, kind: MathKind, latex = ""): void {
  if (!editor.isEditable) return;
  const { state } = editor;
  const { selection, schema } = state;
  const type = schema.nodes[kind === "inline" ? "inlineMath" : "blockMath"];
  const picked =
    !latex && !selection.empty && selection.$from.sameParent(selection.$to)
      ? state.doc.textBetween(selection.from, selection.to, " ")
      : "";
  const node = type.create({ latex: latex || picked });
  const tr = state.tr;
  let at: number;

  if (kind === "inline") {
    at = selection.from;
    tr.replaceSelectionWith(node, false);
  } else {
    const $from = selection.$from;
    const emptyLine = $from.depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0;
    if (emptyLine) {
      at = $from.before();
      tr.replaceWith(at, $from.after(), node);
    } else {
      at = $from.depth > 0 ? $from.after(1) : $from.pos;
      tr.insert(at, node);
    }
  }

  // A filled-in equation (selection, triple finder) only needs the caret
  // put after it; an empty one opens straight away.
  if (node.attrs.latex) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(at + node.nodeSize)));
    editor.view.dispatch(tr.scrollIntoView());
    editor.view.focus();
    return;
  }
  markMathEdit(editor, at);
  editor.view.dispatch(tr.scrollIntoView());
}

export const MathExtensions = [InlineMath, BlockMath];
