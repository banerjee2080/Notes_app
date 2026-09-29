// frontend/src/runner/runner.js
//
// Entry point of /runner.html - the only page that compiles and runs code.
//
// Why a separate page?
//   The WebAssembly toolchains need SharedArrayBuffer, which browsers only
//   allow in a "cross-origin isolated" page. Isolating the whole app would
//   break Google sign-in popups, so only this small page is isolated
//   (see the headers in vercel.json). The app talks to it through a
//   BroadcastChannel whose name contains a random session id from the URL
//   hash, so two open tabs never talk to each other's runner.
//
// Security: user programs never run as JavaScript in this page. Every
// language (JS included) is compiled to WebAssembly and executed by Wasmer
// inside Workers with a virtual filesystem, no network, and hard limits on
// instructions, memory, output and wall time. The program cannot see the
// app's IndexedDB, cookies or vault keys.
import { createBrowserEngine, browserToolchainAssetUrl } from "@wasm-oj/browser";
import { browserSource as clangSource } from "@wasm-oj/toolchain-clang";
import { browserSource as goSource } from "@wasm-oj/toolchain-go";
import { browserSource as javaSource } from "@wasm-oj/toolchain-java";
import { browserSource as pythonSource } from "@wasm-oj/toolchain-python";
import { browserSource as jsSource } from "@wasm-oj/toolchain-javascript";
import { prepareProject, collectBuildDiagnostics, runtimeDiagnostics, cleanOutput } from "./prepare.js";

const TOOLCHAIN_BASE = "/toolchains/";
const TOOLCHAINS = [
  clangSource(TOOLCHAIN_BASE),
  goSource(TOOLCHAIN_BASE),
  javaSource(TOOLCHAIN_BASE),
  pythonSource(TOOLCHAIN_BASE),
  jsSource(TOOLCHAIN_BASE),
];

// Limits for one run. Generous for notes-sized programs, but an infinite
// loop or fork-bomb-style allocation is stopped instead of hanging the tab.
const RUN_RESOURCES = {
  instructionBudget: 2e11,
  logicalTimeLimitMs: 20_000,
  wallTimeLimitMs: 20_000,
  memoryLimitBytes: 512 * 1024 * 1024,
  outputLimitBytes: 1024 * 1024,
};

const sessionId = location.hash.slice(1);
const channel = new BroadcastChannel(`notejs-runner:${sessionId}`);
const statusEl = document.getElementById("status");
const setStatus = (text) => statusEl && (statusEl.textContent = text);

const isolated = globalThis.crossOriginIsolated === true;
// Java is compiled by TeaVM to WebAssembly GC (Chrome/Edge 119+, Firefox 120+, Safari 18.2+).
const wasmGc = (() => {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 3, 1, 95, 0]));
  } catch {
    return false;
  }
})();
const isPopup = window.parent === window;

const send = (msg) => channel.postMessage({ to: "client", ...msg });

// ---- engine lifecycle -------------------------------------------------------

let enginePromise = null;
let current = null; // { id, phase, aborted, abort } of the request being processed

// Every await on the engine races against the request's "aborted" promise,
// so Stop always frees the queue even if a disposed Worker never answers.
const abortable = (promise) => Promise.race([promise, current.aborted]);

function getEngine() {
  enginePromise ??= createBrowserEngine({ toolchains: TOOLCHAINS, artifactCache: true }).then((engine) => {
    engine.onProgress((p) => {
      if (current) send({ type: "progress", id: current.id, label: p.label, progress: p.progress ?? null });
    });
    engine.onStream((stream, chunk) => {
      // Live stdout/stderr while the program runs.
      if (current?.phase === "run") send({ type: "stream", id: current.id, stream, chunk });
    });
    return engine;
  });
  enginePromise.catch(() => (enginePromise = null));
  return enginePromise;
}

async function resetEngine() {
  const old = enginePromise;
  enginePromise = null;
  try {
    (await old)?.dispose();
  } catch {
    /* already gone */
  }
}

// ---- requests ---------------------------------------------------------------

async function compile(project) {
  const engine = await abortable(getEngine());
  const build = await abortable(engine.compile({
    language: project.language,
    target: "wasip1",
    optimization: "release",
    entry: project.entry,
    files: project.files,
  }));
  return { engine, build, diagnostics: collectBuildDiagnostics(project, build) };
}

async function handleCheck({ id, language, code }) {
  const project = prepareProject(language, code);
  current.phase = "compile";
  const { build, diagnostics } = await compile(project);
  send({ type: "result", id, kind: "check", ok: build.success, diagnostics });
}

async function handleRun({ id, language, code, stdin }) {
  const project = prepareProject(language, code);
  current.phase = "compile";
  const started = performance.now();
  const { engine, build, diagnostics } = await compile(project);
  const compileMs = Math.round(performance.now() - started);

  if (!build.artifact) {
    send({
      type: "result",
      id,
      kind: "run",
      ok: false,
      stage: "compile",
      diagnostics,
      compileOutput: cleanOutput(project, `${build.stdout || ""}${build.stderr || ""}`),
      compileMs,
    });
    return;
  }

  current.phase = "run";
  send({ type: "progress", id, label: "Running", progress: null });
  const result = await abortable(engine.run(build.artifact, {
    stdin: stdin ?? "",
    resources: RUN_RESOURCES,
    // Real clock + fresh random seed, so time() and rand() behave normally.
    determinism: {
      randomSeed: crypto.getRandomValues(new Uint32Array(1))[0],
      realtimeEpochMs: Date.now(),
    },
  }));
  const stderr = cleanOutput(project, result.stderr);
  send({
    type: "result",
    id,
    kind: "run",
    ok: result.termination === "exited" && result.code === 0,
    stage: "run",
    stdout: result.stdout,
    stderr,
    exitCode: result.code,
    termination: result.termination,
    trapMessage: result.trapMessage ?? null,
    diagnostics: [...diagnostics, ...runtimeDiagnostics(project, result.stderr)],
    compileMs,
    runMs: Math.round(result.executionDurationMs ?? result.durationMs),
    cached: build.cacheHit,
  });
}

// Is every file of this language's toolchain already in Cache Storage?
async function offlineStatus(languages) {
  const out = {};
  for (const language of languages) {
    const source = TOOLCHAINS.find((s) => s.descriptor.languages.includes(language));
    if (!source || !("caches" in self)) {
      out[language] = false;
      continue;
    }
    const urls = source.descriptor.assets.map((a) => browserToolchainAssetUrl(TOOLCHAINS, a.path, location.href).href);
    const hits = await Promise.all(urls.map((u) => caches.match(u)));
    out[language] = hits.every(Boolean);
  }
  return out;
}

const LABELS = { c: "C", cpp: "C++", go: "Go", java: "Java", python: "Python", javascript: "JavaScript", typescript: "TypeScript" };

// Tiny programs used to download (and let the service worker cache) every
// file a language needs, by simply compiling and running them once.
const WARMUP = {
  c: "int main(void){return 0;}",
  cpp: "#include <bits/stdc++.h>\nint main(){std::vector<int> v{1};return v[0]-1;}",
  go: "package main\nfunc main(){}",
  java: "public class Main{public static void main(String[] a){}}",
  python: "pass",
  javascript: "0;",
  typescript: "const x: number = 0;",
};

async function handlePrefetch({ id, languages }) {
  try {
    await navigator.storage?.persist?.(); // ask the browser not to evict the cache
  } catch {
    /* optional */
  }
  for (const language of languages) {
    current.phase = "compile";
    send({ type: "progress", id, label: `Downloading the ${LABELS[language] ?? language} compiler`, progress: null });
    const project = prepareProject(language, WARMUP[language]);
    const { engine, build } = await compile(project);
    if (build.artifact) await abortable(engine.run(build.artifact, { stdin: "", resources: RUN_RESOURCES }));
  }
  send({ type: "result", id, kind: "prefetch", ok: true, status: await offlineStatus(languages) });
}

// One request at a time. Queued background checks are dropped when newer
// work arrives - only the latest text matters.
let queue = Promise.resolve();
const pending = new Map(); // id -> message (not started yet)

function enqueue(msg) {
  if (msg.type === "check" || msg.type === "run") {
    for (const [pid, p] of pending) {
      if (p.type === "check") {
        pending.delete(pid);
        send({ type: "result", id: pid, kind: "check", superseded: true });
      }
    }
  }
  pending.set(msg.id, msg);
  queue = queue.then(async () => {
    if (!pending.has(msg.id)) return; // superseded or cancelled
    pending.delete(msg.id);
    let abort;
    const aborted = new Promise((_, reject) => (abort = reject));
    aborted.catch(() => {}); // handled by whoever is awaiting abortable()
    current = { id: msg.id, phase: "queued", aborted, abort };
    try {
      if (msg.type === "check") await handleCheck(msg);
      else if (msg.type === "run") await handleRun(msg);
      else if (msg.type === "prefetch") await handlePrefetch(msg);
    } catch (err) {
      if (err?.name !== "Cancelled") {
        send({ type: "result", id: msg.id, kind: msg.type, ok: false, stage: "error", error: String(err?.message || err) });
      }
    } finally {
      current = null;
      setStatus(isPopup ? "Ready. Keep this window open while you run code in Note.js." : "Ready.");
    }
  });
}

channel.onmessage = async ({ data: msg }) => {
  if (!msg || msg.to !== "runner") return;

  if (msg.type === "hello") {
    send({ type: "hello", isolated, wasmGc, popup: isPopup });
    return;
  }
  // A non-isolated copy (iframe in Firefox/Safari) must not answer work
  // requests - the popup window will.
  if (!isolated) return;

  if (msg.type === "status") {
    send({ type: "status", id: msg.id, status: await offlineStatus(msg.languages || []) });
  } else if (msg.type === "cancel") {
    if (pending.delete(msg.id)) {
      send({ type: "result", id: msg.id, kind: "run", ok: false, stage: "cancelled" });
    } else if (current?.id === msg.id) {
      // Killing the Workers is the only way to stop a running program.
      const err = new Error("Cancelled");
      err.name = "Cancelled";
      current.abort(err);
      await resetEngine();
      send({ type: "result", id: msg.id, kind: "run", ok: false, stage: "cancelled" });
    }
  } else if (msg.type === "check" || msg.type === "run" || msg.type === "prefetch") {
    setStatus(msg.type === "run" ? "Running code…" : "Working…");
    enqueue(msg);
  }
};

setStatus(
  isolated
    ? isPopup
      ? "Ready. Keep this window open while you run code in Note.js."
      : "Ready."
    : "This browser can't isolate the runner inside the page. Note.js will open it in a small window instead.",
);
// Announce ourselves (the app may have asked before we loaded).
send({ type: "hello", isolated, wasmGc, popup: isPopup });
if (isPopup) window.addEventListener("beforeunload", () => send({ type: "bye" }));
