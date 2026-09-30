// frontend/src/lib/code/runnerClient.ts
//
// The app's side of the code runner. It loads /runner.html in a hidden
// <iframe> and talks to it over a BroadcastChannel.
//
// Chrome / Edge: the iframe is isolated by the Document-Isolation-Policy
//                header, so everything happens invisibly.
// Firefox / Safari: they don't support that header yet, so the iframe reports
//                "not isolated" and the editor offers to open the runner as a
//                small top-level window (which COOP/COEP can isolate).
//                BroadcastChannel reaches it there too.
import type {
  AnyResult,
  CheckResult,
  ClientMessage,
  OfflineStatus,
  PrefetchResult,
  RunHandlers,
  RunnerLanguage,
  RunnerMessage,
  RunnerState,
  RunResult,
} from "../../types/runner";

const sessionId = crypto.randomUUID();
const channel = new BroadcastChannel(`notejs-runner:${sessionId}`);
const runnerUrl = `/runner.html#${sessionId}`;

/** One in-flight request, waiting for the runner to answer. */
interface PendingRequest extends RunHandlers {
  resolve: (result: AnyResult) => void;
}

let frame: HTMLIFrameElement | null = null;
let state: RunnerState = {
  phase: "idle",
  isolated: false,
  wasmGc: true,
  popup: false,
};
const listeners = new Set<(s: RunnerState) => void>();
const requests = new Map<string, PendingRequest>();

const setState = (patch: Partial<RunnerState>): void => {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
};

/** Subscribe to runner state: { phase: idle|loading|ready|needs-window, ... } */
export function onRunnerState(fn: (s: RunnerState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => {
    listeners.delete(fn);
  };
}

const post = (msg: ClientMessage): void => channel.postMessage(msg);

channel.onmessage = ({ data: msg }: MessageEvent<RunnerMessage>) => {
  if (!msg || msg.to !== "client") return;

  if (msg.type === "hello") {
    // The popup (isolated) always wins over a non-isolated iframe.
    if (msg.isolated)
      setState({
        phase: "ready",
        isolated: true,
        wasmGc: msg.wasmGc,
        popup: msg.popup,
      });
    else if (!state.isolated)
      setState({ phase: "needs-window", isolated: false, wasmGc: msg.wasmGc });
    return;
  }
  if (msg.type === "bye" && state.popup) {
    setState({ phase: "needs-window", isolated: false, popup: false });
    for (const [id, r] of requests) {
      requests.delete(id);
      r.resolve({
        to: "client",
        type: "result",
        id,
        kind: "run",
        ok: false,
        stage: "error",
        error: "The runner window was closed.",
      });
    }
    return;
  }
  // A "bye" while no popup is open carries no request id; nothing to route.
  if (msg.type === "bye") return;

  const req = requests.get(msg.id);
  if (!req) return;
  if (msg.type === "stream") req.onStream?.(msg.stream, msg.chunk);
  else if (msg.type === "progress") req.onProgress?.(msg.label, msg.progress);
  else if (msg.type === "result") {
    requests.delete(msg.id);
    req.resolve(msg);
  } else if (msg.type === "status") {
    requests.delete(msg.id);
    // `status` answers an offlineStatus() request; it is shaped like a
    // prefetch result so the one pending-request map can carry both.
    req.resolve({
      to: "client",
      type: "result",
      id: msg.id,
      kind: "prefetch",
      ok: true,
      status: msg.status,
    });
  }
};

/** Create the hidden iframe (once) and wait for it to say hello. */
export function ensureRunner(): Promise<RunnerState> {
  if (!frame) {
    setState({ phase: "loading" });
    frame = document.createElement("iframe");
    frame.src = runnerUrl;
    frame.title = "Note.js code runner";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText =
      "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(frame);
  }
  if (state.phase === "ready") return Promise.resolve(state);
  return new Promise((resolve) => {
    const off = onRunnerState((s) => {
      if (s.phase === "ready" || s.phase === "needs-window") {
        queueMicrotask(() => off());
        resolve(s);
      }
    });
  });
}

/** Firefox/Safari fallback - must be called from a click handler. */
export function openRunnerWindow(): void {
  const w = window.open(
    runnerUrl,
    `notejs-runner-${sessionId}`,
    "popup,width=420,height=260",
  );
  if (!w)
    throw new Error(
      "The browser blocked the runner window. Allow pop-ups for this site and try again.",
    );
  setState({ phase: "loading" });
}

let nextId = 0;

interface Request<T extends AnyResult> {
  id: string;
  promise: Promise<T>;
}

function request<T extends AnyResult>(
  build: (id: string) => ClientMessage,
  handlers: RunHandlers = {},
): Request<T> {
  const id = `${sessionId}:${++nextId}`;
  const promise = new Promise<AnyResult>((resolve) =>
    requests.set(id, { resolve, ...handlers }),
  ) as Promise<T>;
  post(build(id));
  return { id, promise };
}

/**
 * Compile + run. Returns { id, promise } so the caller can cancel(id).
 * handlers: { onStream(stream, chunk), onProgress(label, fraction|null) }
 */
export function runCode(
  {
    language,
    code,
    stdin,
  }: { language: RunnerLanguage; code: string; stdin: string },
  handlers?: RunHandlers,
): Request<RunResult> {
  return request<RunResult>(
    (id) => ({ to: "runner", type: "run", id, language, code, stdin }),
    handlers,
  );
}

/** Compile only, for red-lining. Resolves to { ok, diagnostics } or { superseded }. */
export function checkCode({
  language,
  code,
}: {
  language: RunnerLanguage;
  code: string;
}): Promise<CheckResult> {
  return request<CheckResult>((id) => ({
    to: "runner",
    type: "check",
    id,
    language,
    code,
  })).promise;
}

export function cancel(id: string): void {
  post({ to: "runner", type: "cancel", id });
}

/** { [language]: true|false } - is the toolchain fully cached for offline use? */
export async function offlineStatus(
  languages: string[],
): Promise<OfflineStatus> {
  const res = await request<PrefetchResult>((id) => ({
    to: "runner",
    type: "status",
    id,
    languages,
  })).promise;
  return res.status ?? {};
}

/** Download + cache the toolchains by compiling a tiny program in each. */
export function prefetch(
  languages: RunnerLanguage[],
  handlers?: RunHandlers,
): Request<PrefetchResult> {
  return request<PrefetchResult>(
    (id) => ({ to: "runner", type: "prefetch", id, languages }),
    handlers,
  );
}

export const getRunnerState = (): RunnerState => state;
