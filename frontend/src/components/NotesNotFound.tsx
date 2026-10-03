import { Link, useLocation } from "react-router";
import { Plus } from "lucide-react";

// Empty state: the notes array is literally empty.
const NotesNotFound = () => {
  const location = useLocation();
  return (
    <div className="max-w-lg mx-auto mt-10 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up">
      <div className="px-4 py-2 border-b ide-divider text-[12px] tok-dim">notes.js</div>
      <pre className="px-5 py-5 text-[13.5px] leading-7 whitespace-pre-wrap font-mono">
        <span className="tok-kw">const</span> notes <span className="tok-punc">=</span> <span className="tok-punc">[];</span>
        {"\n"}
        <span className="tok-fn">console</span>
        <span className="tok-punc">.</span>
        <span className="tok-fn">log</span>
        <span className="tok-punc">(</span>notes<span className="tok-punc">.</span>length<span className="tok-punc">);</span>{" "}
        <span className="tok-com">// 0</span>
        {"\n\n"}
        <span className="tok-com">{"// Nothing here yet. Every great program starts with a blank file."}</span>
      </pre>
      <div className="px-5 pb-5">
        <Link
          to="/createNote"
          state={{ backgroundLocation: location }}
          className="ide-btn ide-btn-ok"
        >
          <Plus className="size-4" />
          <span>
            notes.push(<span className="tok-kw">new</span> Note())
          </span>
        </Link>
      </div>
    </div>
  );
};
export default NotesNotFound;
