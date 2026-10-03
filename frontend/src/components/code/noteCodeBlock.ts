// The editor's code block: Tiptap's CodeBlock plus Prism syntax highlighting.
//
// The language lives in the node's `language` attribute (rendered as
// <pre><code class="language-cpp">), using the same Prism names the code
// editor hands back. Highlighting is drawn with ProseMirror decorations, so
// the token <span>s are display-only and never enter the shared Yjs document.
//
// Keep the attributes in step with backend/src/collab/extensions.js.
import type { Attributes } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
// Registers every language the code editor offers on the global Prism.
import Prism from "../../lib/code/prism/index";

const LANGUAGE_PREFIX = "language-";

// <pre><code class="language-x"> (Tiptap) or <pre class="language-x"> (old
// TinyMCE notes) -> "x".
const languageOfElement = (element: HTMLElement): string | null => {
  const classes = [
    ...(element.firstElementChild?.classList ?? []),
    ...element.classList,
  ];
  const match = classes.find((c) => c.startsWith(LANGUAGE_PREFIX));
  return match ? match.slice(LANGUAGE_PREFIX.length) : null;
};

// One inline decoration per Prism token. Returns where the tokens end.
const decorateTokens = (
  tokens: (string | Prism.Token)[],
  from: number,
  out: Decoration[],
): number => {
  let pos = from;
  for (const token of tokens) {
    if (typeof token === "string") {
      pos += token.length;
      continue;
    }
    const alias = token.alias ? [token.alias].flat() : [];
    out.push(
      Decoration.inline(pos, pos + token.length, {
        class: ["token", token.type, ...alias].join(" "),
      }),
    );
    if (typeof token.content !== "string") {
      decorateTokens([token.content].flat(), pos, out);
    }
    pos += token.length;
  }
  return pos;
};

const highlight = (doc: PMNode, nodeName: string): DecorationSet => {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== nodeName) return true;
    const grammar = Prism.languages[node.attrs.language as string];
    if (grammar) {
      decorateTokens(Prism.tokenize(node.textContent, grammar), pos + 1, decorations);
    }
    return false; // nothing to highlight inside a code block's text
  });
  return DecorationSet.create(doc, decorations);
};

export const NoteCodeBlock = CodeBlock.extend({
  addAttributes() {
    const parent: Attributes = this.parent?.() ?? {};
    return {
      ...parent,
      language: { ...parent.language, parseHTML: languageOfElement },
    };
  },

  addProseMirrorPlugins() {
    const nodeName = this.name;
    return [
      ...(this.parent?.() ?? []),
      new Plugin<DecorationSet>({
        key: new PluginKey("prismHighlight"),
        state: {
          init: (_, { doc }) => highlight(doc, nodeName),
          apply: (tr, set) =>
            tr.docChanged ? highlight(tr.doc, nodeName) : set.map(tr.mapping, tr.doc),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
