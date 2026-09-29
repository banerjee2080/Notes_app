import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router";
import ConfirmModal from "../components/ConfirmModal.jsx";
import toast from "react-hot-toast";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Tiny from "../components/Tiny.jsx";
import CodeWindow from "../components/ui/CodeWindow.jsx";
import SaveStatus from "../components/ui/SaveStatus.jsx";
import EditorFooter from "../components/ui/EditorFooter.jsx";
import CodeSpinner from "../components/ui/CodeSpinner.jsx";
import { toFileName, timeAgo } from "../lib/utils.js";
import { useDebounce } from "../hooks/useDebounce.js";
import { useCloseShortcut } from "../hooks/useCloseShortcut.js";
import { localDB } from "../lib/db.js";
import api from "../lib/axios.js";
import { useAuthStore } from "../stores/useAuthStore.js";
import { triggerSync, registerBackgroundSync } from "../lib/syncEngine.js";
import {
  encryptData,
  decryptData,
  encryptHtml,
  decryptHtml,
} from "../lib/crypto.js";
import { sanitizeHtml } from "../lib/sanitize.js";

const NotePage = ({ isModal }) => {
  const [note, setNote] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const isInit = useRef(true);
  const isDeleting = useRef(false);
  const debouncedTitle = useDebounce(note.title, 500);
  const debouncedContent = useDebounce(note.content, 500);

  const { id } = useParams();
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

        const updatedNote = {
          ...note,
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
            const status = e.response?.status;
            if (status === 429) {
              const wait = e.response.headers?.["retry-after"] ?? "a few";
              console.warn(`Server is rate-limiting saves - retrying in ${wait}s via background sync`);
            } else if (status) {
              console.warn(`Save failed (HTTP ${status}) - queued for background sync`);
            } else {
              console.log("Offline: Note edit queued for background sync");
            }
            registerBackgroundSync(authUser._id || authUser.id);
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
        triggerSync(authUser._id || authUser.id);
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
