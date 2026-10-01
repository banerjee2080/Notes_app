import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import ConfirmModal from "../components/ConfirmModal";
import toast from "react-hot-toast";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Tiny from "../components/Tiny";
import CodeWindow from "../components/ui/CodeWindow";
import SaveStatus, { type SavingState } from "../components/ui/SaveStatus";
import EditorFooter from "../components/ui/EditorFooter";
import CodeSpinner from "../components/ui/CodeSpinner";
import { toFileName, timeAgo } from "../lib/utils";
import { useDebounce } from "../hooks/useDebounce";
import { useCloseShortcut } from "../hooks/useCloseShortcut";
import {
  useKeyShortcut,
  useOpenNewNote,
  isDeleteNoteShortcut,
  isFocusTitleShortcut,
  DELETE_NOTE_SHORTCUT_LABEL,
} from "../hooks/useKeyShortcut";
import { localDB } from "../lib/db";
import api from "../lib/axios";
import { useAuthStore } from "../stores/useAuthStore";
import { triggerSync, registerBackgroundSync } from "../lib/syncEngine";
import {
  encryptData,
  decryptData,
  encryptHtml,
  decryptHtml,
} from "../lib/crypto";
import { sanitizeHtml } from "../lib/sanitize";
import { errorStatus, asApiError } from "../lib/errors";
import { userIdOf } from "../types/user";
import type { DecryptedNote, Note } from "../types/notes";

const NotePage = ({ isModal }: { isModal?: boolean }) => {
  // Empty until the note is read (and decrypted) from IndexedDB.
  const [note, setNote] = useState<Partial<DecryptedNote>>({});
  const [saving, setSaving] = useState<SavingState>(false);
  const [loading, setLoading] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const isInit = useRef(true);
  const isDeleting = useRef(false);
  const debouncedTitle = useDebounce(note.title, 500);
  const debouncedContent = useDebounce(note.content, 500);

  // The route is /note/:id, so this is always present; "" just falls
  // through to the "not found" branch below.
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, checkPin, cryptoKey } = useAuthStore();

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
    const fetchNote = async () => {
      try {
        const res = await localDB.notes.get(id);
        if (res && !res.is_deleted) {
          
          // Check if the note is encrypted
          if (res.iv_title || res.iv_content) {
            
            // Only decrypt and set state if the key is ready
            if (cryptoKey) {
              const title = res.iv_title ? await decryptData(res.title, res.iv_title, cryptoKey) : res.title;
              const content = res.iv_content
                ? await decryptHtml(res.content, res.iv_content, cryptoKey)
                : sanitizeHtml(res.content);
              setNote({ ...res, title, content });
              setLoading(false);
            }
            // CRITICAL: If cryptoKey is missing, do NOT call setNote.
            // Just wait. The verifyPin effect will handle the PIN prompt, 
            // and this effect will re-run once cryptoKey is available.
            
          } else {
            setNote(res);
            setLoading(false);
          }
        } else {
          toast.error("Note not found or deleted");
          navigate("/");
        }
      } catch (error) {
        console.log("Error in fetching note locally", error);
        toast.error("Error while fetching notes");
        setLoading(false);
      }
    };
    fetchNote();
  }, [id, navigate, cryptoKey]); // <-- cryptoKey MUST be in this array

  useEffect(() => {
    if (isInit.current) {
      isInit.current = false;
      return;
    }

    if (debouncedContent === undefined || debouncedTitle === undefined) return;

    const autoSaveNote = async () => {
      if (!note.id || isDeleting.current) return;
      if (debouncedTitle === undefined || debouncedContent === undefined) return;

      setSaving(true);
      try {
        let encTitle = debouncedTitle;
        let encContent = sanitizeHtml(debouncedContent);
        let ivTitle = note.iv_title;
        let ivContent = note.iv_content;

        if (cryptoKey) {
          const encT = await encryptData(debouncedTitle, cryptoKey);
          encTitle = encT.ciphertext;
          ivTitle = encT.iv;

          const encC = await encryptHtml(debouncedContent, cryptoKey);
          encContent = encC.ciphertext;
          ivContent = encC.iv;
        }

        const updatedNote: Note = {
          ...(note as DecryptedNote),
          title: encTitle,
          content: encContent,
          iv_title: ivTitle,
          iv_content: ivContent,
          updated_at: new Date().toISOString(),
          sync_status: "pending_update",
        };

        await localDB.notes.update(note.id, updatedNote);
        setSaving("saved");
        setTimeout(() => setSaving(""), 2000);

        if (authUser) {
          try {
            await api.post("/notes/upsert", updatedNote, {
              adapter: "fetch",
            });
            await localDB.notes.update(note.id, { sync_status: "synced" });
          } catch (e) {
            // A response means the server answered with an error; no response
            // means the network is actually down.
            const status = errorStatus(e);
            if (status === 429) {
              const wait =
                asApiError(e)?.response?.headers?.["retry-after"] ?? "a few";
              console.warn(`Server is rate-limiting saves - retrying in ${wait}s via background sync`);
            } else if (status) {
              console.warn(`Save failed (HTTP ${status}) - queued for background sync`);
            } else {
              console.log("Offline: Note edit queued for background sync");
            }
            const userId = userIdOf(authUser);
            if (userId) registerBackgroundSync(userId);
          }
        }
      } catch (error) {
        setSaving("Saving failed..");
        console.error("Error saving note locally: ", error);
      }
    };

    autoSaveNote();
  }, [debouncedTitle, debouncedContent, note.id, authUser]);

  const requestDelete = () => {
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    isDeleting.current = true;
    try {
      await localDB.notes.update(id, {
        is_deleted: true,
        updated_at: new Date().toISOString(),
        sync_status: "pending_update",
      });

      if (authUser) {
        triggerSync(userIdOf(authUser));
      }

      toast.success("Note Deleted");
      navigate("/");
    } catch (error) {
      console.log("Error in Deleting the Note ", error);
      toast.error("Error in deleting note");
    }
  };

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex justify-center items-start md:items-center ide-backdrop p-3 md:p-6 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  const close = () => navigate("/");
  useCloseShortcut(close); // Ctrl+Shift+X
  // Ctrl+D -> same confirm dialog as the "delete note" button (Enter confirms).
  useKeyShortcut(isDeleteNoteShortcut, requestDelete, !loading && !isConfirmModalOpen);
  // Ctrl+N (Alt+N) is handled app-wide; this copy is for keys typed inside TinyMCE.
  const openNewNote = useOpenNewNote();
  // Ctrl+T (Alt+T) -> cursor to the end of the title. Ctrl+Shift+T (content)
  // and Ctrl+Shift+C (code editor) live in Tiny, which owns the editor.
  const titleRef = useRef<HTMLInputElement>(null);
  const focusTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };
  useKeyShortcut(isFocusTitleShortcut, focusTitle, !loading && !isConfirmModalOpen);

  if (loading) {
    return (
      <div
        className={
          isModal
            ? "fixed inset-0 z-50 flex justify-center items-center ide-backdrop"
            : "min-h-screen flex justify-center items-center"
        }
      >
        <CodeSpinner label="Decrypting with AES-GCM…" />
      </div>
    );
  }
  return (
    <div className={containerClasses} onClick={() => isModal && close()}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <CodeWindow
          fileName={toFileName(note.title)}
          status={<SaveStatus saving={saving} />}
          onClose={close}
          actions={
            <>
              <Link to="/" className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs">
                <ArrowLeftIcon className="size-3.5" />
                <span className="hidden sm:inline">cd ..</span>
              </Link>
              <button
                type="button"
                onClick={requestDelete}
                title={`Delete note (${DELETE_NOTE_SHORTCUT_LABEL})`}
                className="ide-btn ide-btn-danger !py-1 !px-2 text-xs"
              >
                <Trash2Icon className="size-3.5" />
                <span>
                  <span className="tok-kw">delete</span> note
                </span>
              </button>
            </>
          }
        >
          <p className="text-[12px] tok-com mb-4">
            {"// last modified "}
            {timeAgo(note.updated_at)}
            {" · autosaves as you type"}
          </p>
          <div className="space-y-5">
          <label className="flex items-center gap-2 border-b ide-divider focus-within:border-[var(--kw)] transition-colors pb-2">
            <span className="tok-kw text-[15px] shrink-0">const</span>
            <span className="text-[var(--fg)] text-[15px] shrink-0">title</span>
            <span className="tok-punc text-[15px] shrink-0">=</span>
            <span className="flex items-center min-w-0">
            <span className="tok-str text-lg shrink-0">"</span>
            <input
              ref={titleRef}
              type="text"
              value={note.title || ""}
              placeholder="Untitled note"
              onChange={(e) => {
                setNote({ ...note, title: e.target.value });
              }}
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
              value={note.content || ""}
              onEditorChange={(newContent) => {
                setNote({ ...note, content: newContent });
              }}
              placeholder="// start typing… encrypted before it's saved"
              onCloseShortcut={close}
              onDeleteShortcut={requestDelete}
              onNewShortcut={openNewNote}
              onTitleShortcut={focusTitle}
            />
          </div>
          <EditorFooter />
        </CodeWindow>
      </div>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeDelete}
        title="Delete Note"
        message="This note moves to RecycleBin() and is garbage-collected after 30 days. Continue?"
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default NotePage;
