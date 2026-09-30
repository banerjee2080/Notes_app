// frontend/vite-plugins/codeRuntimes.js
//
// Serves and ships the offline compilers used by the code editor's "Run"
// button (Clang, Go, TeaVM/javac, CPython, QuickJS/TypeScript - all compiled
// to WebAssembly by the WASM-OJ project).
//
// Why a plugin instead of copying files into public/:
//   * The toolchains are ~150 MB. Keeping them in node_modules means they are
//     pinned by package-lock.json (integrity hashes) and never land in git.
//   * `npm install` on Vercel pulls them, and this plugin copies them into
//     dist/ at build time.
//
// It also sets the isolation headers the runner page needs in `vite dev` and
// `vite preview` (production headers live in vercel.json / backend/Server.js).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";

const require = createRequire(import.meta.url);

// Every WASM-OJ toolchain package we register in src/runner/runner.js.
export const TOOLCHAIN_PACKAGES: string[] = [
  "@wasm-oj/toolchain-clang",
  "@wasm-oj/toolchain-go",
  "@wasm-oj/toolchain-java",
  "@wasm-oj/toolchain-python",
  "@wasm-oj/toolchain-javascript",
];

// Resolve "<pkg>/package.json" and return the package's root folder.
const pkgDir = (name: string): string =>
  path.dirname(require.resolve(`${name}/package.json`));

// file name -> absolute path, for every toolchain asset (e.g. clang-...webc.gz.bin)
const toolchainFiles = (): Map<string, string> => {
  const files = new Map<string, string>();
  for (const pkg of TOOLCHAIN_PACKAGES) {
    const dir = path.join(pkgDir(pkg), "assets");
    for (const name of fs.readdirSync(dir)) files.set(name, path.join(dir, name));
  }
  return files;
};

// The engine's own Workers + wasm (wasmer, runtime core). Its entry module
// resolves them with `new URL("assets/<name>", import.meta.url)`, so after
// bundling they must sit next to our chunks in dist/assets/ under their
// ORIGINAL names.
const engineAssetDir = (): string =>
  path.join(pkgDir("@wasm-oj/browser"), "dist", "assets");

// Headers for the runner document. DIP makes an <iframe> cross-origin isolated
// in Chromium without isolating the whole app; COOP+COEP do the same when the
// runner is opened as a top-level window (Firefox / Safari fallback).
export const RUNNER_DOC_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Document-Isolation-Policy": "isolate-and-require-corp",
  "X-Frame-Options": "SAMEORIGIN",
};

// Headers for sub-resources. An isolated document may only load resources
// that opt in via CORP, and its Workers must themselves declare COEP.
// Neither header changes anything for the (non-isolated) main app.
export const SUBRESOURCE_HEADERS: Record<string, string> = {
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

const isDocumentPath = (p: string): boolean =>
  p === "/" || p.endsWith(".html") || !path.extname(p);

function isolationMiddleware(serveToolchains: boolean): Connect.NextHandleFunction {
  const files = serveToolchains ? toolchainFiles() : null;
  return (req, res, next) => {
    const url = (req.url || "/").split("?")[0];

    if (url === "/runner.html") {
      for (const [k, v] of Object.entries(RUNNER_DOC_HEADERS)) res.setHeader(k, v);
      // vite.config's server.headers (COOP: same-origin-allow-popups, for
      // Google sign-in) is applied after us - keep ours for this page.
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (k, v) => (/^cross-origin-opener-policy$/i.test(k) ? res : setHeader(k, v));
    } else if (!isDocumentPath(url)) {
      for (const [k, v] of Object.entries(SUBRESOURCE_HEADERS)) res.setHeader(k, v);
    }

    // Dev only: stream toolchain files straight out of node_modules.
    if (files && url.startsWith("/toolchains/")) {
      const file = files.get(decodeURIComponent(url.slice("/toolchains/".length)));
      if (!file) return next();
      res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
      res.setHeader("Content-Length", fs.statSync(file).size);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return fs.createReadStream(file).pipe(res);
    }
    next();
  };
}

export default function codeRuntimes(): Plugin {
  let outDir = "dist";
  return {
    name: "notejs-code-runtimes",

    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(isolationMiddleware(true));
    },

    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(isolationMiddleware(false));
    },

    // writeBundle runs sequentially and before any plugin's closeBundle, so
    // the files exist by the time vite-plugin-pwa builds its precache list
    // (which then skips them via globIgnores - they are cached on demand).
    writeBundle() {
      const assets = path.join(outDir, "assets");
      fs.mkdirSync(assets, { recursive: true });
      for (const name of fs.readdirSync(engineAssetDir())) {
        fs.copyFileSync(path.join(engineAssetDir(), name), path.join(assets, name));
      }

      const toolchains = path.join(outDir, "toolchains");
      fs.mkdirSync(toolchains, { recursive: true });
      for (const [name, file] of toolchainFiles()) {
        fs.copyFileSync(file, path.join(toolchains, name));
      }
    },
  };
}
