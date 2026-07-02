import { NotebookIcon } from "lucide-react";
import { Link } from "react-router";

const NotesNotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 space-y-8 max-w-md mx-auto text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl mt-10">
      <div className="bg-gradient-to-br from-blue-500/20 to-blue-400/5 rounded-full p-8 border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
        <NotebookIcon className="size-12 text-blue-300" />
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold text-white tracking-wide">No notes yet</h3>
        <p className="text-white/60 leading-relaxed max-w-xs mx-auto">
          Ready to organize your thoughts? Create your first note to get started
          on your journey.
        </p>
      </div>
      <Link 
        to="/createNote" 
        className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] font-medium text-white"
      >
        Create Your First Note
      </Link>
    </div>
  );
};
export default NotesNotFound;