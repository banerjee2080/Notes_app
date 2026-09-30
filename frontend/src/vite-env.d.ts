/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// This file is a module (it augments "react"), so the ambient globals below
// must live inside `declare global` to reach the rest of the app.
declare global {
  interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string;
    readonly VITE_TINYMCE_API_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  // `sync` (the Background Sync API) is not in TypeScript's DOM library yet,
  // but syncEngine.ts registers a sync tag through it.
  interface SyncManager {
    getTags(): Promise<string[]>;
    register(tag: string): Promise<void>;
  }

  interface ServiceWorkerRegistration {
    readonly sync: SyncManager;
  }

  // lib/code/prism/index.ts publishes a Prism build with every language the
  // code editor offers; TinyMCE's codesample plugin reads it from here.
  var Prism: typeof import("prismjs");
}

// Chrome-only CSS property used by the note-title inputs so they grow with
// their content. Not yet in React's CSSProperties.
declare module "react" {
  interface CSSProperties {
    fieldSizing?: "content" | "fixed";
  }
}

export {};
