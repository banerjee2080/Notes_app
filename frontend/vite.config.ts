import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import codeRuntimes from "./vite-plugins/codeRuntimes";

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      // Two pages: the app, and the isolated page that compiles/runs code.
      input: {
        main: "index.html",
        runner: "runner.html",
      },
    },
  },
  // The runner engine finds its Workers and .wasm files relative to its own
  // module URL; Vite's dependency pre-bundling would move the module and
  // break those paths, so serve these packages as-is in dev.
  optimizeDeps: {
    exclude: [
      "@wasm-oj/browser",
      "@wasm-oj/core",
      "@wasm-oj/contracts",
      "@wasm-fmt/clang-format",
      "@wasm-fmt/gofmt",
      "@wasm-fmt/ruff_fmt",
    ],
  },
  worker: { format: "es" },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    codeRuntimes(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src/serviceWorker",
      filename: "serviceWorker.ts",
      registerType: "autoUpdate",
      // Enable this so you can test turning off your WiFi while running 'npm run dev'
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Note.js",
        short_name: "Note.js",
        theme_color: "#1a1d23", // IDE window colour
        background_color: "#0f1115",
        display: "standalone", // Makes it look like a native app (removes browser URL bar)
        icons: [
          {
            src: "favicon.svg", // Using your existing favicon
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "avatar.png", // Fallback icon using your avatar asset
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      injectManifest: {
        // "wasm" = the formatters (clang-format, gofmt, ruff), so Format works
        // offline from the first visit. The big compiler files are NOT
        // precached (that would be ~150 MB for every user); the service worker
        // caches them the first time a language is run or made offline.
        globPatterns: ["**/*.{js,mjs,css,html,ico,png,svg,webp,wasm,woff2}"],
        globIgnores: [
          "toolchains/**",
          "**/runtime-core_bg-*.wasm",
          "**/wasmer_js_bg-*.wasm",
          "**/rustc-stage.worker-*.js",
        ],
        maximumFileSizeToCacheInBytes: 5000000,
        rollupFormat: 'iife',
      },
    }),
  ],
});
