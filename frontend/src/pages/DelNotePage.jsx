import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import toast from "react-hot-toast";
import { ArrowLeftIcon, Undo2Icon } from "lucide-react";
import { localDB } from "../lib/db.js";
import { triggerSync } from "../lib/syncEngine.js";
import { useAuthStore } from "../stores/useAuthStore.js";

const DelNotePage = ({ isModal }) => {
  const [note, setNote] = useState({});
  const [loading, setLoading] = useState(true);
  
  const { id } = useParams();
  const navigate = useNavigate();
  const { authUser } = useAuthStore();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const res = await localDB.notes.get(id);
        if (res && res.is_deleted) {
          setNote(res);
        } else {
          toast.error("Deleted note not found");
          navigate("/recycleBin");
        }
      } catch (error) {
        console.log("Error in fetching note locally", error);
        toast.error("Error while fetching note");
      } finally {
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
        triggerSync(authUser._id || authUser.id);
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
    ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  const closePage = () => {
    navigate("/recycleBin");
  };

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
    <div className={containerClasses} onClick={() => isModal && closePage()}>
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
          <button
            onClick={closePage}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeftIcon className="size-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Go Back</span>
          </button>

          <button
            onClick={handleRestore}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 border hover:brightness-125 hover:scale-[1.02]"
            style={{
              backgroundColor: "color-mix(in srgb, var(--theme-accent) 15%, transparent)",
              borderColor: "color-mix(in srgb, var(--theme-accent) 30%, transparent)",
              color: "var(--theme-accent)",
            }}
          >
            <Undo2Icon className="size-4" />
            <span className="font-medium text-sm">Restore</span>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white text-lg font-medium shadow-inner opacity-70">
              {note.title || "Untitled Note"}
            </div>
          </div>
          <div>
             <div 
               className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white opacity-70 min-h-[200px]"
               dangerouslySetInnerHTML={{ __html: note.content || "No content" }}
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DelNotePage;
