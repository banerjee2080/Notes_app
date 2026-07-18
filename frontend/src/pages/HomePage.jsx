import React, { useMemo, useState } from "react";
import { Search, CalendarDays } from "lucide-react";
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
  const [dateFilter, setDateFilter] = useState("");

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
    
    return notes.filter((note) => {
      // Date Filter Logic (YYYY-MM)
      if (dateFilter) {
        // Fallback to createdAt if updated_at is missing
        const noteDate = new Date(note.updated_at || note.createdAt || note.created_at);
        if (!isNaN(noteDate.getTime())) {
          const noteMonthYear = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, '0')}`;
          if (noteMonthYear !== dateFilter) {
            return false;
          }
        }
      }

      // Text Search Logic
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (note.title || "").toLowerCase().includes(query);
        const rawContent = (note.content || "").replace(/<[^>]*>?/gm, "");
        const contentMatch = rawContent.toLowerCase().includes(query);
        
        if (!titleMatch && !contentMatch) {
          return false;
        }
      }

      return true;
    });
  }, [notes, searchQuery, dateFilter]);

  const loading = notes === undefined;

  return (
    <div className="min-h-screen">
      <Navbar 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />

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
                  className="rounded-full p-6 border border-white/10 flex items-center justify-center relative"
                  style={{ 
                    background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--theme-main) 20%, transparent), color-mix(in srgb, var(--theme-accent) 5%, transparent))',
                    boxShadow: '0 0 30px color-mix(in srgb, var(--theme-main) 20%, transparent)'
                  }}
                >
                  {dateFilter && !searchQuery ? (
                    <CalendarDays className="size-12 theme-text opacity-90" />
                  ) : (
                    <Search className="size-12 theme-text opacity-90" />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-white tracking-wide">
                    No Matches Found
                  </h2>
                  <p className="text-white/60 leading-relaxed max-w-xs mx-auto">
                    We couldn't find any notes matching 
                    {searchQuery && <> "<span className="text-white/90 font-medium">{searchQuery}</span>"</>}
                    {searchQuery && dateFilter && " in "}
                    {dateFilter && (() => {
                      const [year, month] = dateFilter.split("-");
                      const dateObj = new Date(year, month - 1);
                      const formattedDate = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                      return <> <span className="text-white/90 font-medium">{formattedDate}</span></>;
                    })()}
                  </p>
                </div>
                <div className="flex gap-3">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="px-4 py-2.5 theme-button-outline rounded-xl transition-all duration-300 backdrop-blur-sm font-medium mt-2 text-sm"
                    >
                      Clear Search
                    </button>
                  )}
                  {dateFilter && (
                    <button
                      onClick={() => setDateFilter("")}
                      className="px-4 py-2.5 theme-button-outline rounded-xl transition-all duration-300 backdrop-blur-sm font-medium mt-2 text-sm"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
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
