import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import api from "../lib/axios";
import { errorStatus } from "../lib/errors";
import { collabCacheName } from "../lib/collabCache";
import type { NoteRole } from "../types/notes";

// Same origin by default: on Vercel, /collab is routed to the collab function,
// and in development Vite proxies /collab to the local collab server.
// VITE_COLLAB_URL still overrides it (e.g. for a separately hosted server).
export const COLLAB_URL =
  import.meta.env.VITE_COLLAB_URL ||
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/collab`;
// The provider doesn't retry after a failed login, so we do it ourselves.
const RETRY_MS = 5000;
// A tab hidden this long drops its connection. Every open connection keeps a
// Vercel instance (and its billed memory) alive; edits made meanwhile stay in
// IndexedDB and sync when the tab is visible again.
const HIDDEN_DISCONNECT_MS = 60_000;

export type CollabStatus = "connecting" | "connected" | "disconnected";

export interface CollabSession {
  ydoc: Y.Doc;
  /** null for encrypted notes: their Y.Doc never goes over the socket. */
  provider: HocuspocusProvider | null;
}

// Opens a note's shared Yjs document: loads the offline copy from IndexedDB
// and keeps it in sync with the Hocuspocus server over a WebSocket.
export function useCollabNote(noteId: string, { onEncrypted }: { onEncrypted?: () => void } = {}) {
  // An owner/admin just encrypted this note; the page re-opens it as encrypted.
  const onEncryptedRef = useRef(onEncrypted);
  useEffect(() => {
    onEncryptedRef.current = onEncrypted;
  });
  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");
  // True once the doc holds content the server created (meta.seeded). Until
  // then the editor stays read-only, so the browser never starts a second,
  // independent history that would merge into duplicated text.
  const [seeded, setSeeded] = useState(false);
  // Role from the latest ticket; null until one has been fetched.
  const [role, setRole] = useState<NoteRole | null>(null);
  // The API answered 403/404: removed from the note, or it isn't on the server yet.
  const [accessLost, setAccessLost] = useState(false);

  useEffect(() => {
    if (!noteId) return;
    let destroyed = false;
    let retryTimer: number | undefined;

    const ydoc = new Y.Doc();
    const meta = ydoc.getMap("meta");
    const readSeeded = () => setSeeded(meta.get("seeded") === true);
    meta.observe(readSeeded);

    const local = new IndexeddbPersistence(collabCacheName(noteId), ydoc);
    local.on("synced", readSeeded);

    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: noteId,
      document: ydoc,
      // Runs on every (re)connect, so the 5-minute ticket is always fresh.
      token: async () => {
        try {
          const res = await api.get<{ token: string; role: NoteRole }>(
            `/notes/${noteId}/collab-token`,
          );
          setRole(res.data.role);
          setAccessLost(false);
          return res.data.token;
        } catch (e) {
          const s = errorStatus(e);
          if (s === 403 || s === 404) setAccessLost(true);
          throw e; // the provider reports this as "authentication failed"
        }
      },
      onStatus: ({ status }) => setStatus(status as CollabStatus),
      onStateless: ({ payload }) => {
        try {
          if (JSON.parse(payload).t === "encrypted") onEncryptedRef.current?.();
        } catch {
          // not one of ours
        }
      },
      onSynced: readSeeded,
      onAuthenticationFailed: () => {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          if (destroyed || document.hidden) return; // a hidden tab reconnects when it's shown again
          provider.disconnect();
          provider.connect();
        }, RETRY_MS);
      },
    });

    let hiddenTimer: number | undefined;
    const onVisibilityChange = () => {
      window.clearTimeout(hiddenTimer);
      if (document.hidden) {
        hiddenTimer = window.setTimeout(() => provider.disconnect(), HIDDEN_DISCONNECT_MS);
      } else {
        provider.connect(); // does nothing if still connected
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // The doc and socket must be created and destroyed inside this effect
    // (StrictMode mounts twice), so the effect is what hands them out.
    setSession({ ydoc, provider });

    return () => {
      destroyed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      meta.unobserve(readSeeded);
      provider.destroy();
      local.destroy(); // closes IndexedDB; the data stays on disk
      ydoc.destroy();
      setSession(null);
      setSeeded(false);
      setRole(null);
      setAccessLost(false);
      setStatus("connecting");
    };
  }, [noteId]);

  return { session, status, seeded, role, accessLost };
}
