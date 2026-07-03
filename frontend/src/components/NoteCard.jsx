import { PenSquareIcon, Trash2Icon } from 'lucide-react';
import { Link, useLocation } from 'react-router'
import api from "../lib/axios.js"
import toast from 'react-hot-toast';
import { formatDate } from "../lib/utils.js"

const NoteCard = ({note, setNote}) => {
  const location = useLocation();

  const handleDelete = async(e,id) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try{
      await api.delete(`/notes/${id}`);
      setNote((notes)=>(notes.filter((note)=>(note._id!==id))));
    }
    catch(error){
      console.log("Error in handleDelete", error);
      toast.error("Error in deleting note");
    }
  }
  return (
    <div className="relative group theme-bg-glass backdrop-blur-lg border rounded-2xl p-6 transition-all duration-300 overflow-hidden h-full flex flex-col">
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle at top right, var(--theme-main), transparent 70%)' }}
      ></div>
      <div 
        className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(to right, var(--theme-main), var(--theme-accent))' }}
      ></div>
      
      <Link to={`/note/${note._id}`} state={{ backgroundLocation: location }} className="flex flex-col flex-1 cursor-pointer">
        <h2 className="text-xl font-semibold mb-3 text-white tracking-wide line-clamp-1">
          {note.title}
        </h2>
        <div 
          className="text-white/70 mb-6 line-clamp-3 leading-relaxed [&>p]:m-0 [&>p]:inline"
          dangerouslySetInnerHTML={{ __html: note.content }}
        />
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <span className="text-xs text-white/50 font-medium">
            {formatDate(note.createdAt)}
          </span>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/5 hover:bg-white/20 rounded-lg transition-colors border border-transparent hover:border-white/10 text-white/70 hover:text-white">
              <PenSquareIcon className="size-4" />
            </div>
            <button 
              onClick={(e) => {
                e.preventDefault(); // Stop event bubbling to Link
                handleDelete(e, note._id);
              }}
              className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30 text-white/70 hover:text-red-400 z-10 relative"
            >
              <Trash2Icon className="size-4" />
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default NoteCard