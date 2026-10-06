import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import AppShell from "../components/shell/AppShell";
import RateLimitedUI from "../components/RateLimitedUI";
import NoteCard from "../components/NoteCard";
import NotesNotFound from "../components/NotesNotFound";
import CodeSpinner from "../components/ui/CodeSpinner";
import { useNotes } from "../hooks/useNotes";
import { stripHtml } from "../lib/sanitize";
import type { Note } from "../types/notes";
import { useCopy } from "../lib/voice";

/** One note pre-lowercased for search, so keystrokes don't re-strip HTML. */
interface SearchEntry {
  note: Note;
  title: string;
  body: string;
}

const HomePage = () => {
  const [isRateLimited] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const { notes, loading } = useNotes();
  const { isJs, t } = useCopy();
  const noteCount = notes?.length ?? 0;

  // Build the search index once per note change, not per keystroke.
  const searchIndex = useMemo(() => {
    const index = new Map<string, SearchEntry>();
    for (const note of notes ?? []) {
      index.set(note.id, {
        note,
        title: (note.title || "").toLowerCase(),
        body: stripHtml(note.content).toLowerCase(),
      });
    }
    return index;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const query = searchQuery.trim().toLowerCase();

    const result: Note[] = [];
    for (const raw of notes) {
      const entry = searchIndex.get(raw.id);
      if (!entry) continue;

      // Date filter (YYYY-MM).
      if (dateFilter) {
        const noteDate = new Date(
          raw.updated_at || raw.createdAt || raw.created_at || "",
        );
        if (!isNaN(noteDate.getTime())) {
          const noteMonthYear = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, "0")}`;
          if (noteMonthYear !== dateFilter) continue;
        }
      }

      if (query && !entry.title.includes(query) && !entry.body.includes(query))
        continue;

      result.push(entry.note);
    }
    return result;
  }, [notes, searchIndex, searchQuery, dateFilter]);

  const monthLabel = dateFilter
    ? (() => {
        const [year, month] = dateFilter.split("-");
        return new Date(Number(year), Number(month) - 1).toLocaleString("default", {
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
        {!loading && noteCount > 0 && (
          <div className="flex items-baseline justify-between gap-3 mb-4 text-[12.5px]">
            {isJs ? (
              <div>
                <span className="tok-kw">class</span>{" "}
                <span className="tok-fn">Notes</span>{" "}
                <span className="tok-kw">extends</span>{" "}
                <span className="text-[var(--fg)]">Array</span>{" "}
                <span className="tok-punc">{"{"}</span>
                <span className="tok-com">
                  {" "}
                  // {filteredNotes.length} of {noteCount}
                  {searchQuery || dateFilter ? " match" : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <h1 className="text-[20px] font-semibold text-[var(--fg)]" style={{ fontFamily: "var(--font-content)" }}>
                  {t({ js: "", common: "Your notes", pythagoras: "Propositions" })}
                </h1>
                <span className="tok-dim">
                  {searchQuery || dateFilter
                    ? `${filteredNotes.length} of ${noteCount} match`
                    : `${noteCount} ${noteCount === 1 ? t({ js: "", common: "note", pythagoras: "proposition" }) : t({ js: "", common: "notes", pythagoras: "propositions" })}`}
                </span>
              </div>
            )}
            <span className="hidden sm:inline tok-dim">
              {t({ js: "sort: updated_at ↓", common: "Newest first", pythagoras: "Latest first" })}
            </span>
          </div>
        )}

        {loading && <CodeSpinner className="py-24" />}

        {isRateLimited && <RateLimitedUI />}

        {!loading && noteCount === 0 && !isRateLimited && <NotesNotFound />}

        {!loading &&
          filteredNotes.length === 0 &&
          noteCount !== 0 &&
          !isRateLimited && (
            <div className="max-w-lg mx-auto mt-10 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up">
              {!isJs && (
                <div className="px-5 pt-5">
                  <p className="text-[18px] font-semibold" style={{ fontFamily: "var(--font-content)" }}>
                    {t({ js: "", common: "No notes match", pythagoras: "No proposition satisfies these conditions" })}
                  </p>
                  <p className="mt-1 tok-dim text-[13.5px]">
                    {searchQuery && <>Searching for “{searchQuery}”</>}
                    {searchQuery && dateFilter && " in "}
                    {!searchQuery && dateFilter && "Nothing from "}
                    {dateFilter && monthLabel}
                  </p>
                </div>
              )}
              {isJs && <pre className="px-5 py-5 text-[13px] leading-7 whitespace-pre-wrap font-mono">
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
              </pre>}
              <div className={`px-5 pb-5 flex flex-wrap gap-2 ${isJs ? "" : "pt-4"}`}>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ide-btn"
                  >
                    {isJs ? (
                      <span>
                        query <span className="tok-kw">=</span>{" "}
                        <span className="tok-str">""</span>
                      </span>
                    ) : (
                      "Clear search"
                    )}
                  </button>
                )}
                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter("")}
                    className="ide-btn"
                  >
                    {isJs ? (
                      <span>
                        date <span className="tok-kw">=</span>{" "}
                        <span className="tok-kw">null</span>
                      </span>
                    ) : (
                      "Clear month"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

        {!loading &&
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

        {!loading && noteCount > 0 && isJs && (
          <div className="mt-4 text-[12.5px] tok-punc">{"}"}</div>
        )}
      </div>
    </AppShell>
  );
};

export default HomePage;
