import { Link, useLocation } from "react-router";
import { Plus } from "lucide-react";
import { lazy, Suspense } from "react";
import { useVoice } from "../lib/voice";

const ProofAnimation = lazy(() => import("./pythagoras/ProofAnimation"));

// Empty state: the notes array is literally empty.
const NotesNotFound = () => {
  const location = useLocation();
  const { theme, voice } = useVoice();

  if (voice && theme === "pythagoras")
    return (
      <div className="max-w-2xl mx-auto mt-8 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up grid sm:grid-cols-[200px_1fr]">
        <figure className="relative hidden sm:block border-r ide-divider">
          <img src="/themes/raphael-pythagoras.webp" alt="Pythagoras writing in a book while a boy holds up a slate of ratios" className="h-full w-full object-cover" />
          <figcaption className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 text-[11px] leading-snug text-white/90 bg-gradient-to-t from-black/75 to-transparent normal-case tracking-normal">
            Raphael, <i>The School of Athens</i>, 1511
          </figcaption>
        </figure>
        <div className="p-6 flex flex-col items-start gap-4">
          <Suspense fallback={<span className="h-[200px]" />}>
            <ProofAnimation size={150} />
          </Suspense>
          <div>
            <h2 className="text-[22px] leading-tight" style={{ fontFamily: "var(--font-content)" }}>{voice.empty.title}</h2>
            <p className="mt-1 tok-dim text-[15px]" style={{ fontFamily: "var(--font-content)" }}>{voice.empty.body}</p>
          </div>
          <Link to="/createNote" state={{ backgroundLocation: location }} className="ide-btn ide-btn-primary">
            <Plus className="size-4" />
            {voice.empty.cta}
          </Link>
        </div>
      </div>
    );

  if (voice)
    return (
      <div className="max-w-lg mx-auto mt-10 ide-card !bg-[var(--panel)] overflow-hidden animate-slide-up">
        <div className="h-28 bg-cover bg-[center_70%]" style={{ backgroundImage: "url('/themes/sekka-pines.webp')" }} aria-hidden="true" />
        <div className="p-6">
          <h2 className="text-[22px] font-semibold" style={{ fontFamily: "var(--font-content)" }}>{voice.empty.title}</h2>
          <p className="mt-1.5 tok-dim leading-relaxed">{voice.empty.body}</p>
          <Link to="/createNote" state={{ backgroundLocation: location }} className="ide-btn ide-btn-primary mt-5">
            <Plus className="size-4" />
            {voice.empty.cta}
          </Link>
        </div>
      </div>
    );

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
