// The message protocol between the app (lib/code/runnerClient.ts) and the
// isolated /runner.html page (runner/runner.ts). Both sides import these, so
// a change to one end cannot silently drift from the other.

/** Languages the offline WebAssembly runner can compile and execute. */
export type RunnerLanguage =
  | "c"
  | "cpp"
  | "go"
  | "java"
  | "python"
  | "javascript"
  | "typescript";

/** What a language's Run button does: the runner, an HTML preview, or nothing. */
export type RunTarget = RunnerLanguage | "html-preview" | null;

export type DiagnosticSeverity = "error" | "warning" | "info";

/** A compiler / runtime diagnostic in 1-based line:column coordinates. */
export interface CompilerDiagnostic {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
}

export type OfflineStatus = Partial<Record<string, boolean>>;

// ---- client -> runner ------------------------------------------------------

export type ClientMessage =
  | { to: "runner"; type: "hello" }
  | { to: "runner"; type: "check"; id: string; language: RunnerLanguage; code: string }
  | {
      to: "runner";
      type: "run";
      id: string;
      language: RunnerLanguage;
      code: string;
      stdin: string;
    }
  | { to: "runner"; type: "cancel"; id: string }
  | { to: "runner"; type: "status"; id: string; languages: string[] }
  | { to: "runner"; type: "prefetch"; id: string; languages: RunnerLanguage[] };

// ---- runner -> client ------------------------------------------------------

export type OutputStream = "stdout" | "stderr";

/** Why a program stopped, as reported by the sandbox. */
export type Termination =
  | "exited"
  | "trap"
  | "instruction-limit"
  | "logical-time-limit"
  | "wall-time-limit"
  | "memory-limit"
  | "output-limit"
  | "filesystem-limit";

export interface CheckResult {
  to: "client";
  type: "result";
  id: string;
  kind: "check";
  ok?: boolean;
  diagnostics?: CompilerDiagnostic[];
  /** Set when newer text arrived before this check ran; ignore the result. */
  superseded?: boolean;
}

export interface RunResult {
  to: "client";
  type: "result";
  id: string;
  kind: "run";
  ok: boolean;
  stage: "compile" | "run" | "cancelled" | "error";
  diagnostics?: CompilerDiagnostic[];
  compileOutput?: string;
  compileMs?: number;
  runMs?: number;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  termination?: Termination;
  trapMessage?: string | null;
  cached?: boolean;
  error?: string;
}

export interface PrefetchResult {
  to: "client";
  type: "result";
  id: string;
  kind: "prefetch";
  ok: boolean;
  stage?: "cancelled" | "error";
  status?: OfflineStatus;
  error?: string;
}

export type RunnerMessage =
  | { to: "client"; type: "hello"; isolated: boolean; wasmGc: boolean; popup: boolean }
  | { to: "client"; type: "bye" }
  | { to: "client"; type: "stream"; id: string; stream: OutputStream; chunk: string }
  | { to: "client"; type: "progress"; id: string; label: string; progress: number | null }
  | { to: "client"; type: "status"; id: string; status: OfflineStatus }
  | CheckResult
  | RunResult
  | PrefetchResult;

export type AnyResult = CheckResult | RunResult | PrefetchResult;

// ---- client-side runner state ----------------------------------------------

export type RunnerPhase = "idle" | "loading" | "ready" | "needs-window";

export interface RunnerState {
  phase: RunnerPhase;
  isolated: boolean;
  wasmGc: boolean;
  popup: boolean;
}

export interface RunHandlers {
  onStream?: (stream: OutputStream, chunk: string) => void;
  onProgress?: (label: string, progress: number | null) => void;
}
