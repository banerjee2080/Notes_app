import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeftIcon, LockIcon, LogOutIcon, ShieldCheckIcon, Trash2Icon, UsersIcon } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";
import CollabEditor from "../components/CollabEditor";
import ShareDialog from "../components/ShareDialog";
import PinDialog from "../components/PinDialog";
import CodeWindow from "../components/ui/CodeWindow";
import EditorFooter from "../components/ui/EditorFooter";
import CodeSpinner from "../components/ui/CodeSpinner";
import { toFileName, timeAgo } from "../lib/utils";
import { useCloseShortcut } from "../hooks/useCloseShortcut";
import {
  useKeyShortcut,
  isDeleteNoteShortcut,
  isFocusTitleShortcut,
  DELETE_NOTE_SHORTCUT_LABEL,
} from "../hooks/useKeyShortcut";
import { useCollabNote } from "../hooks/useCollabNote";
import { useEncryptedNote } from "../hooks/useEncryptedNote";
import { localDB } from "../lib/db";
import { deleteCollabCache } from "../lib/collabCache";
import { enableEncryption } from "../lib/noteKeys";
import { useVaultStore } from "../stores/useVaultStore";
import api from "../lib/axios";
import { useAuthStore } from "../stores/useAuthStore";
import { triggerSync } from "../lib/syncEngine";
import { sanitizeHtml } from "../lib/sanitize";
import { errorMessage } from "../lib/errors";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";
import { useMathHtml } from "../lib/math/katex";
import { useCopy, useVoice } from "../lib/voice";
import { Remark } from "../components/ui/Themed";

const CARET_COLORS = ["#f783ac", "#82aaff", "#a8d88a", "#f7a072", "#c792ea", "#ffd166", "#5eead4"];
// Same user -> same cursor colour on every device.
const colorFor = (id: string) =>
  CARET_COLORS[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0) % CARET_COLORS.length];

// True for "", "<p></p>", whitespace-only paragraphs etc. Images, tables and
// rules count as content even though they have no text.
const isBlankHtml = (html: string) =>
  !/<(img|table|hr)\b/i.test(html) &&
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";

const NotePage = ({ isModal }: { isModal?: boolean }) => {
  // The route is /note/:id, so this is always present.
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthStore();
  const myId = userIdOf(authUser) ?? "";

  // The cached IndexedDB record: owner, role and last known HTML. The live
  // title and body come from the shared Yjs document instead.
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const lastHtml = useRef("");
  const mirrorTimer = useRef<number | undefined>(undefined);

  // Plaintext notes sync through Hocuspocus as before; end-to-end encrypted
  // ones through useEncryptedNote (ciphertext only). Exactly one is active.
  const encrypted = !!note?.is_encrypted;
  const plain = useCollabNote(note && !encrypted ? id : "", {
    onEncrypted: () => {
      toast("This note is now end-to-end encrypted", { icon: "🔒" });
      void reloadNoteRef.current();
    },
  });
  const secure = useEncryptedNote(id, { enabled: encrypted, cachedKey: note?.enc_key, myUserId: myId });
  const { session, status, seeded, role, accessLost } = encrypted ? secure : plain;
  const vaultStatus = useVaultStore((s) => s.status);
  const lockVault = useVaultStore((s) => s.lock);
  const [pinOpen, setPinOpen] = useState(false);
  const [afterUnlock, setAfterUnlock] = useState<(() => void) | null>(null);
  const [isEncryptConfirmOpen, setIsEncryptConfirmOpen] = useState(false);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });

  const isOwner = note?.user_id === myId;
  // Live ticket first, then what /sync last said, then a fallback for old rows.
  const effectiveRole = role ?? note?.role ?? (isOwner ? "owner" : "viewer");
  const canEdit = seeded && effectiveRole !== "viewer" && (!encrypted || secure.keyState === "ready");
  const isManager = effectiveRole === "owner" || effectiveRole === "admin";
  const caretUser = useMemo(
    () => ({ name: authUser?.fullName ?? "Anonymous", color: colorFor(myId) }),
    [authUser?.fullName, myId],
  );

  useEffect(() => {
    const fetchNote = async () => {
      try {
        let res = await localDB.notes.get(id);
        if (!res) {
          // Not on this device yet: opened from a shared link, or shared
          // moments ago. The server checks access (joining via the link if
          // it's open) and hands the note over.
          try {
            const { data } = await api.post<{ note: Omit<Note, "sync_status"> }>(
              `/notes/${id}/open`,
            );
            res = { ...data.note, sync_status: "synced" };
            await localDB.notes.put(res);
          } catch {
            res = undefined;
          }
        }
        if (res && !res.is_deleted) {
          setNote(res);
          setTitle(res.title);
          lastHtml.current = res.content;
          setLoading(false);
        } else {
          toast.error("Note not found, or you don't have access");
          navigate("/");
        }
      } catch (error) {
        console.log("Error in fetching note locally", error);
        toast.error("Error while fetching notes");
        setLoading(false);
      }
    };
    fetchNote();
  }, [id, navigate]);

  // Copy the live title + HTML into IndexedDB so the home list stays current.
  // sync_status is left alone: the collab server already saved the change.
  // Encrypted notes skip this: useEncryptedNote stores an encrypted preview instead.
  const scheduleMirror = useCallback(() => {
    if (encrypted) return;
    window.clearTimeout(mirrorTimer.current);
    mirrorTimer.current = window.setTimeout(() => {
      const t = String(sessionRef.current?.ydoc.getMap("meta").get("title") ?? "");
      localDB.notes
        .update(id, {
          title: t,
          content: sanitizeHtml(lastHtml.current),
          updated_at: new Date().toISOString(),
        })
        .catch((e) => console.error("Error mirroring note locally", e));
    }, 800);
  }, [id, encrypted]);
  useEffect(() => () => window.clearTimeout(mirrorTimer.current), []);

  // A note left completely empty (usually "new note" then close) goes to the
  // recycle bin instead of cluttering the list. Owner of an unshared note only.
  const leaveState = useRef({ discardable: false, title: "" });
  const discardTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    leaveState.current = {
      discardable: !!note && isOwner && !note.collaborator_ids?.length,
      title,
    };
  });
  useEffect(() => {
    // The check runs a tick after unmount, and a remount cancels it, so
    // StrictMode's mount -> unmount -> mount in development can't trash a
    // note that was just created.
    window.clearTimeout(discardTimer.current);
    return () => {
      discardTimer.current = window.setTimeout(() => {
        const { discardable, title: lastTitle } = leaveState.current;
        if (!discardable || lastTitle.trim() || !isBlankHtml(lastHtml.current)) return;
        localDB.notes
          .update(id, {
            is_deleted: true,
            updated_at: new Date().toISOString(),
            sync_status: "pending_update",
          })
          .then(() => triggerSync(myId))
          .catch((e) => console.error("Error discarding empty note", e));
      }, 0);
    };
  }, [id, myId]);

  // A brand-new (untitled) note starts with the cursor in the title.
  const autoFocused = useRef(false);
  useEffect(() => {
    if (autoFocused.current || !canEdit || title) return;
    autoFocused.current = true;
    titleRef.current?.focus();
  }, [canEdit, title]);

  // Keep the title input in step with the shared title (mine or anyone's).
  useEffect(() => {
    if (!session || !seeded) return;
    const meta = session.ydoc.getMap("meta");
    const read = () => setTitle(String(meta.get("title") ?? ""));
    read();
    const onChange = () => {
      read();
      scheduleMirror();
    };
    meta.observe(onChange);
    return () => meta.unobserve(onChange);
  }, [session, seeded, scheduleMirror]);

  useEffect(() => {
    if (!accessLost || !note) return;
    if (!isOwner) {
      // Removed from a shared note: drop the stale local copy.
      localDB.notes.delete(id).catch(() => {});
      toast.error("You no longer have access to this note");
      navigate("/");
    } else {
      // The owner's note just hasn't reached the server yet. Push it; the
      // collab hook retries every few seconds and gets in once it lands.
      triggerSync(myId);
    }
  }, [accessLost, note, isOwner, id, myId, navigate]);

  // Reload this note's row from the server (it just became encrypted).
  const reloadNote = useCallback(async () => {
    try {
      const { data } = await api.post<{ note: Omit<Note, "sync_status"> }>(`/notes/${id}/open`);
      const fresh: Note = { ...data.note, sync_status: "synced" };
      await localDB.notes.put(fresh);
      await deleteCollabCache(id); // the plaintext offline copy must go
      setNote(fresh);
    } catch (e) {
      console.error("Could not reload the note", e);
    }
  }, [id]);

  const reloadNoteRef = useRef(reloadNote);
  useEffect(() => {
    reloadNoteRef.current = reloadNote;
  });

  // Runs `next` now if the vault is unlocked, else after the PIN dialog.
  const withVault = (next: () => void) => {
    if (useVaultStore.getState().status === "unlocked") return next();
    setAfterUnlock(() => next);
    setPinOpen(true);
  };

  const encryptNote = async () => {
    const live = sessionRef.current;
    if (!live || !seeded) return;
    const toastId = toast.loading("Encrypting…");
    try {
      const { noteKey, version, withoutPin } = await enableEncryption(id, live.ydoc);
      useVaultStore.getState().rememberNoteKey(id, version, noteKey);
      // Tell everyone still on the plaintext channel to re-open the note.
      live.provider?.sendStateless(JSON.stringify({ t: "encrypted" }));
      const updated: Note = {
        ...note!,
        is_encrypted: true,
        key_version: version,
        title: "",
        content: "",
        enc_preview: null,
        enc_key: null,
      };
      await localDB.notes.put(updated);
      await deleteCollabCache(id);
      setNote(updated);
      toast.success("Note encrypted end-to-end", { id: toastId });
      if (withoutPin.length) {
        toast(`${withoutPin.join(", ")} must set up a PIN to keep reading it`, { icon: "⚠️" });
      }
    } catch (e) {
      toast.error(errorMessage(e, "Could not encrypt the note"), { id: toastId });
    }
  };

  const changeTitle = (value: string) => {
    session?.ydoc.getMap("meta").set("title", value);
  };

  const requestDelete = () => {
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    try {
      if (isOwner) {
        await localDB.notes.update(id, {
          is_deleted: true,
          updated_at: new Date().toISOString(),
          sync_status: "pending_update",
        });
        triggerSync(myId);
        toast.success("Note deleted");
      } else {
        // A collaborator "deleting" a shared note leaves it instead.
        await api.delete(`/notes/${id}/share/${myId}`);
        await localDB.notes.delete(id);
        toast.success("You left the note");
      }
      navigate("/");
    } catch (error) {
      console.log("Error in deleting/leaving the note ", error);
      toast.error(errorMessage(error, "Could not complete that"));
    }
  };

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex justify-center items-start md:items-center ide-backdrop p-3 md:p-6 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  const close = () => navigate("/");
  useCloseShortcut(close); // Ctrl+Shift+X
  // Ctrl+D -> same confirm dialog as the delete/leave button (Enter confirms).
  useKeyShortcut(isDeleteNoteShortcut, requestDelete, !loading && !isConfirmModalOpen);
  // Ctrl+T (Alt+T) -> cursor to the end of the title. Tiptap isn't inside an
  // iframe like TinyMCE was, so these window shortcuts also fire while typing.
  const focusTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };
  useKeyShortcut(isFocusTitleShortcut, focusTitle, !loading && !isConfirmModalOpen);

  const { voice } = useVoice();
  const { isJs, t } = useCopy();
  // The read-only fallback below shows saved HTML, equations rendered.
  const fallbackHtml = useMathHtml(useMemo(() => sanitizeHtml(note?.content), [note?.content]));

  if (loading || !note) {
    return (
      <div
        className={
          isModal
            ? "fixed inset-0 z-50 flex justify-center items-center ide-backdrop"
            : "min-h-screen flex justify-center items-center"
        }
      >
        <CodeSpinner label={t({ js: "Reading from IndexedDB…", common: "Opening the note…", pythagoras: "Unrolling the scroll…" })} />
      </div>
    );
  }

  const statusLabel = !seeded
    ? t({ js: "connecting…", common: "Connecting…" })
    : status === "connected"
      ? encrypted
        ? t({ js: "● live · e2e", common: "● Live · encrypted" })
        : t({ js: "● live", common: "● Live" })
      : t({ js: "offline · saved on this device", common: "Offline · saved on this device" });

  return (
    <div className={containerClasses} onClick={() => isModal && close()}>
      <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <CodeWindow
          fileName={isJs ? toFileName(title) : title.trim() || t({ js: "", common: "Untitled note", pythagoras: "Untitled proposition" })}
          status={<span className="text-[11px] tok-com">{statusLabel}</span>}
          onClose={close}
          actions={
            <>
              <Link to="/" className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs">
                <ArrowLeftIcon className="size-3.5" />
                <span className="hidden sm:inline">{t({ js: "cd ..", common: "Back" })}</span>
              </Link>
              {encrypted ? (
                <button
                  type="button"
                  onClick={() => lockVault()}
                  title="Lock: forget the decryption keys on this device"
                  className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs"
                >
                  <LockIcon className="size-3.5" />
                  <span className="hidden sm:inline">{t({ js: "lock", common: "Lock" })}</span>
                </button>
              ) : (
                isManager &&
                seeded && (
                  <button
                    type="button"
                    onClick={() => withVault(() => setIsEncryptConfirmOpen(true))}
                    title="Encrypt end-to-end: only people on this note can read it, not the server"
                    className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs"
                  >
                    <ShieldCheckIcon className="size-3.5" />
                    <span className="hidden sm:inline">{t({ js: "encrypt", common: "Encrypt", pythagoras: "Seal" })}</span>
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setIsShareOpen(true)}
                title="Share note"
                className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs"
              >
                <UsersIcon className="size-3.5" />
                <span>{t({ js: "share", common: "Share" })}</span>
              </button>
              <button
                type="button"
                onClick={requestDelete}
                title={`${isOwner ? "Delete" : "Leave"} note (${DELETE_NOTE_SHORTCUT_LABEL})`}
                className="ide-btn ide-btn-danger !py-1 !px-2 text-xs"
              >
                {isOwner ? <Trash2Icon className="size-3.5" /> : <LogOutIcon className="size-3.5" />}
                {isJs ? (
                  <span>
                    <span className="tok-kw">{isOwner ? "delete" : "leave"}</span> note
                  </span>
                ) : (
                  <span>
                    {isOwner ? t({ js: "", common: "Delete", pythagoras: "Erase" }) : t({ js: "", common: "Leave" })}
                  </span>
                )}
              </button>
            </>
          }
        >
          <p className="text-[12px] tok-com mb-4">
            <Remark>
              {t({ js: "last modified ", common: "Edited ", pythagoras: "Last revised " })}
              {timeAgo(note.updated_at)}
              {effectiveRole === "viewer" ? " · read-only" : " · changes sync live"}
              {encrypted && " · end-to-end encrypted"}
            </Remark>
          </p>
          <div className="space-y-5">
          <label className="flex items-center gap-2 border-b ide-divider focus-within:border-[var(--kw)] transition-colors pb-2">
            {isJs && (
              <>
                <span className="tok-kw text-[15px] shrink-0">const</span>
                <span className="text-[var(--fg)] text-[15px] shrink-0">title</span>
                <span className="tok-punc text-[15px] shrink-0">=</span>
              </>
            )}
            <span className="flex items-center min-w-0">
            {isJs && <span className="tok-str text-lg shrink-0">"</span>}
            <input
              ref={titleRef}
              type="text"
              value={title}
              readOnly={!canEdit}
              placeholder={t({ js: "Untitled note", common: "Untitled note", pythagoras: "Untitled proposition" })}
              onChange={(e) => changeTitle(e.target.value)}
              aria-label="Note title"
              style={{ fieldSizing: "content" }}
              className={`min-w-[10ch] max-w-full bg-transparent outline-none font-semibold placeholder:text-[var(--fg-dim)] placeholder:font-normal ${
                isJs ? "text-lg md:text-xl tok-str" : "note-title text-2xl md:text-[28px] text-[var(--fg)]"
              }`}
            ></input>
            {isJs && <span className="tok-str text-lg shrink-0">"</span>}
            {isJs && <span className="tok-punc text-[15px] shrink-0">;</span>}
            </span>
            <span className="flex-1" />
          </label>
            {encrypted && secure.keyState !== "ready" ? (
              <div className="collab-editor border ide-divider rounded-md bg-[var(--win)] px-5 py-8 text-center space-y-3">
                <LockIcon className="size-6 mx-auto tok-kw" />
                {secure.keyState === "need-vault" ? (
                  <>
                    <p className="text-sm">
                      {t({ js: "This note is end-to-end encrypted.", common: "This note is end-to-end encrypted.", pythagoras: "This proposition is sealed: only its circle can read it." })}
                    </p>
                    <button type="button" className="ide-btn ide-btn-primary" onClick={() => setPinOpen(true)}>
                      {vaultStatus === "none"
                        ? t({ js: "set up a PIN to read it", common: "Set up a PIN to read it" })
                        : t({ js: "enter PIN to decrypt", common: "Enter your PIN" })}
                    </button>
                  </>
                ) : secure.keyState === "no-key" ? (
                  <p className="text-sm tok-com">
                    <Remark>
                      You don't have this note's key yet. Open it from a share link that includes the key, or ask an owner or admin to open the note; their browser shares it with you.
                    </Remark>
                  </p>
                ) : (
                  <p className="text-sm tok-com">{t({ js: "// decrypting…", common: "Decrypting…" })}</p>
                )}
              </div>
            ) : session && seeded ? (
              <CollabEditor
                session={session}
                user={caretUser}
                editable={canEdit}
                placeholder={voice ? voice.editorPlaceholder : "// start typing… everyone here sees it live"}
                onHtmlChange={(html) => {
                  lastHtml.current = html;
                  scheduleMirror();
                }}
              />
            ) : (
              // Never opened collaboratively and the server isn't reachable:
              // show the cached HTML read-only until it is.
              <div className="collab-editor border ide-divider rounded-md bg-[var(--win)]">
                <p className="text-[12px] tok-com px-5 pt-3">
                  <Remark>
                    {t({
                      js: "waiting for the collaboration server — read-only for now",
                      common: "Waiting for the server. Read-only for now.",
                      pythagoras: "Awaiting the others. Read-only for now.",
                    })}
                  </Remark>
                </p>
                <div
                  className="ProseMirror"
                  dangerouslySetInnerHTML={{ __html: fallbackHtml }}
                />
              </div>
            )}
          </div>
          <EditorFooter />
        </CodeWindow>
      </div>

      {isShareOpen && (
        <ShareDialog
          noteId={id}
          onClose={() => setIsShareOpen(false)}
          noteKey={encrypted ? secure.noteKey : null}
          onRotateKey={secure.rotate}
        />
      )}

      {pinOpen && (
        <PinDialog
          onClose={() => {
            setPinOpen(false);
            setAfterUnlock(null);
          }}
          onUnlocked={() => afterUnlock?.()}
        />
      )}

      <ConfirmModal
        isOpen={isEncryptConfirmOpen}
        onClose={() => setIsEncryptConfirmOpen(false)}
        onConfirm={encryptNote}
        title={t({ js: "Encrypt Note", common: "Encrypt this note?", pythagoras: "Seal this proposition?" })}
        message="The text is encrypted in your browser and the server's readable copy is deleted. Only people on this note who have a PIN can read it. Live cursors are turned off and images stay unencrypted. Continue?"
        confirmText={t({ js: "Encrypt", common: "Encrypt", pythagoras: "Seal it" })}
        isDestructive={false}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeDelete}
        title={
          isOwner
            ? t({ js: "Delete Note", common: "Delete this note?", pythagoras: "Erase this proposition?" })
            : t({ js: "Leave Note", common: "Leave this note?" })
        }
        message={
          isOwner
            ? t({
                js: "This note moves to RecycleBin() and is garbage-collected after 30 days. Collaborators lose it too. Continue?",
                common: "It moves to the bin and is deleted for good after 30 days. Anyone you shared it with loses it too.",
                pythagoras: "It moves to Erased and is wiped after 30 days. Anyone you shared it with loses it too.",
              })
            : "You'll lose access to this shared note. Continue?"
        }
        confirmText={isOwner ? t({ js: "Delete", common: "Delete", pythagoras: "Erase" }) : "Leave"}
        isDestructive={true}
      />
    </div>
  );
};

export default NotePage;
