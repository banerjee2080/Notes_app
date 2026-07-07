import { useEffect, useState } from "react";
import { Link } from "react-router";
import { localDB } from "../lib/db.js";
import { useAuthStore } from "../stores/useAuthStore";
import NoteCard from "../components/NoteCard.jsx";
import { triggerSync } from "../lib/syncEngine";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import axiosInstance from "../lib/axios.js";
import toast from "react-hot-toast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const RecycleBinPage = () => {
  const [deletedNotes, setDeletedNotes] = useState([]);
  const { authUser } = useAuthStore();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    const fetchDeletedNotes = async () => {
      const notes = await localDB.notes
        .filter((note) => note.is_deleted === true && note.user_id === authUser?._id)
        .toArray();
      setDeletedNotes(notes);
    };
    fetchDeletedNotes();

    const handleNoteRestored = (e) => {
      const restoredId = e.detail;
      setDeletedNotes((prev) => prev.filter((n) => n.id !== restoredId));
    };

    window.addEventListener("note-restored", handleNoteRestored);
    return () =>
      window.removeEventListener("note-restored", handleNoteRestored);
  }, []);

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

  const handleClear = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete all notes in the recycle bin?",
      )
    )
      return;
    try {
      await axiosInstance.delete("/notes/clear-recycle-bin");
      await localDB.notes.filter((note) => note.is_deleted === true).delete();
      setDeletedNotes([]);
      toast.success("Recycle bin cleared successfully.");
    } catch (error) {
      toast.error("Error in clearing the recycle bin ");
      console.log("Error in clearing the recycle bin ", error);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 md:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/profile"
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-wide">
            Recycle Bin
          </h1>
        </div>

        {deletedNotes.length > 0 && (
          <button
            disabled={!isOnline}
            onClick={handleClear}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2Icon className="size-4" />
            <span className="font-semibold">Empty Bin</span>
          </button>
        )}
      </div>

      {deletedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <Trash2Icon className="size-16 mb-4 opacity-20" />
          <p className="text-lg">No deleted notes found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deletedNotes.map((deletedNote) => (
            <div key={deletedNote.id}>
              <NoteCard mode="delete" note={deletedNote} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecycleBinPage;
