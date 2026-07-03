import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, Trash2Icon } from 'lucide-react';
import Tiny from '../components/Tiny.jsx';

const NotePage = ({ isModal }) => {
  const [note,setNote] = useState({});
  const [saving, setSaving] =  useState(false);
  const [loading, setLoading] = useState(true);

  const {id} = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNote = async() => {
      try{
        const res = await api.get(`/notes/${id}`);
        setNote(res.data);
      }
      catch(error){
        console.log("Error in fetching notes ",error);
        toast.error("Error while fetching notes");
      }
      finally{
        setLoading(false);
      }
    }

    fetchNote();
  },[id])

  const handleDelete = async() => {
    try{
      await api.delete(`/notes/${id}`);
      toast.success("Note Deleted");
      navigate("/");
    }
    catch(error){
      console.log("Error in Deleting the Note ",error);
      toast.error("Error in deleting note");
    }
  }

  const handleSave = async() => {
    if(!note.title.trim() || !note.content.trim()){
      toast.error("Please add a title or content");
      return;
    }

    setSaving(true);
    try{
      await api.put(`/notes/${id}`,note);
      toast.success("Note Updated successfully")
      navigate("/");
    }
    catch(error){
      console.log("Error in updating note ",error);
      toast.error("Error in Updating note");
    }
    finally{
      setSaving(false);
    }
  }

  const containerClasses = isModal 
    ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  if(loading){
    return(
      <div className={isModal ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm" : "min-h-screen flex justify-center items-center"}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    )
  }
  return (
    <div className={containerClasses} onClick={() => isModal && navigate("/")}>
      <div 
        className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30" style={{ backgroundColor: 'var(--theme-main)' }}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30" style={{ backgroundColor: 'var(--theme-accent)' }}></div>
        
        <div className="flex justify-between items-center mb-8">
          <Link 
            to={"/"}
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
          >
            <ArrowLeftIcon className="size-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Go Back</span>
          </Link>
          
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
              type='text'
              value={note.title || ""}
              placeholder='Note Title...'
              onChange={(e) => {setNote({...note,title:e.target.value})}}
              className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all text-lg font-medium shadow-inner"
            ></input>
          </div>
          <div>
            <Tiny
              value={note.content || ""}
              onEditorChange={(newContent)=>{setNote({...note,content:newContent})}}
              placeholder="What's on your mind?"
            />
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full theme-button font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Saving...
              </div>
            ) : "Save Changes"}
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotePage