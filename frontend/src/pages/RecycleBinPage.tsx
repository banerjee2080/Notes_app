import { useEffect, useState } from "react";
import { localDB } from "../lib/db";
import { useAuthStore } from "../stores/useAuthStore";
import NoteCard from "../components/NoteCard";
import { triggerSync } from "../lib/syncEngine";
import { Trash2Icon, Recycle } from "lucide-react";
import AppShell from "../components/shell/AppShell";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import ConfirmModal from "../components/ConfirmModal";
import { emptyBin } from "../lib/noteCommands";
import type { Note } from "../types/notes";
import { useCopy } from "../lib/voice";
import { Remark } from "../components/ui/Themed";

const RecycleBinPage = () => {
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const { authUser } = useAuthStore();
  const isOnline = useOnlineStatus();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const { isJs, t } = useCopy();
  // Read once per render pass, outside the list, so rendering stays pure.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const userId = authUser?._id;
    if (!userId) return;

    // Each run gets a fresh token; a slower, older pass must not overwrite a
    // newer result.
    let runId = 0;
    let cancelled = false;

    const fetchDeletedNotes = async () => {
      const myRun = ++runId;
      const isStale = () => cancelled || myRun !== runId;

      const notes = await localDB.notes
        .filter((note) => note.is_deleted === true && note.user_id === userId)
        .toArray();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const validNotes = notes.filter((note) => {
        return (now - new Date(note.updated_at).getTime()) <= thirtyDaysMs;
      });

      if (!isStale()) setDeletedNotes(validNotes);
    };
    fetchDeletedNotes();

    const handleNoteRestored = (e: Event) => {
      const restoredId = (e as CustomEvent<string>).detail;
      setDeletedNotes((prev) => prev.filter((n) => n.id !== restoredId));
    };

    window.addEventListener("note-restored", handleNoteRestored);
    // The console's `rm` / `rm recycle bin` announce changes this way.
    window.addEventListener("notes-changed", fetchDeletedNotes);
    return () => {
      cancelled = true;
      window.removeEventListener("note-restored", handleNoteRestored);
      window.removeEventListener("notes-changed", fetchDeletedNotes);
    };
  }, [authUser?._id]);

  useEffect(() => {
    if (authUser && authUser._id) {
      triggerSync(authUser._id);

      const handleOnline = () => triggerSync(authUser._id);
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          triggerSync(authUser._id);
        }
      };

      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("online", handleOnline);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }
  }, [authUser]);

  const handleClear = () => {
    setIsConfirmModalOpen(true);
  };

  const confirmClear = async () => {
    try {
      if (!authUser?._id) return;
      // Scoped to the signed-in user: on a shared browser, other accounts'
      // binned notes in IndexedDB must survive.
      await emptyBin(authUser._id);
      setDeletedNotes([]);
      toast.success("Bin emptied");
    } catch (error) {
      toast.error("Couldn't empty the bin");
      console.log("Error in clearing the recycle bin ", error);
    }
  };

  return (
    <AppShell toolbar={<Navbar crumb={t({ js: "RecycleBin.js", common: "Bin", pythagoras: "Erased" })} />}>
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-5 md:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {isJs ? (
            <h1 className="text-lg md:text-xl">
              <span className="tok-kw">function</span>{" "}
              <span className="tok-fn">RecycleBin</span>
              <span className="tok-punc">() {"{"}</span>
            </h1>
          ) : (
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-content)" }}>
              {t({ js: "", common: "Bin", pythagoras: "Erased propositions" })}
            </h1>
          )}

          {deletedNotes.length > 0 && (
            <button
              type="button"
              disabled={!isOnline}
              onClick={handleClear}
              className="ide-btn ide-btn-danger self-start"
              title={isOnline ? "Permanently delete everything" : "Needs a connection"}
            >
              <Trash2Icon className="size-4" />
              {isJs ? (
                <span>
                  globalThis.<span className="tok-fn">gc</span>()
                </span>
              ) : (
                <span>{t({ js: "", common: "Empty bin", pythagoras: "Wipe the slate" })}</span>
              )}
            </button>
          )}
        </div>

        <p className="ide-note mb-6 tok-com">
          <Remark>
            {t({
              js: "Deleted notes wait here for 30 days, then they're garbage-collected for good.",
              common: "Deleted notes wait here for 30 days, then they're gone for good.",
              pythagoras: "Erased propositions wait here for 30 days, then the slate is wiped for good.",
            })}
          </Remark>
          {!isOnline && deletedNotes.length > 0 && (
            <span className="tok-warn">
              {" "}
              <Remark>{t({ js: "emptying the bin needs a connection", common: "Emptying the bin needs a connection." })}</Remark>
            </span>
          )}
        </p>

        {deletedNotes.length === 0 ? (
          <div className="max-w-md mx-auto mt-8 ide-card !bg-[var(--panel)] px-6 py-8 text-center animate-slide-up">
            <Recycle className="size-10 mx-auto mb-4 tok-ok opacity-80" />
            {isJs ? (
              <>
                <p className="text-[13.5px]">
                  <span className="tok-kw">return</span> <span className="tok-punc">[];</span>
                </p>
                <p className="text-xs tok-com mt-2">{"// heap is clean — nothing to collect"}</p>
              </>
            ) : (
              <>
                <p className="text-[17px] font-semibold" style={{ fontFamily: "var(--font-content)" }}>
                  {t({ js: "", common: "The bin is empty", pythagoras: "The slate is clean" })}
                </p>
                <p className="text-[13px] tok-dim mt-1">
                  {t({ js: "", common: "Nothing to restore or delete.", pythagoras: "Nothing erased, nothing to recover." })}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deletedNotes.map((deletedNote) => {
              const daysPassed = Math.floor(
                (now - new Date(deletedNote.updated_at).getTime()) / (1000 * 60 * 60 * 24),
              );
              const daysLeft = Math.max(0, 30 - daysPassed);
              return (
                <div key={deletedNote.id} className="flex flex-col gap-1.5 animate-slide-up">
                  <NoteCard mode="delete" note={deletedNote} />
                  <span className={`text-[11.5px] text-center ${daysLeft <= 3 ? "tok-err" : "tok-com"}`}>
                    {t({ js: "// GC in ", common: "Deleted for good in ", pythagoras: "Wiped in " })}
                    {daysLeft} {daysLeft === 1 ? "day" : "days"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {isJs && <div className="mt-6 text-lg tok-punc">{"}"}</div>}
      </div>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmClear}
        title={t({ js: "Empty Recycle Bin", common: "Empty the bin?", pythagoras: "Wipe the slate?" })}
        message={t({
          js: "This permanently deletes every note in the bin, on this device and in the cloud. There is no undo().",
          common: "This permanently deletes every note in the bin, on this device and in the cloud. It can't be undone.",
        })}
        confirmText={t({ js: "Empty Bin", common: "Empty bin", pythagoras: "Wipe it" })}
        isDestructive={true}
      />
    </AppShell>
  );
};

export default RecycleBinPage;
