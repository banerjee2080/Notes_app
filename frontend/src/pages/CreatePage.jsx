import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import api from "../lib/axios.js";
import Tiny from "../components/Tiny.jsx";
import { useDebounce } from "../hooks/useDebounce.js";
import { v4 as uuidv4 } from "uuid";
import { localDB } from "../lib/db";
import { useAuthStore } from "../stores/useAuthStore.js";

const CreatePage = ({ isModal }) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const debouncedTitle = useDebounce(title, 500);
  const debouncedContent = useDebounce(content, 500);
  const isInit = useRef(true);
  const { authUser } = useAuthStore();

  const [noteId] = useState(() => uuidv4());

  useEffect(() => {
    if (isInit.current) {
      isInit.current = false;
      return;
    }

    if (!debouncedContent || !debouncedTitle) return;

    const autoSaveNote = async () => {
      setSaving(true);
      try {
        const newNote = {
          id: noteId,
          user_id: authUser._id || authUser.id,
          title: debouncedTitle,
          content: debouncedContent,
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
        } catch (networkError) {
          console.log("Offline: Note queued for background sync");
        }
      } catch (error) {
        setSaving("Saving failed..");
        console.error("Error saving note locally: ", error);
      }
    };

    autoSaveNote();
  }, [debouncedTitle, debouncedContent, noteId]);

  const containerClasses = isModal
    ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

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

        <Link
          to={"/"}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeftIcon className="size-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Go Home</span>
        </Link>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Create New Note</h1>
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
        </div>

        <form className="space-y-6">
          <div>
            <input
              type="text"
              value={title}
              placeholder="Note Title..."
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-lg font-medium shadow-inner"
            ></input>
          </div>
          <div>
            <Tiny
              value={content}
              onEditorChange={setContent}
              placeholder="What's on your mind?"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePage;
