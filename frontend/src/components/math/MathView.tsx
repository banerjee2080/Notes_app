import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { renderLatex, useKatex } from "../../lib/math/katex";
import { takeMathEdit } from "./mathEditRequest";

// MathLive only downloads when an equation is opened.
const MathEditor = lazy(() => import("./MathEditor"));

/** Where the caret goes when the editor closes. */
export type MathExit = "after" | "before" | "stay";

// One equation in the note: KaTeX when at rest, the MathLive editor when
// clicked (or Enter on it, or straight after inserting a new one).
export default function MathView({ node, editor, getPos, selected, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const display = node.type.name === "blockMath";
  const latex = String(node.attrs.latex ?? "");
  const ready = useKatex();
  const [editing, setEditing] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);

  // Open when asked: on mount (just inserted) or on a later transaction.
  useEffect(() => {
    const check = () => {
      if (takeMathEdit(editor, getPos())) setEditing(true);
    };
    check();
    editor.on("transaction", check);
    return () => {
      editor.off("transaction", check);
    };
  }, [editor, getPos]);

  const open = () => {
    if (editor.isEditable) setEditing(true);
  };

  const close = (next: string | null, exit: MathExit) => {
    setEditing(false);
    // Straight back into the note (the editor blurred its field first, so
    // nothing pulls focus away when it unmounts). view.focus() is
    // synchronous; Tiptap's focus command waits for an animation frame.
    // "stay": closed by a click elsewhere, which already placed the caret.
    const refocus = () => {
      if (exit !== "stay") editor.view.focus();
    };
    const value = next ?? latex;
    if (!value.trim()) {
      deleteNode();
      refocus();
      return;
    }
    if (next !== null && next !== latex) updateAttributes({ latex: next });
    const pos = getPos();
    if (pos === undefined || exit === "stay") return;
    editor
      .chain()
      .command(({ tr }) => {
        const target = exit === "after" ? pos + node.nodeSize : pos;
        tr.setSelection(TextSelection.near(tr.doc.resolve(target), exit === "after" ? 1 : -1));
        return true;
      })
      .run();
    refocus();
  };

  const html = latex && ready ? renderLatex(latex, display) : null;

  return (
    <NodeViewWrapper
      as={display ? "div" : "span"}
      className={`math-node ${display ? "math-block" : "math-inline"} ${selected ? "is-selected" : ""} ${editing ? "is-editing" : ""}`}
      data-type={display ? "block-math" : "inline-math"}
    >
      <span
        ref={anchor}
        contentEditable={false}
        onClick={open}
        className="math-render"
        title={editor.isEditable ? "Edit equation (Enter)" : latex}
        role={editor.isEditable ? "button" : undefined}
        aria-label={latex ? `Equation: ${latex}` : "Empty equation"}
      >
        {!latex ? (
          <span className="math-empty">{display ? "equation" : "x"}</span>
        ) : html !== null ? (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <code className="math-source">{latex}</code>
        )}
      </span>
      {editing && (
        <Suspense fallback={null}>
          <MathEditor anchor={anchor} initial={latex} display={display} onClose={close} />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
