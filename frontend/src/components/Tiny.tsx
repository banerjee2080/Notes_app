import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Bookmark, Editor as TinyMCEEditor } from "tinymce";
import { isCloseShortcut } from "../hooks/useCloseShortcut";
import { isDeleteNoteShortcut, isNewNoteShortcut } from "../hooks/useKeyShortcut";
import { Editor } from "@tinymce/tinymce-react";
import { useAuthStore } from "../stores/useAuthStore";
import { languageFromClass, lastLanguageId } from "../lib/code/languages";
// Registers window.Prism with Go/Kotlin/TS/JSON support for code blocks.
import Prism from "../lib/code/prism/index";
// Font files for the editor iframe (it can't see fonts loaded by the page).
import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import monoFont from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";

// The code editor (CodeMirror, formatters, runner client) is only
// downloaded the first time someone opens a code block.
const CodeEditorModal = lazy(() => import("./code/CodeEditorModal"));

// Same test TinyMCE's codesample plugin uses: <pre class="language-...">
//
// Don't use `node instanceof Element` here. TinyMCE's content lives in an
// <iframe>, and every iframe has its own copy of the DOM classes, so a <pre>
// inside the editor is an instance of the *iframe's* Element, not this page's.
// `instanceof` was false for every code block, the double-click handler bailed
// out, and the codesample plugin's old dialog opened instead. Checking
// nodeType works for nodes from any document.
const codeSampleOf = (node: unknown): HTMLPreElement | null => {
  const el = node as Element | null | undefined;
  if (!el || el.nodeType !== 1 /* Node.ELEMENT_NODE */) return null;
  return el.closest<HTMLPreElement>('pre[class*="language-"]');
};

interface TinyProps {
  value: string;
  onEditorChange: (content: string) => void;
  placeholder: string;
  /** Ctrl+Shift+X inside the editor iframe closes the note window. */
  onCloseShortcut: () => void;
  /** Ctrl+D inside the editor — delete the open note (omit to leave Ctrl+D alone). */
  onDeleteShortcut?: () => void;
  /** Ctrl+N / Alt+N inside the editor — open a new note. */
  onNewShortcut?: () => void;
}

/** What the lazily-loaded code editor dialog is opened with. */
interface CodeDialogState {
  code: string;
  languageId: string;
  isEdit: boolean;
}

export default function Tiny({
  value,
  onEditorChange,
  placeholder,
  onCloseShortcut,
  onDeleteShortcut,
  onNewShortcut,
}: TinyProps) {
  const { authUser, themeMode } = useAuthStore();
  const isDark = themeMode !== "light";

  // Set while the code editor dialog is open.
  const [codeDialog, setCodeDialog] = useState<CodeDialogState | null>(null);
  // The TinyMCE editor, the <pre> being edited, and where the caret was.
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const targetRef = useRef<{
    node: HTMLPreElement | null;
    bookmark: Bookmark | null;
  }>({ node: null, bookmark: null });
  // TinyMCE's setup() runs once, so it reads the latest callback through a ref.
  const closeShortcutRef = useRef(onCloseShortcut);
  const deleteShortcutRef = useRef(onDeleteShortcut);
  const newShortcutRef = useRef(onNewShortcut);
  useEffect(() => {
    closeShortcutRef.current = onCloseShortcut;
    deleteShortcutRef.current = onDeleteShortcut;
    newShortcutRef.current = onNewShortcut;
  });

  const openCodeEditor = (
    editor: TinyMCEEditor,
    pre: HTMLPreElement | null = codeSampleOf(editor.selection.getNode()),
  ) => {
    targetRef.current = { node: pre, bookmark: editor.selection.getBookmark(2, true) };
    setCodeDialog({
      code: pre ? (pre.textContent ?? "") : "",
      languageId: (pre && languageFromClass(pre.className)?.id) || lastLanguageId(),
      isEdit: !!pre,
    });
  };

  const closeCodeEditor = () => {
    setCodeDialog(null);
    editorRef.current?.focus();
  };

  // Mirrors codesample's own insertCodeSample(), so its Prism highlighting
  // and <pre><code> serialisation keep working unchanged.
  const saveCode = (prismLanguage: string, code: string) => {
    const editor = editorRef.current;
    setCodeDialog(null);
    if (!editor) return;
    const { node, bookmark } = targetRef.current;
    const dom = editor.dom;
    editor.focus();
    editor.undoManager.transact(() => {
      if (node && editor.getBody().contains(node)) {
        dom.setAttrib(node, "class", `language-${prismLanguage}`);
        node.innerHTML = dom.encode(code);
        Prism.highlightElement(node);
        editor.selection.select(node);
      } else {
        if (bookmark) editor.selection.moveToBookmark(bookmark);
        editor.insertContent(`<pre id="__new" class="language-${prismLanguage}">${dom.encode(code)}</pre>`);
        const inserted = dom.select("#__new")[0];
        if (inserted) {
          dom.setAttrib(inserted, "id", null);
          editor.selection.select(inserted);
        }
      }
    });
    editor.nodeChanged();
  };

  // The editor lives in an iframe, so it can't see our CSS variables.
  // Read the resolved token values once per theme and inline them.
  const css = (name: string, fallback: string): string => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const fg = css("--fg", isDark ? "#d8dce3" : "#22272e");
  const kw = css("--kw", "#c792ea");
  const fn = css("--fn", "#82aaff");
  const str = css("--str", "#a8d88a");
  const panel = css("--panel-2", isDark ? "#272c34" : "#e8ebef");
  const com = css("--com", "#6f7a8c");
  const num = css("--num", "#f7a072");
  const editorBg = isDark ? "#16191e" : "#ffffff";

  return (
    <div className="tinymce-wrapper overflow-hidden border ide-divider rounded-md bg-[var(--win)]">
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
      <Editor
        key={`${themeMode}-${authUser?.main_colour}-${authUser?.accent_colour}`}
        tinymceScriptSrc="/tinymce/js/tinymce/tinymce.min.js"
        value={value}
        onEditorChange={onEditorChange}
        init={{
          placeholder: placeholder,
          skin: isDark ? "oxide-dark" : "oxide",
          content_css: isDark ? "dark" : "default",
          min_height: 340,
          menubar: false,
          promotion: false,
          plugins: [
            "anchor",
            "autolink",
            "charmap",
            "codesample",
            "emoticons",
            "image",
            "link",
            "lists",
            "searchreplace",
            "table",
            "visualblocks",
            "wordcount",
          ],
          // Use the window.Prism imported above (more languages than the
          // copy bundled inside the plugin).
          codesample_global_prismjs: true,
          setup: (editor: TinyMCEEditor) => {
            editorRef.current = editor;
            // Keys pressed inside the editor iframe don't reach the page's
            // window listeners (useCloseShortcut / useKeyShortcut), so catch
            // Ctrl+Shift+X, Ctrl+D and Ctrl+N / Alt+N here.
            editor.on("keydown", (e) => {
              const run = isCloseShortcut(e)
                ? closeShortcutRef.current
                : isDeleteNoteShortcut(e)
                  ? deleteShortcutRef.current
                  : isNewNoteShortcut(e)
                    ? newShortcutRef.current
                    : undefined;
              if (!run || e.repeat) return;
              e.preventDefault();
              run();
            });
            // Double-click a code block -> our editor. Registered in setup,
            // i.e. before the codesample plugin's own handler, so stopping
            // propagation keeps the old dialog from opening too.
            editor.on("dblclick", (e) => {
              const pre = codeSampleOf(e.target);
              if (!pre) return;
              e.preventDefault();
              e.stopImmediatePropagation();
              openCodeEditor(editor, pre);
            });
            // The toolbar button and menu item run the "codesample" command.
            // Plugins register commands before "init" fires, so this
            // replaces the plugin's version with ours.
            editor.on("init", () => {
              editor.addCommand("codesample", () => {
                const pre = codeSampleOf(editor.selection.getNode());
                if (editor.selection.isCollapsed() || pre) openCodeEditor(editor, pre);
                else editor.formatter.toggle("code"); // selected text -> inline <code>
              });
            });
          },
          toolbar:
            "undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image table | align lineheight | numlist bullist indent outdent | codesample emoticons charmap | removeformat",
          content_style: `
            @font-face {
              font-family: 'Inter Variable'; font-style: normal; font-weight: 100 900; font-display: swap;
              src: url('${interFont}') format('woff2-variations');
            }
            @font-face {
              font-family: 'JetBrains Mono Variable'; font-style: normal; font-weight: 100 900; font-display: swap;
              src: url('${monoFont}') format('woff2-variations');
            }
            :root { color-scheme: ${isDark ? "dark" : "light"}; }
            html, body { background: ${editorBg} !important; }
            body {
              color: ${fg} !important;
              font-family: 'Inter Variable', system-ui, sans-serif !important;
              font-size: 15px; line-height: 1.7; margin: 18px 22px;
              caret-color: ${kw};
            }
            ::selection { background: color-mix(in srgb, ${kw} 35%, transparent); }
            a { color: ${fn} !important; }
            h1, h2, h3 { color: ${fg}; }
            h1::before, h2::before, h3::before { content: "# "; color: ${kw}; opacity: .6; }
            code, pre { font-family: 'JetBrains Mono Variable', monospace; background: ${panel}; border-radius: 4px; padding: 0 4px; color: ${str}; }
            pre { padding: 10px 12px; cursor: pointer; }
            pre[class*="language-"]:hover { outline: 1px dashed ${com}; outline-offset: 2px; }
            .token.comment, .token.prolog, .token.doctype, .token.cdata { color: ${com}; font-style: italic; }
            .token.keyword, .token.boolean, .token.important, .token.atrule { color: ${kw}; }
            .token.function, .token.class-name, .token.builtin { color: ${fn}; }
            .token.string, .token.char, .token.attr-value, .token.regex { color: ${str}; }
            .token.number, .token.constant { color: ${num}; }
            .token.operator, .token.punctuation { color: ${com}; }
            blockquote { border-left: 3px solid ${kw}; margin-left: 0; padding-left: 12px; color: ${com}; font-style: italic; }
            .mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before {
              color: ${com} !important; font-family: 'JetBrains Mono Variable', monospace; font-style: italic;
            }
          `,
          // Belt-and-braces: TinyMCE strips most of these itself, but an
          // explicit policy means the editor and lib/sanitize.js cannot drift.
          // The "media" plugin was removed above - it inserts <iframe>/<video>
          // embeds that the sanitizer strips anyway, so it was a toolbar button
          // that silently discarded the user's work.
          invalid_elements: "script,style,iframe,object,embed,form,input,button",
          extended_valid_elements: "",
          allow_script_urls: false,
          allow_html_in_named_anchor: false,
          convert_unsafe_embeds: true,
          sandbox_iframes: true,

          images_upload_handler: async (blobInfo: {
            blob: () => Blob;
            base64: () => string;
          }) => {
            // Since the backend processes HTML base64 images during sync,
            // we just convert the image to base64 directly and insert it into the editor.
            return "data:" + blobInfo.blob().type + ";base64," + blobInfo.base64();
          },
        }}
      />
    </div>
  );
}
