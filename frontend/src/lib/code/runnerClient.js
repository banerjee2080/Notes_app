// frontend/src/lib/code/runnerClient.js
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

const sessionId = crypto.randomUUID();
const channel = new BroadcastChannel(`notejs-runner:${sessionId}`);
const runnerUrl = `/runner.html#${sessionId}`;

let frame = null;
let state = { phase: "idle", isolated: false, wasmGc: true, popup: false };
const listeners = new Set();
const requests = new Map(); // id -> { resolve, onStream, onProgress }

const setState = (patch) => {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
};

/** Subscribe to runner state: { phase: idle|loading|ready|needs-window, ... } */
export function onRunnerState(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

const post = (msg) => channel.postMessage({ to: "runner", ...msg });

channel.onmessage = ({ data: msg }) => {
  if (!msg || msg.to !== "client") return;

  if (msg.type === "hello") {
    // The popup (isolated) always wins over a non-isolated iframe.
    if (msg.isolated) setState({ phase: "ready", isolated: true, wasmGc: msg.wasmGc, popup: msg.popup });
    else if (!state.isolated) setState({ phase: "needs-window", isolated: false, wasmGc: msg.wasmGc });
    return;
  }
  if (msg.type === "bye" && state.popup) {
    setState({ phase: "needs-window", isolated: false, popup: false });
    for (const [id, r] of requests) {
      requests.delete(id);
      r.resolve({ ok: false, stage: "error", error: "The runner window was closed." });
    }
    return;
  }

  const req = requests.get(msg.id);
  if (!req) return;
  if (msg.type === "stream") req.onStream?.(msg.stream, msg.chunk);
  else if (msg.type === "progress") req.onProgress?.(msg.label, msg.progress);
  else if (msg.type === "result" || msg.type === "status") {
    requests.delete(msg.id);
    req.resolve(msg);
  }
};

/** Create the hidden iframe (once) and wait for it to say hello. */
export function ensureRunner() {
  if (!frame) {
    setState({ phase: "loading" });
    frame = document.createElement("iframe");
    frame.src = runnerUrl;
    frame.title = "Note.js code runner";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
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
export function openRunnerWindow() {
  const w = window.open(runnerUrl, `notejs-runner-${sessionId}`, "popup,width=420,height=260");
  if (!w) throw new Error("The browser blocked the runner window. Allow pop-ups for this site and try again.");
  setState({ phase: "loading" });
}

let nextId = 0;
function request(type, payload, handlers = {}) {
  const id = `${sessionId}:${++nextId}`;
  const promise = new Promise((resolve) => requests.set(id, { resolve, ...handlers }));
  post({ type, id, ...payload });
  return { id, promise };
}

/**
 * Compile + run. Returns { id, promise } so the caller can cancel(id).
 * handlers: { onStream(stream, chunk), onProgress(label, fraction|null) }
 */
export function runCode({ language, code, stdin }, handlers) {
  return request("run", { language, code, stdin }, handlers);
}

/** Compile only, for red-lining. Resolves to { ok, diagnostics } or { superseded }. */
export function checkCode({ language, code }) {
  return request("check", { language, code }).promise;
}

export function cancel(id) {
  post({ type: "cancel", id });
}

/** { [language]: true|false } - is the toolchain fully cached for offline use? */
export async function offlineStatus(languages) {
  const res = await request("status", { languages }).promise;
  return res.status || {};
}

/** Download + cache the toolchains by compiling a tiny program in each. */
export function prefetch(languages, handlers) {
  return request("prefetch", { languages }, handlers);
}

export const getRunnerState = () => state;
