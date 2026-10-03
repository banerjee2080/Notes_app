import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
// The schema below must match backend/src/collab/extensions.js, or the server
// drops content the browser shows (and vice versa).
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import {
  ySyncPluginKey,
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
} from "@tiptap/y-tiptap";
import toast from "react-hot-toast";
import api from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { languageFromClass, lastLanguageId } from "../lib/code/languages";
import {
  isCodeEditorShortcut,
  isFocusContentShortcut,
  useKeyShortcut,
} from "../hooks/useKeyShortcut";
import { NoteCodeBlock } from "./code/noteCodeBlock";
import type { CollabSession } from "../hooks/useCollabNote";

// The code editor (CodeMirror, formatters, runner client) is only
// downloaded the first time someone opens a code block.
const CodeEditorModal = lazy(() => import("./code/CodeEditorModal"));

interface CollabEditorProps {
  session: CollabSession;
  /** How this user's cursor looks to everyone else. */
  user: { name: string; color: string };
  editable: boolean;
  placeholder: string;
  /** Called with the editor's HTML after every local or remote change. */
  onHtmlChange: (html: string) => void;
}

/** What the lazily-loaded code editor dialog is opened with. */
interface CodeDialogState {
  code: string;
  languageId: string;
  isEdit: boolean;
}

// Where the code goes back to when the dialog saves. Other people keep
// editing while the dialog is open, so a plain position number would drift;
// a Yjs relative position stays attached to the same characters.
interface CodeAnchor {
  relative: unknown;
  absolute: number;
}

const toAnchor = (state: EditorState, pos: number): CodeAnchor => {
  const y = ySyncPluginKey.getState(state);
  return {
    relative: y?.binding ? absolutePositionToRelativePosition(pos, y.type, y.binding.mapping) : null,
    absolute: pos,
  };
};

const fromAnchor = (state: EditorState, anchor: CodeAnchor): number => {
  const y = ySyncPluginKey.getState(state);
  if (anchor.relative && y?.binding) {
    const pos = relativePositionToAbsolutePosition(y.doc, y.type, anchor.relative, y.binding.mapping);
    if (pos !== null) return pos;
  }
  return Math.min(anchor.absolute, state.doc.content.size);
};

// data: URL, the format /notes/uploadImage expects.
const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

interface ToolbarButtonProps {
  label: string;
  run: () => void;
  disabled: boolean;
  title?: string;
}

const ToolbarButton = ({ label, run, disabled, title }: ToolbarButtonProps) => (
  <button
    type="button"
    // Keep the caret/selection in the editor when the button is pressed.
    onMouseDown={(e) => e.preventDefault()}
    onClick={run}
    disabled={disabled}
    title={title}
    className="ide-btn ide-btn-ghost !py-0.5 !px-2 text-xs"
  >
    {label}
  </button>
);

export default function CollabEditor({
  session,
  user,
  editable,
  placeholder,
  onHtmlChange,
}: CollabEditorProps) {
  // The editor is created once per session, so it reads the latest callbacks through refs.
  const onHtmlChangeRef = useRef(onHtmlChange);
  useEffect(() => {
    onHtmlChangeRef.current = onHtmlChange;
  });
  const fileInput = useRef<HTMLInputElement>(null);

  // Set while the code editor dialog is open.
  const [codeDialog, setCodeDialog] = useState<CodeDialogState | null>(null);
  const anchorRef = useRef<CodeAnchor | null>(null);

  // Opens the code editor on the code block at `pos` (edit), or for a new
  // block at `pos` when it isn't inside one.
  const openCodeEditor = (ed: Editor, pos = ed.state.selection.from) => {
    if (!ed.isEditable) return;
    const $pos = ed.state.doc.resolve(pos);
    const block = $pos.parent.type.name === "codeBlock" ? $pos.parent : null;
    // Anchor inside the block's text, so the anchor goes wherever the block goes.
    anchorRef.current = toAnchor(ed.state, block ? $pos.start() : pos);
    const language = block?.attrs.language as string | null | undefined;
    setCodeDialog({
      code: block ? block.textContent : "",
      languageId: (language && languageFromClass(`language-${language}`)?.id) || lastLanguageId(),
      isEdit: !!block,
    });
  };
  const openCodeEditorRef = useRef(openCodeEditor);
  useEffect(() => {
    openCodeEditorRef.current = openCodeEditor;
  });
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor(
    {
      editable,
      extensions: [
        // Collaboration brings its own per-user undo, so the normal one is off.
        // The code block is replaced by NoteCodeBlock (adds Prism highlighting).
        StarterKit.configure({ undoRedo: false, codeBlock: false }),
        NoteCodeBlock,
        Image,
        TableKit,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder }),
        // "default" must match FIELD in backend/collab.js.
        Collaboration.configure({ document: session.ydoc, field: "default" }),
        // Live cursors need awareness from the provider; encrypted notes
        // don't have one (cursor positions would leak document structure).
        ...(session.provider ? [CollaborationCaret.configure({ provider: session.provider, user })] : []),
      ],
      editorProps: {
        // Double-click a code block -> the code editor (same as with TinyMCE).
        handleDoubleClick: (view, pos) => {
          if (view.state.doc.resolve(pos).parent.type.name !== "codeBlock") return false;
          const ed = editorRef.current;
          if (ed) openCodeEditorRef.current(ed, pos);
          return true;
        },
      },
      onUpdate: ({ editor }) => onHtmlChangeRef.current(editor.getHTML()),
    },
    [session],
  );
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  const hasCarets = !!session.provider;
  useEffect(() => {
    if (hasCarets) editor?.commands.updateUser(user);
  }, [editor, user, hasCarets]);

  // Ctrl+Shift+T jumps into the content, Ctrl+Shift+C opens the code editor
  // at the caret. Tiptap isn't in an iframe, so window listeners see these
  // keys even while typing in the editor.
  useKeyShortcut(isFocusContentShortcut, () => editor?.commands.focus(), !codeDialog);
  useKeyShortcut(
    isCodeEditorShortcut,
    () => {
      if (editor) openCodeEditor(editor);
    },
    !codeDialog && editable,
  );

  // The </> button: selected text -> inline code; otherwise the code editor.
  const codeButton = () => {
    if (!editor) return;
    const { selection } = editor.state;
    if (selection.empty || selection.$from.parent.type.name === "codeBlock") openCodeEditor(editor);
    else editor.chain().focus().toggleCode().run();
  };

  const closeCodeEditor = () => {
    setCodeDialog(null);
    anchorRef.current = null;
    editor?.commands.focus();
  };

  // Writes the dialog's code back: replaces the block it was opened on, or
  // inserts a new block at the anchor (also if someone deleted the original
  // meanwhile, so the work isn't lost).
  const saveCode = (prismLanguage: string, code: string) => {
    const anchor = anchorRef.current;
    const isEdit = codeDialog?.isEdit ?? false;
    setCodeDialog(null);
    anchorRef.current = null;
    if (!editor || !anchor) return;

    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const { codeBlock } = state.schema.nodes;
        const node = codeBlock.create({ language: prismLanguage }, code ? state.schema.text(code) : undefined);
        const $pos = state.doc.resolve(fromAnchor(state, anchor));
        let start: number;

        if (isEdit && $pos.parent.type === codeBlock) {
          start = $pos.before();
          tr.replaceWith(start, $pos.after(), node);
        } else if ($pos.depth > 0 && $pos.parent.isTextblock && $pos.parent.content.size === 0) {
          // The caret is on an empty line: turn that line into the code block.
          start = $pos.before();
          tr.replaceWith(start, $pos.after(), node);
        } else {
          // Otherwise add it after the block the caret is in.
          start = $pos.depth > 0 ? $pos.after() : $pos.pos;
          tr.insert(start, node);
        }
        tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)));
        return true;
      })
      .run();
  };

  // Upload to Cloudinary and insert the URL, so the Yjs doc never carries base64.
  const insertImage = async (file: File) => {
    if (!editor) return;
    try {
      const { data } = await api.post<{ secure_url: string }>(
        "/notes/uploadImage",
        { image: await toDataUrl(file) },
      );
      editor.chain().focus().setImage({ src: data.secure_url }).run();
    } catch (e) {
      toast.error(errorMessage(e, "Image upload failed"));
    }
  };

  if (!editor) return null;

  const off = !editable;

  return (
    <div className="collab-editor overflow-hidden border ide-divider rounded-md bg-[var(--win)]">
      {codeDialog && (
        <Suspense fallback={null}>
          <CodeEditorModal
            initialCode={codeDialog.code}
            initialLanguage={codeDialog.languageId}
            isEdit={codeDialog.isEdit}
            onSave={saveCode}
            onClose={closeCodeEditor}
          />
        </Suspense>
      )}
      <div className="flex flex-wrap gap-1 p-1.5 border-b ide-divider">
        <ToolbarButton label="undo" disabled={off} run={() => editor.chain().focus().undo().run()} />
        <ToolbarButton label="redo" disabled={off} run={() => editor.chain().focus().redo().run()} />
        <ToolbarButton label="B" disabled={off} run={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton label="I" disabled={off} run={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton label="U" disabled={off} run={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarButton label="H2" disabled={off} run={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton label="• list" disabled={off} run={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton label="1. list" disabled={off} run={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton
          label="</>"
          disabled={off}
          run={codeButton}
          title="Code editor (Ctrl+Shift+C) — or inline code for selected text"
        />
        <ToolbarButton
          label="table"
          disabled={off}
          run={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        <ToolbarButton label="image" disabled={off} run={() => fileInput.current?.click()} />
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = ""; // lets the same file be picked again
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
