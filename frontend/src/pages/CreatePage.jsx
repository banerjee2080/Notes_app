import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react'
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router';
import api from '../lib/axios.js'
import Tiny from '../components/Tiny.jsx';

const CreatePage = ({ isModal }) => {
  const [title,setTitle] = useState("");
  const [content,setContent] = useState("");
  const [loading,setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async(e) => {
    e.preventDefault();
    if(!title.trim() || !content.trim()){
      toast.error("Title or Content is Missing");
      return;
    }
    try{
      await api.post("/notes",{
        title,
        content
      });
      toast.success("Note Successfully Created");
      navigate("/");
    }
    catch(error){
      console.log("Error in Creating note ",error);
      if(error.response?.status===429){
        toast.error("Slow down! You're creating notes too fast", {
          duration: 4000,
          icon: "⏰",
        });
      }
      else{
        toast.error("Error in Creating Note.");
      }
    }
    finally{
      setLoading(false);
    }
  }

  const containerClasses = isModal 
    ? "fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    : "min-h-screen py-10 px-4 flex justify-center items-center";

  return (
    <div className={containerClasses} onClick={() => isModal && navigate("/")}>
      <div 
        className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_0_40px_rgba(0,0,0,0.3)] relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30" style={{ backgroundColor: 'var(--theme-main)' }}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-[80px] -z-10 opacity-30" style={{ backgroundColor: 'var(--theme-accent)' }}></div>
        
        <Link 
          to={"/"}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeftIcon className="size-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Go Home</span>
        </Link>
        
        <h1 className="text-3xl font-bold text-white mb-8">Create New Note</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <button 
            type="submit"
            disabled={loading}
            className="w-full theme-button font-semibold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                Creating...
              </div>
            ) : "Create Note"}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatePage