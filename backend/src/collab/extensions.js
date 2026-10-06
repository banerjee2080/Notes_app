import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { InlineMath, BlockMath } from "./mathNodes.js";

const LANGUAGE_PREFIX = "language-";

// <pre><code class="language-x"> (Tiptap) or <pre class="language-x"> (old
// TinyMCE notes) -> "x". Without the second case, seeding an old note would
// drop every code block's language.
const languageOfElement = (element) => {
  const classes = [
    ...(element.firstElementChild?.classList ?? []),
    ...element.classList,
  ];
  const match = classes.find((c) => c.startsWith(LANGUAGE_PREFIX));
  return match ? match.slice(LANGUAGE_PREFIX.length) : null;
};

// Same attributes as frontend/src/components/code/noteCodeBlock.ts (the
// frontend version also adds Prism highlighting, which is display-only).
const NoteCodeBlock = CodeBlock.extend({
  addAttributes() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      language: { ...parent.language, parseHTML: languageOfElement },
    };
  },
});

export const editorExtensions = [
  StarterKit.configure({ undoRedo: false, codeBlock: false }),
  NoteCodeBlock,
  InlineMath,
  BlockMath,
  Image,
  TableKit,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
];
