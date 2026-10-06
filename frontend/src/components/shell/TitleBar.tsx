import { useState } from "react";
import { Link } from "react-router";
import { Menu, Minus, Square, Copy, X } from "lucide-react";
import toast from "react-hot-toast";
import { LANGUAGE_NAMES } from "../../lib/jsLore";
import { useUiStore } from "../../stores/useUiStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useVoice } from "../../lib/voice";
import { strike } from "../../lib/monochord";

// Pythagoras' badge walks through the ratios of the tetractys.
const RATIOS = [
  { r: "2 : 1", name: "the octave", note: "Halve the string, the note climbs an octave." },
  { r: "3 : 2", name: "the fifth", note: "Two-thirds of the string sounds a fifth higher." },
  { r: "4 : 3", name: "the fourth", note: "Three-quarters of the string: a fourth." },
  { r: "1+2+3+4", name: "the tetractys", note: "Those four numbers hold every ratio above, and sum to ten." },
];

// console.log("Welcome to Note.Js");  [JS]            [_] [□] [x]
const TitleBar = () => {
  const { toggleSidebar, maximized, toggleMaximized } = useUiStore();
  const [nameIdx, setNameIdx] = useState(0);
  const [ratioIdx, setRatioIdx] = useState(0);
  const { logout } = useAuthStore();
  const { theme, voice } = useVoice();

  // Easter egg: the JS badge walks through the language's former names.
  const cycleName = () => {
    const next = (nameIdx + 1) % LANGUAGE_NAMES.length;
    setNameIdx(next);
    const { name, year, note } = LANGUAGE_NAMES[next];
    toast(`${year}: ${name}. ${note}`, { id: "lang-name", icon: "📜" });
  };

  // ✕ closes the session. logout() syncs first and warns about unsent notes.
  const onClose = () => {
    logout();
  };

  const langName = LANGUAGE_NAMES[nameIdx].name;

  const plucked = () => {
    const { r, name, note } = RATIOS[ratioIdx];
    setRatioIdx((ratioIdx + 1) % RATIOS.length);
    strike(ratioIdx === 3 ? "tetractys" : ratioIdx === 0 ? "octave" : ratioIdx === 1 ? "fifth" : "fourth", { force: true });
    toast(`${r}, ${name}. ${note}`, { id: "ratio", icon: "𝄞" });
  };

  return (
    <div className="ide-titlebar flex items-center justify-between gap-3 px-3 md:px-4 h-12 shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={toggleSidebar}
          className="ide-icon-btn md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-4" />
        </button>

        {voice === null ? (
          <>
            <Link to="/" className="flex items-center gap-0 min-w-0 text-[15px] md:text-base truncate">
              <span className="hidden sm:inline text-[var(--fg)]">console</span>
              <span className="hidden sm:inline tok-punc">.</span>
              <span className="hidden sm:inline tok-fn">log</span>
              <span className="hidden sm:inline tok-punc">(</span>
              <span className="tok-str truncate">
                <span className="hidden sm:inline">"Welcome to </span>Note.{langName === "JavaScript" ? "Js" : langName}
                <span className="hidden sm:inline">"</span>
              </span>
              <span className="hidden sm:inline tok-punc">);</span>
            </Link>

            <button
              type="button"
              onClick={cycleName}
              className="js-badge w-7 h-7 text-[13px] ml-1 shrink-0 hover:rotate-[-6deg] transition-transform"
              title="Click me. JavaScript has had a few names…"
              aria-label="Cycle through JavaScript's historical names"
            >
              JS
            </button>
          </>
        ) : theme === "pythagoras" ? (
          <>
            <button
              type="button"
              onClick={plucked}
              className="js-badge w-7 h-7 text-[11px] shrink-0 hover:-translate-y-px transition-transform"
              title="Pluck the monochord"
              aria-label="Play a Pythagorean ratio"
            >
              Π
            </button>
            <Link to="/" className="flex items-baseline gap-2 min-w-0 truncate">
              <span className="text-[17px] font-semibold tracking-[.22em]">{voice.brand}</span>
              <span className="hidden sm:inline text-[13px] tok-dim tracking-[.3em]">ΣΤΟΙΧΕΙΑ</span>
            </Link>
          </>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 min-w-0 truncate">
            <span className="js-badge w-7 h-7 text-[13px] font-bold shrink-0" aria-hidden="true">
              N
            </span>
            <span className="text-[16px] font-semibold tracking-tight">{voice.brand}</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:inline-flex ide-icon-btn !w-7 !h-7 border !border-[var(--line)]"
          title="Minimise sidebar"
          aria-label="Toggle sidebar"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleMaximized}
          className="hidden md:inline-flex ide-icon-btn !w-7 !h-7 border !border-[var(--line)]"
          title={maximized ? "Restore window" : "Maximise window"}
          aria-label="Toggle maximised window"
        >
          {maximized ? <Copy className="size-3" /> : <Square className="size-3" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="ide-icon-btn is-danger !w-7 !h-7 border !border-[var(--line)]"
          title={voice ? "Sign out" : "process.exit() — sign out"}
          aria-label="Sign out"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
