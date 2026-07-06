import { NotebookIcon } from "lucide-react";
import { Link } from "react-router";

const NotesNotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 space-y-8 max-w-md mx-auto text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl mt-10 theme-bg-glass">
      <div 
        className="rounded-full p-8 border border-white/10"
        style={{ 
          background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--theme-main) 20%, transparent), color-mix(in srgb, var(--theme-accent) 5%, transparent))',
          boxShadow: '0 0 30px color-mix(in srgb, var(--theme-main) 20%, transparent)'
        }}
      >
        <NotebookIcon className="size-12 theme-text" />
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
        className="px-6 py-3 theme-button-accent rounded-xl transition-all duration-300 backdrop-blur-sm font-medium"
      >
        Create Your First Note
      </Link>
    </div>
  );
};
export default NotesNotFound;