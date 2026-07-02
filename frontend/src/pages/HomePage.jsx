import React from "react";
import { useLocation } from "react-router";
import api from "../lib/axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";

const HomePage = () => {
  const [notes, setNotes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [isRateLimited, setIsRateLimited] = React.useState(false);

  const location = useLocation();

  React.useEffect(() => {
    if (location.pathname !== "/") return;

    const fetchNotes = async () => {
      try {
        const res = await api.get("/notes");
        console.log(res.data);
        setNotes(res.data);
        setIsRateLimited(false);
      } catch (error) {
        console.log("Error in fetching notes ", error);
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else {
          toast.error("Error in fetching notes");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [location.key, location.pathname]);
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
          </div>
        )}

        {isRateLimited && <RateLimitedUI />}

        <div className="mt-8">
          {!loading && notes.length === 0 && !isRateLimited && (
            <NotesNotFound />
          )}

          {!loading && notes.length !== 0 && !isRateLimited && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.map((note) => (
                <NoteCard key={note._id} note={note} setNote={setNotes} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
