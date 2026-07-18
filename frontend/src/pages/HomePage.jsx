import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocation } from "react-router";
import api from "../lib/axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import RateLimitedUI from "../components/RateLimitedUI";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import { localDB } from "../lib/db.js";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuthStore } from "../stores/useAuthStore.js";

const HomePage = () => {
  const { authUser } = useAuthStore();
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const notes = useLiveQuery(
    () =>
      localDB.notes
        .where("user_id")
        .equals(authUser?._id || authUser?.id || "")
        .filter((note) => note.is_deleted === false)
        .reverse()
        .sortBy("updated_at"),
    [authUser],
  );

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (!searchQuery.trim()) return notes;

    const query = searchQuery.toLowerCase();

    return notes.filter((note) => {
      const titleMatch = (note.title || "").toLowerCase().includes(query);

      // Strip HTML tags from TinyMCE content to search raw text accurately
      const rawContent = (note.content || "").replace(/<[^>]*>?/gm, "");
      const contentMatch = rawContent.toLowerCase().includes(query);

      return titleMatch || contentMatch;
    });
  }, [notes, searchQuery]);

  const loading = notes === undefined;

  return (
    <div className="min-h-screen">
      <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

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

          {!loading &&
            filteredNotes.length === 0 &&
            notes.length !== 0 &&
            !isRateLimited && (
              <div className="flex flex-col items-center justify-center py-16 px-4 space-y-6 max-w-md mx-auto text-center theme-bg-glass backdrop-blur-xl border border-white/10 rounded-3xl mt-10">
                <div 
                  className="rounded-full p-6 border border-white/10"
                  style={{ 
                    background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--theme-main) 20%, transparent), color-mix(in srgb, var(--theme-accent) 5%, transparent))',
                    boxShadow: '0 0 30px color-mix(in srgb, var(--theme-main) 20%, transparent)'
                  }}
                >
                  <Search className="size-12 theme-text opacity-90" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-wide">
                    No Matches Found
                  </h2>
                  <p className="text-white/60 leading-relaxed max-w-xs mx-auto">
                    We couldn't find any notes matching "<span className="text-white/90 font-medium">{searchQuery}</span>"
                  </p>
                </div>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-6 py-2.5 theme-button-outline rounded-xl transition-all duration-300 backdrop-blur-sm font-medium mt-2"
                >
                  Clear Search
                </button>
              </div>
            )}

          {!loading && filteredNotes.length !== 0 && !isRateLimited && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNotes.map((note, index) => (
                <div
                  key={note.id}
                  className="animate-slide-up opacity-0"
                  style={{ animationDelay: `${index * 75}ms` }}
                >
                  <NoteCard note={note} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
