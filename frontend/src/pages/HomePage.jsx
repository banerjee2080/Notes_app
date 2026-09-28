import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import Navbar from "../components/Navbar";
import AppShell from "../components/shell/AppShell.jsx";
import RateLimitedUI from "../components/RateLimitedUI";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import CodeSpinner from "../components/ui/CodeSpinner.jsx";
import { useAuthStore } from "../stores/useAuthStore.js";
import { useDecryptedNotes } from "../hooks/useDecryptedNotes.js";
import { stripHtml } from "../lib/sanitize.js";

const HomePage = () => {
  const { checkPin } = useAuthStore();
  const [isRateLimited] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, decryptedNotes, loading } = useDecryptedNotes();

  const hasNavigated = useRef(false);
  useEffect(() => {
    let isMounted = true;
    const verifyPin = async () => {
      const isValid = await checkPin();
      if (!isValid && isMounted && !hasNavigated.current) {
        hasNavigated.current = true;
        console.log("PIN is not set or expired");
        navigate("/pin", { state: { backgroundLocation: location }, replace: true });
      }
    };
    verifyPin();
    return () => {
      isMounted = false;
    };
  }, [checkPin, navigate, location]);

  // Search runs over the *decrypted* title/content (falls back to the raw
  // record while decryption is still in flight).
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const byId = new Map(decryptedNotes.map((n) => [n.id, n]));

    return notes
      .map((note) => byId.get(note.id) || note)
      .filter((note) => {
        // Date Filter Logic (YYYY-MM)
        if (dateFilter) {
          const noteDate = new Date(note.updated_at || note.createdAt || note.created_at);
          if (!isNaN(noteDate.getTime())) {
            const noteMonthYear = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, "0")}`;
            if (noteMonthYear !== dateFilter) return false;
          }
        }

        // Text Search Logic
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const titleMatch = (note.title || "").toLowerCase().includes(query);
          // A regex strip does not reliably handle `<img src=x onerror=...`;
          // DOMPurify with an empty allowlist does.
          const contentMatch = stripHtml(note.content).toLowerCase().includes(query);
          if (!titleMatch && !contentMatch) return false;
        }

        return true;
      });
  }, [notes, decryptedNotes, searchQuery, dateFilter]);

  const monthLabel = dateFilter
    ? (() => {
        const [year, month] = dateFilter.split("-");
        return new Date(year, month - 1).toLocaleString("default", {
          month: "long",
          year: "numeric",
        });
      })()
    : "";

  return (
    <AppShell
      toolbar={
        <Navbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
        />
      }
    >
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-5 md:py-6">
        {!loading && notes.length > 0 && (
          <div className="flex items-baseline justify-between gap-3 mb-4 text-[12.5px]">
            <div>
              <span className="tok-kw">class</span>{" "}
              <span className="tok-fn">Notes</span>{" "}
              <span className="tok-kw">extends</span>{" "}
              <span className="text-[var(--fg)]">Array</span>{" "}
              <span className="tok-punc">{"{"}</span>
              <span className="tok-com">
                {" "}
                // {filteredNotes.length} of {notes.length}
                {searchQuery || dateFilter ? " match" : ""}
              </span>
            </div>
            <span className="hidden sm:inline tok-dim">sort: updated_at ↓</span>
          </div>
        )}

        {loading && <CodeSpinner className="py-24" />}

        {isRateLimited && <RateLimitedUI />}

        {!loading && notes.length === 0 && !isRateLimited && <NotesNotFound />}

        {!loading && filteredNotes.length === 0 && notes.length !== 0 && !isRateLimited && (
          <div className="max-w-lg mx-auto mt-10 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up">
            <pre className="px-5 py-5 text-[13px] leading-7 whitespace-pre-wrap font-mono">
              <span className="tok-fn">notes</span>
              <span className="tok-punc">.</span>
              <span className="tok-fn">filter</span>
              <span className="tok-punc">(</span>n <span className="tok-kw">{"=>"}</span>{" "}
              {searchQuery && (
                <>
                  n.includes(<span className="tok-str">"{searchQuery}"</span>)
                </>
              )}
              {searchQuery && dateFilter && <span className="tok-kw"> && </span>}
              {dateFilter && (
                <>
                  n.month <span className="tok-kw">===</span>{" "}
                  <span className="tok-str">"{monthLabel}"</span>
                </>
              )}
              <span className="tok-punc">);</span>
              {"\n"}
              <span className="tok-dim">{"< "}</span>
              <span className="tok-punc">[]</span>{" "}
              <span className="tok-com">// no matches found</span>
            </pre>
            <div className="px-5 pb-5 flex flex-wrap gap-2">
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="ide-btn">
                  <span>
                    query <span className="tok-kw">=</span> <span className="tok-str">""</span>
                  </span>
                </button>
              )}
              {dateFilter && (
                <button type="button" onClick={() => setDateFilter("")} className="ide-btn">
                  <span>
                    date <span className="tok-kw">=</span> <span className="tok-kw">null</span>
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && filteredNotes.length !== 0 && !isRateLimited && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredNotes.map((note, index) => (
              <div
                key={note.id}
                className="animate-slide-up opacity-0"
                style={{ animationDelay: `${Math.min(index, 12) * 50}ms` }}
              >
                <NoteCard note={note} />
              </div>
            ))}
          </div>
        )}

        {!loading && notes.length > 0 && (
          <div className="mt-4 text-[12.5px] tok-punc">{"}"}</div>
        )}
      </div>
    </AppShell>
  );
};

export default HomePage;
