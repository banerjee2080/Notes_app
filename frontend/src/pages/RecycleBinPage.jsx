import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { localDB } from "../lib/db.js";
import { useAuthStore } from "../stores/useAuthStore";
import NoteCard from "../components/NoteCard.jsx";
import { triggerSync } from "../lib/syncEngine";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import axiosInstance from "../lib/axios.js";
import toast from "react-hot-toast";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { decryptData } from "../lib/crypto.js";

const RecycleBinPage = () => {
  const [deletedNotes, setDeletedNotes] = useState([]);
  const { authUser, checkPin, cryptoKey } = useAuthStore();
  const isOnline = useOnlineStatus();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const verifyPin = async () => {
      const isValid = await checkPin();
      if (!isValid && isMounted) {
        navigate("/pin", { state: { backgroundLocation: location }, replace: true });
      }
    };
    verifyPin();
    return () => { isMounted = false; };
  }, [checkPin, navigate, location]);

  useEffect(() => {
    const fetchDeletedNotes = async () => {
      const notes = await localDB.notes
        .filter((note) => note.is_deleted === true && note.user_id === authUser?._id)
        .toArray();

      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      
      const validNotes = notes.filter((note) => {
        return (now - new Date(note.updated_at).getTime()) <= thirtyDaysMs;
      });

      if (!cryptoKey) {
        setDeletedNotes(validNotes);
        return;
      }

      const decrypted = await Promise.all(validNotes.map(async (note) => {
        try {
          const title = note.iv_title ? await decryptData(note.title, note.iv_title, cryptoKey) : note.title;
          const content = note.iv_content ? await decryptData(note.content, note.iv_content, cryptoKey) : note.content;
          return { ...note, title, content };
        } catch (err) {
          console.error(`Failed to decrypt deleted note ${note.id}`, err);
          return {
            ...note,
            title: "Decryption Failed",
            content: "<p>Could not decrypt this note. It may be corrupted or encrypted with a different PIN.</p>",
          };
        }
      }));
      
      setDeletedNotes(decrypted);
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

  const handleClear = () => {
    setIsConfirmModalOpen(true);
  };

  const confirmClear = async () => {
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

      <p className="text-sm text-white/60 mb-8 text-center bg-white/5 py-3 px-4 rounded-xl border border-white/10 w-full">
        Items in the recycle bin will be permanently deleted after 30 days.
      </p>

      {deletedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <Trash2Icon className="size-16 mb-4 opacity-20" />
          <p className="text-lg">No deleted notes found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deletedNotes.map((deletedNote) => {
            const daysPassed = Math.floor((Date.now() - new Date(deletedNote.updated_at).getTime()) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 30 - daysPassed);
            return (
              <div key={deletedNote.id} className="flex flex-col gap-2">
                <NoteCard mode="delete" note={deletedNote} />
                <span className="text-xs text-white/50 text-center font-medium">
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left to restore
                </span>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmClear}
        title="Empty Recycle Bin"
        message="Are you sure you want to permanently delete all notes in the recycle bin? This action cannot be undone."
        confirmText="Empty Bin"
        isDestructive={true}
      />
    </div>
  );
};

export default RecycleBinPage;
