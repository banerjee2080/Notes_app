import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Menu, Minus, Square, Copy, X } from "lucide-react";
import toast from "react-hot-toast";
import { LANGUAGE_NAMES } from "../../lib/jsLore";
import { useUiStore } from "../../stores/useUiStore";
import { useAuthStore } from "../../stores/useAuthStore";

// console.log("Welcome to Note.Js");  [JS]            [_] [□] [x]
const TitleBar = () => {
  const { toggleSidebar, maximized, toggleMaximized } = useUiStore();
  const [nameIdx, setNameIdx] = useState(0);
  const { lockVault } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Easter egg: the JS badge walks through the language's former names.
  const cycleName = () => {
    const next = (nameIdx + 1) % LANGUAGE_NAMES.length;
    setNameIdx(next);
    const { name, year, note } = LANGUAGE_NAMES[next];
    toast(`${year}: ${name}. ${note}`, { id: "lang-name", icon: "📜" });
  };

  // ✕ locks the vault: wipe the key, then show the PIN screen over this page.
  const onClose = async () => {
    await lockVault();
    toast.success("vault.lock() — key wiped from memory", { id: "vault-lock" });
    navigate("/pin", { state: { backgroundLocation: location } });
  };

  const langName = LANGUAGE_NAMES[nameIdx].name;

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
          title="vault.lock() — lock your notes"
          aria-label="Lock vault"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
