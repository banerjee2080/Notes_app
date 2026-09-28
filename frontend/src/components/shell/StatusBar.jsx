import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { RefreshCw, SquareTerminal, X } from "lucide-react";
import { useSyncStore } from "../../stores/useSyncStore.js";
import { useAuthStore } from "../../stores/useAuthStore.js";
import { useUiStore } from "../../stores/useUiStore.js";
import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";
import {
  TICKER_FACTS,
  CONSOLE_HELP,
  CONSOLE_ANSWERS,
  GOTCHAS,
} from "../../lib/jsLore.js";

const WELCOME = [
  { t: "com", v: "// Note.js console — a safe playground. Nothing typed here is executed." },
  { t: "com", v: "// Type 'help' for commands or 'gotchas' for classic JavaScript surprises." },
];

// Bottom bar: [Note.Js] >> Ready.   [ES6] rotating fact        Console >_
const StatusBar = () => {
  const { isSyncing } = useSyncStore();
  const isOnline = useOnlineStatus();
  const { consoleOpen, setConsoleOpen } = useUiStore();
  const [factIdx, setFactIdx] = useState(() => Math.floor(Math.random() * TICKER_FACTS.length));

  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % TICKER_FACTS.length), 7000);
    return () => clearInterval(id);
  }, []);

  const fact = TICKER_FACTS[factIdx];

  return (
    <div className="relative shrink-0">
      {consoleOpen && <ConsoleDrawer onClose={() => setConsoleOpen(false)} />}

      <div className="flex items-center justify-between gap-3 h-9 px-3 md:px-4 border-t ide-divider bg-[var(--panel)] text-[12px] select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="flex items-center gap-1.5 min-w-0 hover:opacity-80"
            title="Open console"
          >
            <span className="tok-ok">[Note.Js]</span>
            <span className="tok-punc">{">>"}</span>
            {isSyncing ? (
              <span className="flex items-center gap-1.5 tok-fn">
                <RefreshCw className="size-3 animate-spin" /> await sync()
              </span>
            ) : (
              <span className={isOnline ? "text-[var(--fg)] caret" : "tok-warn"}>
                {isOnline ? "Ready." : "Offline — saving locally."}
              </span>
            )}
            <span className="hidden lg:inline tok-com truncate">
              &nbsp;(Type 'help' for common gotchas)
            </span>
          </button>
        </div>

        <div
          className="hidden md:flex items-center gap-2 min-w-0 animate-fade-in"
          key={factIdx}
          title="JavaScript through the years"
        >
          <span className="js-badge h-5 min-w-5 px-1 text-[10px] items-center justify-center !p-0 !px-1">
            {fact.tag}
          </span>
          <span className="truncate ide-chip !py-0.5">{fact.text}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5" title={isOnline ? "Online" : "Offline"}>
            <span className={`size-2 rounded-full ${isOnline ? "bg-[var(--ok)]" : "bg-[var(--err)] animate-pulse"}`} />
            <span className="hidden sm:inline tok-dim">{isOnline ? "navigator.onLine" : "!navigator.onLine"}</span>
          </span>
          <button
            type="button"
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="flex items-center gap-1.5 tok-fn hover:underline"
          >
            <span className="hidden sm:inline">Console</span>
            <SquareTerminal className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ConsoleDrawer = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, toggleThemeMode } = useAuthStore();
  const [lines, setLines] = useState(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const run = (raw) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const key = cmd.toLowerCase().replace(/;$/, "");
    const out = [{ t: "in", v: cmd }];

    if (key === "clear" || key === "console.clear()") {
      setLines([]);
      return;
    } else if (key === "help") {
      CONSOLE_HELP.forEach(([c, d]) => out.push({ t: "help", v: c, d }));
    } else if (key === "gotchas") {
      GOTCHAS.forEach((g) => {
        out.push({ t: "in", v: g });
        out.push(CONSOLE_ANSWERS[g][0]);
      });
    } else if (key === "history") {
      navigate("/history");
      out.push({ t: "com", v: "// opening the timeline…" });
    } else if (key === "new" || key === "new note()" || key === "new note") {
      navigate("/createNote", { state: { backgroundLocation: location } });
      out.push({ t: "ok", v: "✓ new Note()" });
    } else if (key === "theme") {
      toggleThemeMode();
      out.push({ t: "ok", v: "✓ theme toggled" });
    } else if (key === "whoami") {
      out.push({ t: "str", v: `'${authUser?.fullName || "anonymous"}'` });
      out.push({ t: "com", v: `// ${authUser?.email || ""}` });
    } else if (key === "exit" || key === "close") {
      onClose();
      return;
    } else if (CONSOLE_ANSWERS[key]) {
      out.push(...CONSOLE_ANSWERS[key]);
    } else {
      const ident = cmd.split(/[^\w$]/)[0] || cmd;
      out.push({ t: "err", v: `Uncaught ReferenceError: ${ident} is not defined` });
    }
    setLines((l) => [...l, ...out]);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      run(input);
      if (input.trim()) setHistory((h) => [input, ...h].slice(0, 30));
      setInput("");
      setHIdx(-1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(hIdx + 1, history.length - 1);
      if (history[next] !== undefined) {
        setHIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = hIdx - 1;
      setHIdx(Math.max(next, -1));
      setInput(next >= 0 ? history[next] : "");
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="absolute bottom-full inset-x-0 z-50 border-t ide-divider bg-[var(--win)] animate-slide-up shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between px-4 h-8 border-b ide-divider text-[12px] bg-[var(--panel)]">
        <div className="flex items-center gap-4">
          <span className="text-[var(--fg)] border-b-2 border-[var(--kw)] h-8 flex items-center">CONSOLE</span>
          <span className="tok-dim hidden sm:inline">PROBLEMS <span className="ide-chip !py-0 !px-1.5">0</span></span>
        </div>
        <button type="button" onClick={onClose} className="ide-icon-btn !w-6 !h-6" aria-label="Close console">
          <X className="size-3.5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-52 overflow-y-auto ide-scroll px-4 py-2 text-[12.5px] leading-6"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <ConsoleLine key={i} line={l} />
        ))}
        <div className="flex items-center gap-2">
          <span className="tok-fn">{">"}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="Console input"
            className="flex-1 bg-transparent outline-none text-[var(--fg)] font-mono"
            placeholder="help"
          />
        </div>
      </div>
    </div>
  );
};

const ConsoleLine = ({ line }) => {
  if (line.t === "in")
    return (
      <div className="text-[var(--fg)]">
        <span className="tok-fn">{">"} </span>
        {line.v}
      </div>
    );
  if (line.t === "help")
    return (
      <div>
        <span className="tok-str inline-block min-w-40">{line.v}</span>
        <span className="tok-com">// {line.d}</span>
      </div>
    );
  if (line.t === "err")
    return (
      <div className="tok-err bg-[color-mix(in_srgb,var(--err)_8%,transparent)] -mx-4 px-4 border-y border-[color-mix(in_srgb,var(--err)_25%,transparent)]">
        ✕ {line.v}
      </div>
    );
  return (
    <div className={`pl-4 tok-${line.t}`}>
      <span className="tok-dim">{"< "}</span>
      {line.v}
    </div>
  );
};

export default StatusBar;
