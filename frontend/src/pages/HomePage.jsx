import React, { useState } from "react";
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

          {!loading && notes.length !== 0 && !isRateLimited && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.map((note, index) => (
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
