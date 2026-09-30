import { useState, useMemo } from "react";
import { PenLine, Trash2, Undo2, FileCode2 } from "lucide-react";
import { Link, useLocation } from "react-router";
import ConfirmModal from "./ConfirmModal";
import toast from "react-hot-toast";
import { formatDate, timeAgo, toFileName } from "../lib/utils";
import { useAuthStore } from "../stores/useAuthStore";
import { localDB } from "../lib/db";
import { triggerSync } from "../lib/syncEngine";
import { sanitizeHtml } from "../lib/sanitize";
import { userIdOf } from "../types/user";
import type { DecryptedNote } from "../types/notes";

interface NoteCardProps {
  note: DecryptedNote;
  /** "delete" renders the recycle-bin variant (restore instead of delete). */
  mode?: "delete";
}

type CardAction = "delete" | "restore";

const NoteCard = ({ note, mode }: NoteCardProps) => {
  const location = useLocation();
  const { authUser } = useAuthStore();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [actionType, setActionType] = useState<CardAction | null>(null);
  const safeContent = useMemo(() => sanitizeHtml(note.content), [note.content]);

  const requestAction = (e: React.MouseEvent, action: CardAction) => {
    e.preventDefault();
    setActionType(action);
    setIsConfirmModalOpen(true);
  };

  const confirmAction = () => {
    if (actionType === "delete") {
      executeDelete(note.id);
    } else if (actionType === "restore") {
      executeRestore(note.id);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await localDB.notes.update(id, {
        is_deleted: true,
        updated_at: new Date().toISOString(),
        sync_status: "pending_update",
      });

      if (authUser) {
        triggerSync(userIdOf(authUser));
      }
      toast.success("Note deleted");
    } catch (error) {
      console.log("Error in handleDelete", error);
      toast.error("Error in deleting note");
    }
  };

  const executeRestore = async (id: string) => {
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
    } catch (error) {
      console.log("Error in handleRestore", error);
      toast.error("Error in Restoring note");
    }
  };

  const isBin = mode === "delete";

  return (
    <div className="relative group ide-card h-full flex flex-col overflow-hidden">
      <Link
        to={!isBin ? `/note/${note.id}` : `/delNote/${note.id}`}
        state={{ backgroundLocation: location }}
        className="flex flex-col flex-1 cursor-pointer"
      >
        {/* file header */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 text-[12px]">
          <span className="flex items-center gap-1.5 min-w-0 tok-dim">
            <FileCode2 className="size-3.5 tok-js shrink-0" />
            <span className="truncate">{toFileName(note.title)}</span>
          </span>
          <span className="tok-com shrink-0" title={formatDate(note.createdAt || note.updated_at)}>
            {"// "}
            {timeAgo(note.updated_at || note.createdAt)}
          </span>
        </div>

        {/* code body with a line-number gutter */}
        <div className="flex flex-1 px-4 pb-3 gap-3">
          <div className="gutter text-[12px] leading-6 pt-px">
            1<br />2<br />3<br />4
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] leading-6 font-semibold text-[var(--fg)] line-clamp-1">
              {note.title || <span className="tok-kw">undefined</span>}
            </h2>
            <div
              className="note-prose !text-[13px] !leading-6 text-[var(--fg-muted)] line-clamp-3 [&>*]:m-0 [&>p]:inline [&_img]:hidden"
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t ide-divider bg-[color-mix(in_srgb,var(--bg)_25%,transparent)]">
          <span className="text-[11px] tok-dim">
            {isBin ? (
              <span className="tok-warn">{"// awaiting garbage collection"}</span>
            ) : (
              <>
                <span className="tok-kw">await</span> <span className="tok-fn">decrypt</span>
                <span className="tok-punc">()</span> <span className="tok-ok">✓</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            {!isBin && (
              <span className="ide-icon-btn !w-7 !h-7" title="edit()">
                <PenLine className="size-3.5" />
              </span>
            )}
            <button
              type="button"
              onClick={(e) => requestAction(e, isBin ? "restore" : "delete")}
              className={`ide-icon-btn !w-7 !h-7 relative z-10 ${isBin ? "!text-[var(--ok)]" : "is-danger"}`}
              title={isBin ? "restore()" : "delete note"}
              aria-label={isBin ? "Restore note" : "Delete note"}
            >
              {isBin ? <Undo2 className="size-3.5" /> : <Trash2 className="size-3.5" />}
            </button>
          </div>
        </div>
      </Link>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmAction}
        title={actionType === "delete" ? "Delete Note" : "Restore Note"}
        message={
          actionType === "delete"
            ? "This note moves to RecycleBin() and is garbage-collected after 30 days. Continue?"
            : "Are you sure you want to restore this note?"
        }
        confirmText={actionType === "delete" ? "Delete" : "Restore"}
        isDestructive={actionType === "delete"}
      />
    </div>
  );
};

export default NoteCard;
