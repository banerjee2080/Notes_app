import { ArrowLeftIcon } from "lucide-react";
import CodeWindow from "../components/ui/CodeWindow";
import SaveStatus, { type SavingState } from "../components/ui/SaveStatus";
import EditorFooter from "../components/ui/EditorFooter";
import { toFileName } from "../lib/utils";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import api from "../lib/axios";
import Tiny from "../components/Tiny";
import { useDebounce } from "../hooks/useDebounce";
import { useCloseShortcut } from "../hooks/useCloseShortcut";
import { isFocusTitleShortcut, useKeyShortcut } from "../hooks/useKeyShortcut";
import { v4 as uuidv4 } from "uuid";
import { localDB } from "../lib/db";
import { registerBackgroundSync } from "../lib/syncEngine";
import { encryptData, encryptHtml } from "../lib/crypto";
import { useAuthStore } from "../stores/useAuthStore";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";

const CreatePage = ({ isModal }: { isModal?: boolean }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState<SavingState>(false);

  const navigate = useNavigate();
  const location = useLocation();
  const debouncedTitle = useDebounce(title, 500);
  const debouncedContent = useDebounce(content, 500);
  const isInit = useRef(true);
  const { authUser, checkPin } = useAuthStore();
  
  const [noteId] = useState(() => uuidv4());

  const hasNavigated = useRef(false);
  useEffect(() => {
    let isMounted = true;
    const verifyPin = async () => {
      const isValid = await checkPin();
      if (!isValid && isMounted && !hasNavigated.current) {
        hasNavigated.current = true;
        navigate("/pin", { state: { backgroundLocation: location }, replace: true });
      }
    };
    verifyPin();
    return () => { isMounted = false; };
  }, [checkPin, navigate, location]);

  useEffect(() => {
    if (isInit.current) {
      isInit.current = false;
      return;
    }

    if (!debouncedContent || !debouncedTitle) return;

    const autoSaveNote = async () => {
      const { cryptoKey } = useAuthStore.getState();
      if (!cryptoKey) {
        console.error("No encryption key available in memory.");
        return;
      }

      setSaving(true);
      try {
        const { ciphertext: encTitle, iv: ivTitle } = await encryptData(
          debouncedTitle,
          cryptoKey,
        );
        // encryptHtml sanitizes before encrypting. The server cannot sanitize
        // ciphertext, so this is the only place it can happen.
        const { ciphertext: encContent, iv: ivContent } = await encryptHtml(
          debouncedContent,
          cryptoKey,
        );

        const userId = userIdOf(authUser);
        if (!userId) return;

        const newNote: Note = {
          id: noteId,
          user_id: userId,
          title: encTitle,
          content: encContent,
          iv_title: ivTitle,
          iv_content: ivContent,
          updated_at: new Date().toISOString(),
          is_deleted: false,
          sync_status: "pending_update",
        };

        await localDB.notes.put(newNote);

        setSaving("saved");
        setTimeout(() => setSaving(""), 2000);
        try {
          await api.post("/notes/upsert", newNote, { adapter: "fetch" });
          await localDB.notes.update(noteId, { sync_status: "synced" });
        } catch {
          console.log("Offline: Note queued for background sync");
          registerBackgroundSync(userId);
        }
      } catch (error) {
        setSaving("Saving failed..");
        console.error("Error saving note locally: ", error);
      }
    };

    autoSaveNote();
  }, [debouncedTitle, debouncedContent, noteId]);

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex justify-center items-start md:items-center ide-backdrop p-3 md:p-6 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  const close = () => navigate("/");
  useCloseShortcut(close); // Ctrl+Shift+X
  // Ctrl+T (Alt+T) -> cursor to the end of the title. Ctrl+Shift+T (content)
  // and Ctrl+Shift+C (code editor) live in Tiny, which owns the editor.
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };
  useKeyShortcut(isFocusTitleShortcut, focusTitle);

  return (
    <div className={containerClasses} onClick={() => isModal && close()}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <CodeWindow
          fileName={toFileName(title)}
          status={<SaveStatus saving={saving} />}
          onClose={close}
          actions={
            <Link to="/" className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs">
              <ArrowLeftIcon className="size-3.5" />
              cd ..
            </Link>
          }
        >
          <p className="text-[12px] tok-com mb-4">
            {"// new Note() — autosaves once it has a title and some content"}
          </p>
          <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <label className="flex items-center gap-2 border-b ide-divider focus-within:border-[var(--kw)] transition-colors pb-2">
            <span className="tok-kw text-[15px] shrink-0">const</span>
            <span className="text-[var(--fg)] text-[15px] shrink-0">title</span>
            <span className="tok-punc text-[15px] shrink-0">=</span>
            <span className="flex items-center min-w-0">
            <span className="tok-str text-lg shrink-0">"</span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              placeholder="Untitled note"
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Note title"
              style={{ fieldSizing: "content" }}
              className="min-w-[10ch] max-w-full bg-transparent outline-none text-lg md:text-xl font-semibold tok-str placeholder:text-[var(--fg-dim)] placeholder:font-normal"
            ></input>
            <span className="tok-str text-lg shrink-0">"</span>
            <span className="tok-punc text-[15px] shrink-0">;</span>
            </span>
            <span className="flex-1" />
          </label>
            <Tiny
              value={content}
              onEditorChange={setContent}
              placeholder="// start typing… encrypted before it's saved"
              onCloseShortcut={close}
              onTitleShortcut={focusTitle}
            />
          </form>
          <EditorFooter />
        </CodeWindow>
      </div>
    </div>
  );
};

export default CreatePage;
