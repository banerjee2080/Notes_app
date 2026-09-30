import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { RefreshCw, SquareTerminal, X } from "lucide-react";
import { useSyncStore } from "../../stores/useSyncStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useUiStore } from "../../stores/useUiStore";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import {
  TICKER_FACTS,
  CONSOLE_HELP,
  CONSOLE_ANSWERS,
  GOTCHAS,
  type TokenKind,
} from "../../lib/jsLore";
import {
  listNotes,
  resolveNote,
  moveToBin,
  emptyBin,
  titleOf,
  SHORT_ID,
} from "../../lib/noteCommands";
import { timeAgo } from "../../lib/utils";
import { errorMessage } from "../../lib/errors";
import { userIdOf } from "../../types/user";

const BIN_WORDS = [
  "bin",
  "recycle bin",
  "recyclebin",
  "recycle-bin",
  "recycle_bin",
];

/** Plain output, coloured by token kind. `sensitive` lines hide once locked. */
interface ConsoleOutLine {
  t: TokenKind;
  v: string;
  sensitive?: boolean;
}

/** One note listed by `ls`; `title` is null while the vault is locked. */
interface ConsoleRowLine {
  t: "row";
  id: string;
  fullId: string;
  title: string | null;
  when: string;
  sensitive: true;
}

type ConsoleLine =
  | { t: "in"; v: string }
  | { t: "help"; v: string; d: string }
  | ConsoleRowLine
  | ConsoleOutLine;

const WELCOME: ConsoleLine[] = [
  {
    t: "com",
    v: "// Note.js console — a safe playground. Nothing typed here is executed.",
  },
  {
    t: "com",
    v: "// Type 'help' for commands or 'gotchas' for classic JavaScript surprises.",
  },
];

// Bottom bar: [Note.Js] >> Ready.   [ES6] rotating fact        Console >_
const StatusBar = () => {
  const { isSyncing } = useSyncStore();
  const isOnline = useOnlineStatus();
  const { consoleOpen, setConsoleOpen } = useUiStore();
  const [factIdx, setFactIdx] = useState(() =>
    Math.floor(Math.random() * TICKER_FACTS.length),
  );

  useEffect(() => {
    const id = setInterval(
      () => setFactIdx((i) => (i + 1) % TICKER_FACTS.length),
      7000,
    );
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
          <span
            className="flex items-center gap-1.5"
            title={isOnline ? "Online" : "Offline"}
          >
            <span
              className={`size-2 rounded-full ${isOnline ? "bg-[var(--ok)]" : "bg-[var(--err)] animate-pulse"}`}
            />
            <span className="hidden sm:inline tok-dim">
              {isOnline ? "navigator.onLine" : "!navigator.onLine"}
            </span>
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

const ConsoleDrawer = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, toggleThemeMode, lockVault, cryptoKey } = useAuthStore();
  const userId = userIdOf(authUser);
  const [lines, setLines] = useState<ConsoleLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  // Async commands print after the fact; the "> cmd" echo is already on screen.
  const print = (more: ConsoleLine[]) => setLines((l) => [...l, ...more]);

  /** Note commands need a signed-in id; the drawer only renders when there is one. */
  const requireUser = (cmd: string): string | null => {
    if (userId) return userId;
    print([{ t: "err", v: `${cmd}: not signed in` }]);
    return null;
  };

  // ls            -> notes    |  ls bin -> recycle bin contents
  const runLs = async (args: string[]) => {
    const uid = requireUser("ls");
    if (!uid) return;
    const target = args.join(" ");
    const inBin = BIN_WORDS.includes(target);
    if (target && !inBin) {
      print([
        { t: "err", v: `ls: cannot access '${target}': try \`ls\` or \`ls bin\`` },
      ]);
      return;
    }
    const rows = await listNotes(uid, cryptoKey, { deleted: inBin });
    if (rows.length === 0) {
      print([
        {
          t: "com",
          v: inBin ? "// RecycleBin() is empty" : "// no notes yet — try `new`",
        },
      ]);
      return;
    }
    print([
      {
        t: "com",
        v:
          `// ${rows.length} ${inBin ? "in RecycleBin()" : rows.length === 1 ? "note" : "notes"}` +
          (inBin
            ? " — `rm recycle bin` empties it (online only)"
            : " — `rm <id>` moves one to the bin"),
      },
      ...rows.map(
        (r): ConsoleRowLine => ({
          t: "row",
          id: r.id.slice(0, SHORT_ID),
          fullId: r.id,
          title: r.title, // null when locked -> rendered as 🔒
          when: timeAgo(r.updated_at),
          sensitive: true,
        }),
      ),
    ]);
  };

  // rm <id> [<id> ...]  -> soft delete  |  rm recycle bin -> empty the bin
  const runRm = async (args: string[]) => {
    const uid = requireUser("rm");
    if (!uid) return;
    const operands = args.filter((a) => !/^-[rf]+$/.test(a)); // ignore -r / -f / -rf
    const joined = operands.join(" ").toLowerCase();

    if (operands.length === 0) {
      print([
        { t: "err", v: "rm: missing operand — usage: rm <id> | rm recycle bin" },
      ]);
      return;
    }

    if (BIN_WORDS.includes(joined)) {
      try {
        const n = await emptyBin(uid);
        print([
          {
            t: "ok",
            v: `✓ RecycleBin() emptied — ${n} ${n === 1 ? "note" : "notes"} permanently deleted`,
          },
        ]);
      } catch (err) {
        print([
          { t: "err", v: `rm: cannot empty RecycleBin(): ${errorMessage(err)}` },
        ]);
      }
      return;
    }

    for (const idArg of operands) {
      const resolved = await resolveNote(uid, idArg);
      if (!resolved.ok) {
        print([{ t: "err", v: resolved.error }]);
        continue;
      }
      const { note } = resolved;
      await moveToBin(uid, note.id);
      const title = await titleOf(note, cryptoKey);
      print([
        {
          t: "ok",
          v: `✓ moved ${title ? `'${title}'` : "note"} (${note.id.slice(0, SHORT_ID)}) to RecycleBin()`,
          sensitive: Boolean(title),
        },
      ]);
    }
  };

  // touch <id>  -> open that note in the editor (same modal as clicking its card)
  const runTouch = async (args: string[]) => {
    const uid = requireUser("touch");
    if (!uid) return;
    if (args.length === 0) {
      print([
        {
          t: "err",
          v: "touch: missing operand — usage: touch <id>  (ids come from `ls`)",
        },
      ]);
      return;
    }
    if (args.length > 1) {
      print([{ t: "err", v: "touch: one note at a time — usage: touch <id>" }]);
      return;
    }
    const resolved = await resolveNote(uid, args[0], "touch");
    if (!resolved.ok) {
      print([{ t: "err", v: resolved.error }]);
      return;
    }
    const { note } = resolved;
    const title = await titleOf(note, cryptoKey);
    print([
      {
        t: "ok",
        v: `✓ opening ${title ? `'${title}'` : "note"} (${note.id.slice(0, SHORT_ID)})`,
        sensitive: Boolean(title),
      },
    ]);
    onClose(); // the editor opens as a modal on top; get the drawer out of the way
    navigate(`/note/${note.id}`, { state: { backgroundLocation: location } });
  };

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const key = cmd.toLowerCase().replace(/;$/, "");
    const out: ConsoleLine[] = [{ t: "in", v: cmd }];
    let after: (() => void) | null = null; // async command to start once the echo is printed

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
    } else if (key === "lock" || key === "vault.lock()") {
      lockVault().then(() =>
        navigate("/pin", { state: { backgroundLocation: location } }),
      );
      out.push({ t: "ok", v: "✓ vault locked — key wiped from memory" });
    } else if (key === "whoami") {
      out.push({ t: "str", v: `'${authUser?.fullName || "anonymous"}'` });
      out.push({ t: "com", v: `// ${authUser?.email || ""}` });
    } else if (key === "exit" || key === "close") {
      onClose();
      return;
    } else if (CONSOLE_ANSWERS[key]) {
      out.push(...CONSOLE_ANSWERS[key]);
    } else if (/^ls(\s|$)/.test(key)) {
      after = () => void runLs(key.split(/\s+/).slice(1));
    } else if (/^touch(\s|$)/.test(key)) {
      after = () => void runTouch(cmd.split(/\s+/).slice(1));
    } else if (/^rm(\s|$)/.test(key)) {
      after = () => void runRm(cmd.split(/\s+/).slice(1));
    } else {
      const ident = cmd.split(/[^\w$]/)[0] || cmd;
      out.push({
        t: "err",
        v: `Uncaught ReferenceError: ${ident} is not defined`,
      });
    }
    setLines((l) => [...l, ...out]);
    after?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
          <span className="text-[var(--fg)] border-b-2 border-[var(--kw)] h-8 flex items-center">
            CONSOLE
          </span>
          <span className="tok-dim hidden sm:inline">
            PROBLEMS <span className="ide-chip !py-0 !px-1.5">0</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ide-icon-btn !w-6 !h-6"
          aria-label="Close console"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-52 overflow-y-auto ide-scroll px-4 py-2 text-[12.5px] leading-6"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <ConsoleLineView key={i} line={l} locked={!cryptoKey} />
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

const ConsoleLineView = ({
  line,
  locked,
}: {
  line: ConsoleLine;
  locked: boolean;
}) => {
  // Anything that printed a decrypted title is hidden again once the vault locks.
  if ("sensitive" in line && line.sensitive && locked && line.t !== "row")
    return <div className="pl-4 tok-com">{"< // hidden — vault locked"}</div>;
  if (line.t === "row")
    return (
      <div className="pl-4 flex gap-3 min-w-0" title={line.fullId}>
        <span className="tok-num shrink-0 tabular-nums">{line.id}</span>
        <span className="truncate text-[var(--fg)] min-w-0">
          {line.title === null || locked ? (
            <span className="tok-warn">🔒 encrypted</span>
          ) : (
            line.title
          )}
        </span>
        <span className="tok-com shrink-0 ml-auto">
          {"// "}
          {line.when}
        </span>
      </div>
    );
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
