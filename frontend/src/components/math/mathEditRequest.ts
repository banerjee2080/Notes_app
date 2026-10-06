import type { Editor } from "@tiptap/core";

// Which equation should open its editor as soon as its view mounts (a new
// one) or sees the next transaction (an existing one). Per editor, local only.
const pendingEdit = new WeakMap<Editor, number>();

/** Marks the equation at `pos` to open; the caller dispatches the transaction. */
export function markMathEdit(editor: Editor, pos: number): void {
  pendingEdit.set(editor, pos);
}

/** Asks the existing equation at `pos` to open its editor. */
export function requestMathEdit(editor: Editor, pos: number): void {
  pendingEdit.set(editor, pos);
  editor.view.dispatch(editor.state.tr.setMeta("mathEdit", pos));
}

/** Called by each equation's view; true once, for the one that was asked. */
export function takeMathEdit(editor: Editor, pos: number | undefined): boolean {
  if (pos === undefined || pendingEdit.get(editor) !== pos) return false;
  pendingEdit.delete(editor);
  return true;
}
