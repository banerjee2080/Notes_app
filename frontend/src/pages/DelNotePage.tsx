import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeftIcon, Undo2Icon } from "lucide-react";
import { localDB } from "../lib/db";
import { triggerSync } from "../lib/syncEngine";
import { useAuthStore } from "../stores/useAuthStore";
import { sanitizeHtml } from "../lib/sanitize";
import CodeWindow from "../components/ui/CodeWindow";
import CodeSpinner from "../components/ui/CodeSpinner";
import EditorFooter from "../components/ui/EditorFooter";
import { toFileName } from "../lib/utils";
import { useCopy } from "../lib/voice";
import { Remark } from "../components/ui/Themed";
import { useCloseShortcut } from "../hooks/useCloseShortcut";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";

const DelNotePage = ({ isModal }: { isModal?: boolean }) => {
  // Empty until the note is read from IndexedDB.
  const [note, setNote] = useState<Partial<Note>>({});
  const [loading, setLoading] = useState(true);
  const safeContent = useMemo(
    () => sanitizeHtml(note.content || "<p>No content</p>"),
    [note.content],
  );

  // The route is /delNote/:id, so this is always present; "" just falls
  // through to the "not found" branch below.
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthStore();
  const { isJs, t } = useCopy();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await localDB.notes.get(id);
        if (res && res.is_deleted) {
          setNote(res);
          setLoading(false);
        } else {
          toast.error("Deleted note not found");
          navigate("/recycleBin");
        }
      } catch (error) {
        console.log("Error in fetching note locally", error);
        toast.error("Error while fetching note");
        setLoading(false);
      }
    };
    fetchNote();
  }, [id, navigate]);

  const handleRestore = async () => {
    try {
      await localDB.notes.update(id, {
        is_deleted: false,
        updated_at: new Date().toISOString(),
        sync_status: "pending_update",
      });

      if (authUser) {
        triggerSync(userIdOf(authUser));
      }

      toast.success("Note Restored");
      window.dispatchEvent(new CustomEvent("note-restored", { detail: id }));
      navigate("/recycleBin");
    } catch (error) {
      console.log("Error in Restoring the Note ", error);
      toast.error("Error in restoring note");
    }
  };

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex justify-center items-stretch sm:items-center ide-backdrop sm:p-4 md:p-6 max-sm:pt-[env(safe-area-inset-top)] max-sm:pb-[env(safe-area-inset-bottom)]"
    : "h-[100dvh] flex justify-center items-stretch sm:items-center sm:p-4 md:p-8";

  const closePage = () => {
    navigate("/recycleBin");
  };
  useCloseShortcut(closePage); // Ctrl+Shift+X

  if (loading) {
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

  return (
    <div className={containerClasses} onClick={() => isModal && closePage()}>
      <div className="w-full max-w-3xl flex flex-col h-full sm:h-auto sm:max-h-full min-h-0" onClick={(e) => e.stopPropagation()}>
        <CodeWindow
          className="note-window flex flex-col flex-auto min-h-0"
          bodyClassName="flex flex-col flex-auto min-h-0 px-3 pt-3 pb-2 sm:p-5 md:p-7"
          fileName={isJs ? toFileName(note.title) : note.title || "Untitled"}
          status={<span className="ml-1 ide-chip !py-0 !text-[10.5px] tok-warn">{t({ js: "read-only", common: "In the bin", pythagoras: "Erased" })}</span>}
          onClose={closePage}
          actions={
            <>
              <button type="button" onClick={closePage} className="ide-btn ide-btn-ghost !py-1 !px-2 text-xs">
                <ArrowLeftIcon className="size-3.5" />
                <span className="hidden sm:inline">{t({ js: "cd ..", common: "Back" })}</span>
              </button>
              <button type="button" onClick={handleRestore} className="ide-btn ide-btn-ok !py-1 !px-2 text-xs">
                <Undo2Icon className="size-3.5" />
                {t({ js: "restore()", common: "Restore" })}
              </button>
            </>
          }
        >
          <div className="shrink-0 ide-note is-warn mb-4 sm:mb-5">
            {isJs ? (
              <>
                <span className="tok-warn">{"// This note is in RecycleBin()."}</span>{" "}
                <span className="tok-com">
                  {"It will be garbage-collected 30 days after deletion unless you restore() it."}
                </span>
              </>
            ) : (
              <span className="text-[var(--fg)]">
                <Remark>
                  {t({
                    js: "",
                    common: "This note is in the bin. It will be deleted for good 30 days after it was deleted, unless you restore it.",
                    pythagoras: "This proposition has been erased. In 30 days it is gone for good, unless you restore it.",
                  })}
                </Remark>
              </span>
            )}
          </div>

          {isJs ? (
            <div className="shrink-0 flex items-center gap-2 border-b ide-divider pb-2 mb-4 text-lg">
              <span className="tok-kw text-[15px]">const</span>
              <span className="text-[15px] text-[var(--fg)]">title</span>
              <span className="tok-punc text-[15px]">=</span>
              <span className="tok-str font-semibold truncate opacity-80">"{note.title || "Untitled Note"}"</span>
              <span className="tok-punc text-[15px]">;</span>
            </div>
          ) : (
            <h2
              className="shrink-0 border-b ide-divider pb-2 mb-4 text-xl md:text-2xl font-semibold opacity-80 truncate"
              style={{ fontFamily: "var(--font-content)" }}
            >
              {note.title || "Untitled"}
            </h2>
          )}

          <div
            className="note-prose flex-auto min-h-0 overflow-y-auto ide-scroll rounded-md border ide-divider px-4 sm:px-5 py-4 min-h-[200px] opacity-80 bg-[color-mix(in_srgb,var(--bg)_40%,var(--win))]"
            dangerouslySetInnerHTML={{ __html: safeContent }}
          />
          <EditorFooter readOnly className="shrink-0" />
        </CodeWindow>
      </div>
    </div>
  );
};

export default DelNotePage;
