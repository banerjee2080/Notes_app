import { Node, mergeAttributes } from "@tiptap/core";

// Schema half of frontend/src/components/math/mathNodes.ts (the frontend adds
// the KaTeX/MathLive views and input rules, which are display-only). Names,
// attributes and parse/render rules must match, or the server drops every
// equation when it turns the Yjs doc back into HTML.

const latexAttribute = {
  latex: {
    default: "",
    parseHTML: (el) => el.getAttribute("data-latex") ?? el.textContent ?? "",
    renderHTML: (attrs) => ({ "data-latex": attrs.latex }),
  },
};

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
});
