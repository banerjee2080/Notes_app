// frontend/src/components/code/CodeEditorModal.tsx
//
// Replaces TinyMCE's plain "Insert/Edit Code Sample" textarea with a real
// code editor: syntax colours, auto-indent, bracket matching, completion,
// red squiggles for errors, Format, and Run with stdin - all offline.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { EditorView } from "@codemirror/view";
import { indentUnit, indentRange } from "@codemirror/language";
import {
  Play,
  Square,
  Wand2,
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileCode2,
} from "lucide-react";
import {
  createEditorState,
  languageSlot,
  indentSlot,
  indentFor,
  type EditorActions,
} from "./editorSetup";
import {
  LANGUAGES,
  getLanguage,
  rememberLanguage,
  isRunnerLanguage,
} from "../../lib/code/languages";
import { formatCode, formatErrorMessage } from "../../lib/code/format";
import {
  setExternalDiagnostics,
  toEditorDiagnostics,
} from "../../lib/code/lint";
import * as runner from "../../lib/code/runnerClient";
import type {
  CompilerDiagnostic,
  OfflineStatus,
  OutputStream,
  RunnerLanguage,
  RunnerState,
  Termination,
} from "../../types/runner";
import "./codeEditor.css";

const CHECK_DELAY_MS = 1200;

const TERMINATION_TEXT: Partial<Record<Termination, string>> = {
  "instruction-limit": "Stopped: the program ran too long (instruction limit).",
  "logical-time-limit": "Stopped: time limit exceeded (20 s).",
  "wall-time-limit": "Stopped: time limit exceeded (20 s).",
  "memory-limit": "Stopped: memory limit exceeded (512 MB).",
  "output-limit": "Stopped: output limit exceeded (1 MB).",
  "filesystem-limit": "Stopped: the program wrote too many files.",
};

const secs = (ms: number | undefined): string =>
  ms === undefined ? "?" : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;

interface CodeEditorModalProps {
  initialCode?: string;
  initialLanguage: string;
  isEdit?: boolean;
  /** Hands the finished snippet back to TinyMCE as (prismLanguage, code). */
  onSave: (prismLanguage: string, code: string) => void;
  onClose: () => void;
}

/** One chunk of program output, merged with the previous chunk of the same stream. */
interface OutputChunk {
  stream: OutputStream | "info";
  text: string;
}

/** The single line of feedback under the editor. */
interface StatusLine {
  tone: "ok" | "err" | "busy" | "info";
  text: string;
}

/** The request currently occupying the runner. */
interface RunningJob {
  id: string;
  kind: "run" | "prefetch";
}

type IoTab = "input" | "output" | "problems";

export default function CodeEditorModal({
  initialCode = "",
  initialLanguage,
  isEdit = false,
  onSave,
  onClose,
}: CodeEditorModalProps) {
  const [langId, setLangId] = useState(initialLanguage);
  const lang = getLanguage(langId);
  const canRun = !!lang.run;
  const runnerLanguage: RunnerLanguage | null = isRunnerLanguage(lang.run)
    ? lang.run
    : null;
  const usesRunner = runnerLanguage !== null;

  const [code, setCode] = useState(initialCode);
  const [stdin, setStdin] = useState("");
  const [tab, setTab] = useState<IoTab>("input");
  const [output, setOutput] = useState<OutputChunk[]>([]);
  // Editor diagnostics shown in the Problems tab.
  const [problems, setProblems] = useState<CompilerDiagnostic[]>([]);
  const [status, setStatus] = useState<StatusLine | null>(null);
  const [running, setRunning] = useState<RunningJob | null>(null);
  const [runnerState, setRunnerState] = useState<RunnerState>(
    runner.getRunnerState(),
  );
  const [offline, setOffline] = useState<OfflineStatus>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const ranThisSession = useRef(new Set<string>());
  const checkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // ---- editor mount ------------------------------------------------------
  // Keyboard shortcuts call through a ref, so they always see fresh state.
  const actions = useRef<EditorActions>({
    run() {},
    format() {},
    save() {},
  });

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: createEditorState(initialCode, actions, setCode),
      parent: hostRef.current,
    });
    viewRef.current = view;
    view.focus();
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Swap the grammar + indentation whenever the language changes.
  useEffect(() => {
    let cancelled = false;
    rememberLanguage(langId);
    lang.load().then((support) => {
      if (cancelled || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: [
          languageSlot.reconfigure(support),
          indentSlot.reconfigure(indentUnit.of(indentFor(langId))),
          setExternalDiagnostics.of({ diagnostics: [], verified: false }),
        ],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [langId, lang]);

  const changeLanguage = (id: string) => {
    setLangId(id);
    setProblems([]); // old compiler messages don't apply to the new language
    setPreviewHtml(null);
  };

  // ---- runner state / offline status -----------------------------------
  useEffect(() => runner.onRunnerState(setRunnerState), []);

  useEffect(() => {
    if (!runnerLanguage) return;
    let alive = true;
    runner.ensureRunner().then(async (s) => {
      if (!alive || s.phase !== "ready") return;
      const st = await runner.offlineStatus([runnerLanguage]);
      if (alive) setOffline((o) => ({ ...o, ...st }));
    });
    return () => {
      alive = false;
    };
  }, [runnerLanguage, runnerState.phase]);

  // ---- diagnostics helpers ---------------------------------------------
  const showDiagnostics = useCallback(
    (diags: CompilerDiagnostic[], verified: boolean, forText?: string) => {
      const view = viewRef.current;
      if (!view) return;
      // A check that finished after more typing describes old text - ignore it.
      if (forText !== undefined && forText !== view.state.doc.toString()) return;
      const mapped = toEditorDiagnostics(view.state.doc, diags);
      view.dispatch({
        effects: setExternalDiagnostics.of({ diagnostics: mapped, verified }),
      });
      setProblems(diags);
    },
    [],
  );

  const jumpTo = (d: CompilerDiagnostic) => {
    const view = viewRef.current;
    if (!view || !d.line || d.line > view.state.doc.lines) return;
    const line = view.state.doc.line(d.line);
    const pos = Math.min(line.from + Math.max(0, (d.column || 1) - 1), line.to);
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
    view.focus();
  };

  // ---- background compile check (real compiler red-lines) ---------------
  // Only when this language's toolchain is already downloaded (or was used
  // this session), so typing never triggers a surprise 40 MB download.
  useEffect(() => {
    clearTimeout(checkTimer.current);
    // Python has no compile step to check; its Lezer grammar is accurate.
    if (
      !runnerLanguage ||
      runnerLanguage === "python" ||
      runnerState.phase !== "ready" ||
      running
    )
      return;
    if (!offline[runnerLanguage] && !ranThisSession.current.has(runnerLanguage))
      return;
    if (!code.trim()) return;
    if (runnerLanguage === "java" && !runnerState.wasmGc) return;
    checkTimer.current = setTimeout(async () => {
      const text = code;
      const res = await runner.checkCode({ language: runnerLanguage, code: text });
      if (!res.superseded && res.diagnostics)
        showDiagnostics(res.diagnostics, true, text);
    }, CHECK_DELAY_MS);
    return () => clearTimeout(checkTimer.current);
  }, [
    code,
    runnerLanguage,
    runnerState.phase,
    runnerState.wasmGc,
    offline,
    running,
    showDiagnostics,
  ]);

  // ---- actions -----------------------------------------------------------
  const append = (stream: OutputChunk["stream"], text: string) =>
    setOutput((o) => {
      const last = o[o.length - 1];
      if (last && last.stream === stream)
        return [...o.slice(0, -1), { stream, text: last.text + text }];
      return [...o, { stream, text }];
    });

  const format = async () => {
    const view = viewRef.current;
    if (!view) return;
    const before = view.state.doc.toString();
    try {
      const formatted = await formatCode(lang, before);
      if (formatted === null) {
        // No formatter for this language: re-indent with the grammar.
        view.dispatch({
          changes: indentRange(view.state, 0, view.state.doc.length),
        });
        setStatus({
          tone: "info",
          text: "Re-indented (no formatter for this language).",
        });
        return;
      }
      if (view.state.doc.toString() !== before) return; // user typed meanwhile
      if (formatted !== before) {
        const head = Math.min(view.state.selection.main.head, formatted.length);
        view.dispatch({
          changes: { from: 0, to: before.length, insert: formatted },
          selection: { anchor: head },
        });
      }
      setStatus({ tone: "ok", text: "Formatted." });
    } catch (err) {
      setStatus({
        tone: "err",
        text: `Format failed: ${formatErrorMessage(err)}`,
      });
    }
  };

  const run = async () => {
    const view = viewRef.current;
    if (!view || running) return;
    const text = view.state.doc.toString();

    if (!canRun) {
      setStatus({
        tone: "info",
        text: lang.runNote || `${lang.label} can't be run here.`,
      });
      return;
    }
    if (lang.run === "html-preview") {
      setPreviewHtml(text);
      setTab("output");
      setStatus({
        tone: "ok",
        text: "Preview updated (sandboxed, scripts can't reach your notes).",
      });
      return;
    }
    if (!runnerLanguage) return;

    setTab("output");
    setOutput([]);
    setStatus({ tone: "busy", text: "Starting runner…" });
    const s = await runner.ensureRunner();
    if (s.phase !== "ready") {
      setStatus({
        tone: "info",
        text: "Your browser needs the runner in its own small window - click “Open runner window”.",
      });
      return;
    }
    if (runnerLanguage === "java" && !s.wasmGc) {
      setStatus({
        tone: "err",
        text: "Java needs WebAssembly GC (Chrome/Edge 119+, Firefox 120+, Safari 18.2+).",
      });
      return;
    }

    clearTimeout(checkTimer.current);
    const { id, promise } = runner.runCode(
      { language: runnerLanguage, code: text, stdin },
      {
        onStream: (stream, chunk) => append(stream, chunk),
        onProgress: (label, p) =>
          setStatus({
            tone: "busy",
            text: p != null ? `${label} ${Math.round(p * 100)}%` : `${label}…`,
          }),
      },
    );
    setRunning({ id, kind: "run" });
    const res = await promise;
    setRunning(null);
    ranThisSession.current.add(runnerLanguage);
    // The run just downloaded (and the service worker cached) the toolchain.
    runner
      .offlineStatus([runnerLanguage])
      .then((st) => setOffline((o) => ({ ...o, ...st })));

    if (res.stage === "cancelled") {
      append("info", "\n[stopped]\n");
      setStatus({ tone: "info", text: "Stopped." });
      return;
    }
    if (res.stage === "error") {
      setStatus({ tone: "err", text: `Runner error: ${res.error}` });
      return;
    }

    // The compiler has now seen exactly this text, so trust it over Lezer.
    showDiagnostics(res.diagnostics || [], true, text);

    if (res.stage === "compile") {
      setOutput([
        { stream: "stderr", text: res.compileOutput || "Compilation failed." },
      ]);
      setStatus({
        tone: "err",
        text: `Compilation failed · ${(res.diagnostics || []).length} problem(s)`,
      });
      if ((res.diagnostics || []).length) setTab("problems");
      return;
    }

    // Replace the live stream with the final, cleaned output.
    const final: OutputChunk[] = [];
    if (res.stdout) final.push({ stream: "stdout", text: res.stdout });
    if (res.stderr) final.push({ stream: "stderr", text: res.stderr });
    if (!final.length) final.push({ stream: "info", text: "(no output)\n" });
    setOutput(final);

    const timing = `${res.cached ? "cached build" : `compile ${secs(res.compileMs)}`} · run ${secs(res.runMs)}`;
    const terminationText = res.termination
      ? TERMINATION_TEXT[res.termination]
      : undefined;
    if (terminationText)
      setStatus({ tone: "err", text: `${terminationText} · ${timing}` });
    else if (res.termination === "trap")
      setStatus({
        tone: "err",
        text: `Crashed: ${res.trapMessage || "runtime trap"} · ${timing}`,
      });
    else
      setStatus({
        tone: res.exitCode === 0 ? "ok" : "err",
        text: `Exit code ${res.exitCode} · ${timing}`,
      });
  };

  const stop = () => running && runner.cancel(running.id);

  const makeOffline = async () => {
    if (running || !runnerLanguage) return;
    setStatus({
      tone: "busy",
      text: `Preparing ${lang.label} for offline use…`,
    });
    const s = await runner.ensureRunner();
    if (s.phase !== "ready") return;
    const { id, promise } = runner.prefetch([runnerLanguage], {
      onProgress: (label, p) =>
        setStatus({
          tone: "busy",
          text: p != null ? `${label} ${Math.round(p * 100)}%` : `${label}…`,
        }),
    });
    setRunning({ id, kind: "prefetch" });
    const res = await promise;
    setRunning(null);
    if (res.ok) {
      setOffline((o) => ({ ...o, ...res.status }));
      setStatus({ tone: "ok", text: `${lang.label} is ready to run offline.` });
    } else if (res.stage !== "cancelled") {
      setStatus({
        tone: "err",
        text: `Download failed: ${res.error || "unknown error"}`,
      });
    }
  };

  const save = () => {
    const text = viewRef.current?.state.doc.toString() ?? code;
    onSave(lang.prism, text);
  };

  const insertStarter = () => {
    const view = viewRef.current;
    if (!view || !lang.starter) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: lang.starter },
    });
    if (!stdin.trim()) setStdin(lang.sampleInput || "");
    view.focus();
  };

  // Refs are updated after render (never during it) - React 19 rule.
  useLayoutEffect(() => {
    actions.current = { run, format, save };
  });

  // Stop anything still running if the dialog closes.
  const runningRef = useRef<RunningJob | null>(null);
  useLayoutEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(
    () => () => {
      if (runningRef.current) runner.cancel(runningRef.current.id);
    },
    [],
  );

  const problemCount = problems.filter((p) => p.severity !== "info").length;
  const busy = !!running;
  const offlineReady = runnerLanguage ? offline[runnerLanguage] : false;

  const statusIcon = useMemo(() => {
    if (!status) return null;
    if (status.tone === "ok")
      return <CheckCircle2 className="size-3.5 shrink-0 text-[var(--ok)]" />;
    if (status.tone === "err")
      return <AlertTriangle className="size-3.5 shrink-0 text-[var(--err)]" />;
    if (status.tone === "busy")
      return <span className="ce-spinner shrink-0" aria-hidden="true" />;
    return null;
  }, [status]);

  return createPortal(
    <div className="ce-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 ide-backdrop" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit code sample" : "Insert code sample"}
        className="ce-dialog ide-dialog"
      >
        {/* ---- header ---- */}
        <div className="ce-head">
          <FileCode2 className="size-4 text-[var(--kw)] shrink-0" />
          <span className="font-medium truncate hidden sm:inline">
            {isEdit ? "Edit code sample" : "Insert code sample"}
          </span>
          <select
            className="ce-select"
            value={langId}
            onChange={(e) => changeLanguage(e.target.value)}
            aria-label="Language"
            disabled={busy}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          {!code.trim() && lang.starter && (
            <button
              type="button"
              className="ide-btn ide-btn-ghost !py-1"
              onClick={insertStarter}
            >
              Starter
            </button>
          )}
          <button
            type="button"
            className="ide-btn !py-1"
            onClick={format}
            disabled={busy}
            title="Format (Shift+Alt+F)"
          >
            <Wand2 className="size-3.5" />{" "}
            <span className="hidden sm:inline">Format</span>
          </button>
          {running?.kind === "run" ? (
            <button
              type="button"
              className="ide-btn ide-btn-danger !py-1"
              onClick={stop}
              title="Stop"
            >
              <Square className="size-3.5" /> Stop
            </button>
          ) : (
            <button
              type="button"
              className="ide-btn ide-btn-ok !py-1"
              onClick={run}
              disabled={busy || !canRun}
              title={
                canRun
                  ? "Run (Ctrl+Enter)"
                  : lang.runNote || "This language can't be run"
              }
            >
              <Play className="size-3.5" />{" "}
              {lang.run === "html-preview" ? "Preview" : "Run"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ide-icon-btn is-danger !w-7 !h-7"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ---- body: editor + I/O ---- */}
        <div className="ce-body">
          <div className="ce-editor" ref={hostRef} />

          <div className="ce-io">
            <div className="ce-tabs" role="tablist">
              {(
                [
                  ["input", "stdin"],
                  ["output", lang.run === "html-preview" ? "preview" : "output"],
                  [
                    "problems",
                    `problems${problemCount ? ` (${problemCount})` : ""}`,
                  ],
                ] as Array<[IoTab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={`ce-tab ${tab === key ? "is-active" : ""} ${key === "problems" && problemCount ? "has-errors" : ""}`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "input" && (
              <textarea
                className="ce-stdin"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                spellCheck={false}
                placeholder={
                  canRun && lang.run !== "html-preview"
                    ? "Input for your program (stdin).\nType it all here before you press Run -\ncin / scanf / input() / Scanner read from it."
                    : "This language doesn't read input here."
                }
                aria-label="Program input (stdin)"
              />
            )}

            {tab === "output" &&
              (lang.run === "html-preview" ? (
                previewHtml !== null ? (
                  // sandbox without allow-same-origin: the page gets an opaque
                  // origin, so its scripts can't touch Note.js data.
                  <iframe
                    title="HTML preview"
                    className="ce-preview"
                    sandbox="allow-scripts allow-modals"
                    srcDoc={previewHtml}
                  />
                ) : (
                  <div className="ce-empty">Press Preview to render the HTML.</div>
                )
              ) : (
                <pre className="ce-output" aria-live="polite">
                  {output.length === 0 ? (
                    <span className="tok-dim">
                      {busy ? "…" : "Press Run (Ctrl+Enter) to see output here."}
                    </span>
                  ) : (
                    output.map((o, i) => (
                      <span
                        key={i}
                        className={
                          o.stream === "stderr"
                            ? "ce-err"
                            : o.stream === "info"
                              ? "tok-dim"
                              : ""
                        }
                      >
                        {o.text}
                      </span>
                    ))
                  )}
                </pre>
              ))}

            {tab === "problems" && (
              <ul className="ce-problems">
                {problems.length === 0 && (
                  <li className="tok-dim px-3 py-2">
                    No problems from the compiler.
                  </li>
                )}
                {problems.map((p, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => jumpTo(p)}>
                      <span
                        className={
                          p.severity === "warning"
                            ? "text-[var(--warn)]"
                            : "text-[var(--err)]"
                        }
                      >
                        {p.severity === "warning" ? "⚠" : "✕"}
                      </span>
                      <span className="tok-dim shrink-0">
                        {p.line}:{p.column || 1}
                      </span>
                      <span className="min-w-0 break-words">{p.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ---- footer ---- */}
        <div className="ce-foot">
          <div className="ce-status" role="status">
            {statusIcon}
            <span className="truncate">
              {status?.text ??
                (canRun
                  ? "Ctrl+Enter run · Shift+Alt+F format · Ctrl+S save"
                  : lang.runNote || "")}
            </span>
          </div>

          {usesRunner && runnerState.phase === "needs-window" && (
            <button
              type="button"
              className="ide-btn !py-1"
              onClick={() => runner.openRunnerWindow()}
            >
              <ExternalLink className="size-3.5" /> Open runner window
            </button>
          )}
          {usesRunner &&
            runnerState.phase === "ready" &&
            (offlineReady ? (
              <span
                className="ce-chip is-ok"
                title="Compiler cached - runs with no internet"
              >
                <CheckCircle2 className="size-3" /> offline ready
              </span>
            ) : (
              <button
                type="button"
                className="ce-chip"
                onClick={makeOffline}
                disabled={busy}
                title={`Download the ${lang.label} compiler once so it works with no internet`}
              >
                <Download className="size-3" /> make {lang.label} offline
              </button>
            ))}

          <button
            type="button"
            className="ide-btn ide-btn-ghost !py-1"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ide-btn ide-btn-solid !py-1"
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
