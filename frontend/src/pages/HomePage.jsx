import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import Navbar from "../components/Navbar";
import AppShell from "../components/shell/AppShell.jsx";
import RateLimitedUI from "../components/RateLimitedUI";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import CodeSpinner from "../components/ui/CodeSpinner.jsx";
import { Lock, KeyRound } from "lucide-react";
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
  const { notes, decryptedNotes, loading, isUnlocked } = useDecryptedNotes();
  // While the vault is locked, never render cards (they'd show ciphertext).
  const locked = !isUnlocked && !loading && notes.length > 0;

  const hasNavigated = useRef(false);
  useEffect(() => {
    let isMounted = true;
    const verifyPin = async () => {
      const isValid = await checkPin();
      if (!isValid && isMounted && !hasNavigated.current) {
        hasNavigated.current = true;
        console.log("PIN is not set or expired");
        navigate("/pin", {
          state: { backgroundLocation: location },
          replace: true,
        });
      }
    };
    verifyPin();
    return () => {
      isMounted = false;
    };
  }, [checkPin, navigate, location]);

  // Build a plaintext search index once per decryption pass, not per keystroke.
  const searchIndex = useMemo(() => {
    const index = new Map();
    for (const note of decryptedNotes) {
      index.set(note.id, {
        note,
        title: note.decryptFailed ? "" : (note.title || "").toLowerCase(),
        body: note.decryptFailed ? "" : stripHtml(note.content).toLowerCase(),
      });
    }
    return index;
  }, [decryptedNotes]);

  // Unlocked, notes exist, but the first decryption pass hasn't finished yet.
  const decrypting =
    isUnlocked && notes?.length > 0 && decryptedNotes.length === 0;

  const filteredNotes = useMemo(() => {
    if (!notes || !isUnlocked) return [];
    const query = searchQuery.trim().toLowerCase();

    const result = [];
    for (const raw of notes) {
      const entry = searchIndex.get(raw.id);
      if (!entry) continue; // not decrypted yet — never search or show ciphertext

      // Date filter (YYYY-MM). Timestamps aren't encrypted, so read them from the raw record.
      if (dateFilter) {
        const noteDate = new Date(
          raw.updated_at || raw.createdAt || raw.created_at,
        );
        if (!isNaN(noteDate.getTime())) {
          const noteMonthYear = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, "0")}`;
          if (noteMonthYear !== dateFilter) continue;
        }
      }

      // Text search, against the plaintext index only.
      if (query && !entry.title.includes(query) && !entry.body.includes(query))
        continue;

      result.push(entry.note);
    }
    return result;
  }, [notes, isUnlocked, searchIndex, searchQuery, dateFilter]);

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
        {!locked && !loading && notes.length > 0 && (
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

        {(loading || decrypting) && <CodeSpinner className="py-24" />}

        {isRateLimited && <RateLimitedUI />}

        {!loading && notes.length === 0 && !isRateLimited && <NotesNotFound />}

        {locked && (
            <div className="max-w-md mx-auto mt-10 ide-card !bg-[var(--panel)] px-6 py-8 text-center animate-slide-up">
              <Lock className="size-9 mx-auto mb-4 tok-warn" />
              <p className="text-[13.5px]">
                <span className="tok-kw">await</span> vault
                <span className="tok-punc">.</span>
                <span className="tok-fn">unlock</span>
                <span className="tok-punc">(</span>pin
                <span className="tok-punc">);</span>
              </p>
              <p className="text-xs tok-com mt-2 mb-5">
                {"// "}
                {notes.length} encrypted {notes.length === 1 ? "note" : "notes"}{" "}
                — enter your PIN to read them
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate("/pin", { state: { backgroundLocation: location } })
                }
                className="ide-btn ide-btn-primary"
              >
                <KeyRound className="size-4" />
                unlock()
              </button>
            </div>
          )}

        {!locked &&
          !loading &&
          !decrypting &&
          filteredNotes.length === 0 &&
          notes.length !== 0 &&
          !isRateLimited && (
            <div className="max-w-lg mx-auto mt-10 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up">
              <pre className="px-5 py-5 text-[13px] leading-7 whitespace-pre-wrap font-mono">
                <span className="tok-fn">notes</span>
                <span className="tok-punc">.</span>
                <span className="tok-fn">filter</span>
                <span className="tok-punc">(</span>n{" "}
                <span className="tok-kw">{"=>"}</span>{" "}
                {searchQuery && (
                  <>
                    n.includes(<span className="tok-str">"{searchQuery}"</span>)
                  </>
                )}
                {searchQuery && dateFilter && (
                  <span className="tok-kw"> && </span>
                )}
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
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ide-btn"
                  >
                    <span>
                      query <span className="tok-kw">=</span>{" "}
                      <span className="tok-str">""</span>
                    </span>
                  </button>
                )}
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    className="ide-btn"
                  >
                    <span>
                      date <span className="tok-kw">=</span>{" "}
                      <span className="tok-kw">null</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

        {!locked &&
          !loading &&
          !decrypting &&
          filteredNotes.length !== 0 &&
          !isRateLimited && (
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

        {!locked && !loading && notes.length > 0 && (
          <div className="mt-4 text-[12.5px] tok-punc">{"}"}</div>
        )}
      </div>
    </AppShell>
  );
};

export default HomePage;
