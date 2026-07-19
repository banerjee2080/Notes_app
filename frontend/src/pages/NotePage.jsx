import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Tiny from "../components/Tiny.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { localDB } from "../lib/db.js";
import api from "../lib/axios.js";
import { useAuthStore } from "../stores/useAuthStore.js";
import { triggerSync } from "../lib/syncEngine.js";

const NotePage = ({ isModal }) => {
  const [note, setNote] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const isInit = useRef(true);
  const debouncedTitle = useDebounce(note.title, 500);
  const debouncedContent = useDebounce(note.content, 500);

  const { id } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthStore();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await localDB.notes.get(id);
        if (res && !res.is_deleted) {
          setNote(res);
        } else {
          toast.error("Note not found or deleted");
          navigate("/");
        }
      } catch (error) {
        console.log("Error in fetching note locally", error);
        toast.error("Error while fetching notes");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id, navigate]);

  useEffect(() => {
    if (isInit.current) {
      isInit.current = false;
      return;
    }

    if (debouncedContent === undefined || debouncedTitle === undefined) return;

    const autoSaveNote = async () => {
      if (!note.id) return;

      setSaving(true);
      try {
        const updatedNote = {
          ...note,
          title: debouncedTitle,
          content: debouncedContent,
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
            console.log("Offline: Note edit queued for background sync");
          }
        }
      } catch (error) {
        setSaving("Saving failed..");
        console.error("Error saving note locally: ", error);
      }
    };

    autoSaveNote();
  }, [debouncedTitle, debouncedContent, note.id, authUser]);

  const handleDelete = async () => {
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
    ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  if (loading) {
    return (
      <div
        className={
          isModal
            ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm"
            : "min-h-screen flex justify-center items-center"
        }
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    );
  }
  return (
    <div className={containerClasses} onClick={() => isModal && navigate("/")}>
      <div
        className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30"
          style={{ backgroundColor: "var(--theme-main)" }}
        ></div>
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30"
          style={{ backgroundColor: "var(--theme-accent)" }}
        ></div>

        <div className="flex justify-between items-center mb-8">
          <Link
            to={"/"}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeftIcon className="size-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Go Back</span>
          </Link>

          <div className="h-6 flex items-center transition-all duration-300">
            {saving === true && (
              <span className="text-sm text-white/50 flex items-center gap-2 animate-pulse">
                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white/50"></div>
                Autosaving...
              </span>
            )}
            {saving === "saved" && (
              <span className="text-sm text-emerald-400/80 flex items-center gap-1 animate-in fade-in duration-300">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
                Saved
              </span>
            )}
            {saving === "Saving failed.." && (
              <span className="text-sm text-red-400/80 flex items-center gap-1 animate-in fade-in duration-300">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Save Failed
              </span>
            )}
          </div>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors"
          >
            <Trash2Icon className="size-4" />
            <span className="font-medium text-sm">Delete</span>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <input
              type="text"
              value={note.title || ""}
              placeholder="Note Title..."
              onChange={(e) => {
                setNote({ ...note, title: e.target.value });
              }}
              className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-lg font-medium shadow-inner"
            ></input>
          </div>
          <div>
            <Tiny
              value={note.content || ""}
              onEditorChange={(newContent) => {
                setNote({ ...note, content: newContent });
              }}
              placeholder="What's on your mind?"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotePage;
