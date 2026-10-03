import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import api from "../lib/axios";
import { errorStatus } from "../lib/errors";
import { localDB } from "../lib/db";
import {
  decryptBytes,
  encryptBytes,
  encryptPreview,
  toB64,
  randomBytes,
  type EncBlob,
  type WrappedNoteKey,
} from "../lib/crypto";
import {
  healMissingKeys,
  keyFromFragment,
  previewOf,
  rotateNoteKey,
  saveOwnKey,
} from "../lib/noteKeys";
import { useVaultStore } from "../stores/useVaultStore";
import { COLLAB_URL, type CollabSession, type CollabStatus } from "./useCollabNote";
import type { NoteRole } from "../types/notes";

// Live editing of an end-to-end encrypted note.
//
// The server can't read or merge Yjs updates, so this hook does what
// Hocuspocus normally does on the server:
//   ydoc    - the real document the editor is bound to (plaintext, memory only)
//   shadow  - what the server is known to have (snapshot + numbered updates)
// Local edits are queued, merged, encrypted with the note key and sent as
// stateless messages on the "enc:<id>" channel. The server numbers them
// (seq), stores them and rebroadcasts them; everyone, the sender included,
// decrypts and applies them. After a reconnect the client re-sends
// "everything in ydoc the shadow doesn't have", which covers offline edits
// and anything lost in flight. Yjs merges are idempotent, so duplicates
// are harmless.

export type KeyState = "loading" | "need-vault" | "no-key" | "ready";

interface EncState {
  role: NoteRole;
  keyVersion: number;
  seq: number;
  snapshot: (EncBlob & { upto: number }) | null;
  snapshotUpto: number;
  updates: (EncBlob & { seq: number })[];
  myKey: WrappedNoteKey | null;
  needsRotation: boolean;
  missingKeys: number;
}

type Message =
  | { t: "u"; seq: number; v: number; iv: string; ct: string; cid?: string }
  | { t: "stale" | "rekeyed"; cid?: string }
  | { t: "error"; cid?: string; message?: string };

const REMOTE = "remote"; // Yjs transaction origin for updates from the server
const LOCAL_CACHE = "local-cache";
const COMPACT_EVERY = 100; // fold updates into a new snapshot this often
const PUSH_DELAY_MS = 150;
const SAVE_DELAY_MS = 1000;
const PREVIEW_DELAY_MS = 2000;
const RETRY_MS = 5000;
const HIDDEN_DISCONNECT_MS = 60_000;

// TS 5.7+ wants ArrayBuffer-backed arrays for WebCrypto; Yjs returns ArrayBufferLike.
const own = (u: Uint8Array) => new Uint8Array(u);

interface Options {
  enabled: boolean;
  /** This user's wrapped key from the local note row: lets the note open offline. */
  cachedKey: WrappedNoteKey | null | undefined;
  myUserId: string;
}

export function useEncryptedNote(noteId: string, { enabled, cachedKey, myUserId }: Options) {
  const privateKey = useVaultStore((s) => s.privateKey);
  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");
  const [seeded, setSeeded] = useState(false);
  const [role, setRole] = useState<NoteRole | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [keyState, setKeyState] = useState<KeyState>("loading");
  const [noteKey, setNoteKey] = useState<{ key: CryptoKey; version: number } | null>(null);
  const rotateRef = useRef<(() => Promise<void>) | null>(null);
  const cachedKeyRef = useRef(cachedKey);
  useEffect(() => {
    cachedKeyRef.current = cachedKey;
  });

  useEffect(() => {
    if (!enabled || !noteId) return;
    if (!privateKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the external vault state
      setKeyState("need-vault");
      return;
    }

    let destroyed = false;
    const vault = useVaultStore.getState();
    const ydoc = new Y.Doc();
    let shadow = new Y.Doc();
    let key: CryptoKey | null = null;
    let version = 0;
    let myRole: NoteRole | null = null;
    let contiguous = 0; // every seq <= this has been applied
    const aheadOfContiguous = new Set<number>();
    let snapshotUpto = 0;
    let outbox: Uint8Array[] = [];
    let connected = false;
    let caughtUp = false;
    let maintained = false;
    const waiting: string[] = []; // messages that arrived before the first load
    const myCids = new Set<string>();
    let pushTimer: number | undefined;
    let saveTimer: number | undefined;
    let previewTimer: number | undefined;
    let retryTimer: number | undefined;
    let hiddenTimer: number | undefined;

    // Everything that touches key/version/shadow runs one at a time, in order.
    let chain: Promise<unknown> = Promise.resolve();
    const serial = (fn: () => Promise<unknown>) => {
      chain = chain.then(() => (destroyed ? undefined : fn())).catch((e) => {
        console.error("Encrypted note:", e);
      });
      return chain;
    };

    const adoptKey = (k: CryptoKey, v: number) => {
      key = k;
      version = v;
      vault.rememberNoteKey(noteId, v, k);
      setNoteKey({ key: k, version: v });
    };

    const markSeq = (seq: number) => {
      if (seq <= contiguous) return;
      aheadOfContiguous.add(seq);
      while (aheadOfContiguous.has(contiguous + 1)) {
        contiguous++;
        aheadOfContiguous.delete(contiguous);
      }
    };

    const applyRemote = (update: Uint8Array) => {
      Y.applyUpdate(ydoc, update, REMOTE);
      Y.applyUpdate(shadow, update, REMOTE);
    };

    // ---- offline copy (encrypted) ----
    const saveLocal = async () => {
      if (!key) return;
      const blob = await encryptBytes(key, own(Y.encodeStateAsUpdate(ydoc)), noteId, version, "snapshot");
      await localDB.encDocs.put({ id: noteId, ...blob });
    };

    const loadLocal = async () => {
      const wrapped = cachedKeyRef.current;
      if (!wrapped) return;
      const k = await vault.openNoteKey(noteId, wrapped);
      const cache = await localDB.encDocs.get(noteId);
      if (!k || destroyed) return;
      if (cache && cache.v === wrapped.v) {
        Y.applyUpdate(ydoc, await decryptBytes(k, cache, noteId, "snapshot"), LOCAL_CACHE);
      }
      if (!key) {
        adoptKey(k, wrapped.v);
        setKeyState("ready");
        if (cache) setSeeded(true);
      }
    };

    // ---- the key for the server's current version ----
    const establishKey = async (data: EncState): Promise<boolean> => {
      let k = data.myKey ? await vault.openNoteKey(noteId, data.myKey) : null;
      if (!k) {
        // Arrived through a share link: the key is in the URL fragment.
        const fromLink = await keyFromFragment(location.hash);
        if (fromLink && fromLink.version === data.keyVersion) {
          if (data.snapshot) {
            // Wrong key → AES-GCM refuses → we never store a bad copy.
            await decryptBytes(fromLink.key, data.snapshot, noteId, "snapshot");
          }
          k = fromLink.key;
          const publicKey = useVaultStore.getState().publicKey;
          if (publicKey) await saveOwnKey(noteId, k, data.keyVersion, myUserId, publicKey);
        }
      }
      if (location.hash.includes("k=")) {
        // Keep the key out of history, screenshots and bookmarks.
        history.replaceState(history.state, "", location.pathname + location.search);
      }
      if (!k) {
        setKeyState("no-key");
        return false;
      }
      adoptKey(k, data.keyVersion);
      setKeyState("ready");
      return true;
    };

    // ---- catch up with the server ----
    const loadFromServer = async (since: number): Promise<void> => {
      const { data } = await api.get<EncState>(`/notes/${noteId}/enc`, { params: { since } });
      if (destroyed) return;
      myRole = data.role;
      setRole(data.role);
      setAccessLost(false);

      if (!key || data.keyVersion !== version) {
        const rekeyed = !!key && since > 0;
        if (!(await establishKey(data))) return;
        if (rekeyed) {
          // New key = brand new snapshot + update log. Start the shadow over.
          shadow = new Y.Doc();
          contiguous = 0;
          aheadOfContiguous.clear();
          return loadFromServer(0);
        }
      }

      if (data.snapshot) {
        applyRemote(await decryptBytes(key!, data.snapshot, noteId, "snapshot"));
        markSeqUpTo(data.snapshot.upto);
      }
      snapshotUpto = data.snapshotUpto;
      for (const u of data.updates) {
        try {
          applyRemote(await decryptBytes(key!, u, noteId, "update"));
        } catch (e) {
          console.warn(`Skipping update ${u.seq}: could not decrypt`, e);
        }
        markSeq(u.seq);
      }
      setSeeded(true);
      scheduleSave();

      if (!maintained && (data.role === "owner" || data.role === "admin")) {
        maintained = true;
        if (data.needsRotation) void serial(rotate);
        else if (data.missingKeys > 0) void healMissingKeys(noteId, key!, version).catch(() => {});
      }
    };

    const markSeqUpTo = (upto: number) => {
      if (upto > contiguous) contiguous = upto;
      for (const s of aheadOfContiguous) if (s <= contiguous) aheadOfContiguous.delete(s);
      while (aheadOfContiguous.has(contiguous + 1)) {
        contiguous++;
        aheadOfContiguous.delete(contiguous);
      }
    };

    const catchUp = () =>
      serial(async () => {
        try {
          await loadFromServer(contiguous);
        } catch (e) {
          const s = errorStatus(e);
          if (s === 403 || s === 404) setAccessLost(true);
          throw e;
        }
        caughtUp = true;
        while (waiting.length) await handleMessage(waiting.shift()!);
        resendMissing();
      });

    // ---- sending ----
    // After (re)connecting: everything ydoc has that the server doesn't.
    const resendMissing = () => {
      if (!key || myRole === "viewer") return;
      outbox = [Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(shadow))];
      void serial(flush);
    };

    const flush = async () => {
      if (!connected || !caughtUp || !key || myRole === "viewer" || outbox.length === 0) return;
      const update = Y.mergeUpdates(outbox);
      outbox = [];
      const blob = await encryptBytes(key, own(update), noteId, version, "update");
      const cid = toB64(randomBytes(9));
      myCids.add(cid);
      provider.sendStateless(JSON.stringify({ t: "push", cid, ...blob }));
    };

    const compact = async () => {
      if (!key || myRole === "viewer") return;
      const upto = contiguous;
      if (upto - snapshotUpto < COMPACT_EVERY) return;
      const blob = await encryptBytes(key, own(Y.encodeStateAsUpdate(shadow)), noteId, version, "snapshot");
      await api.put(`/notes/${noteId}/enc/snapshot`, { ...blob, upto });
      snapshotUpto = upto;
    };

    // ---- receiving ----
    const handleMessage = async (raw: string) => {
      let msg: Message;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.t === "u") {
        if (!key || msg.v !== version) return; // other key: a catch-up follows
        try {
          applyRemote(await decryptBytes(key, msg, noteId, "update"));
        } catch (e) {
          console.warn("Could not decrypt an update", e);
        }
        markSeq(msg.seq);
        scheduleSave();
        if (msg.cid && myCids.delete(msg.cid) && msg.seq - snapshotUpto >= COMPACT_EVERY) {
          await compact().catch((e) => console.warn("Compaction failed", e));
        }
      } else if (msg.t === "stale" || msg.t === "rekeyed") {
        // The key changed under us. Re-read it; our unsent edits go out again.
        await loadFromServer(contiguous);
        resendMissing();
      } else if (msg.t === "error") {
        console.warn("Collab server refused an update:", msg.message);
      }
    };

    const onStateless = (raw: string) => {
      if (!caughtUp) waiting.push(raw);
      else void serial(() => handleMessage(raw));
    };

    // ---- local edits ----
    const scheduleSave = () => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => void serial(saveLocal), SAVE_DELAY_MS);
    };

    const savePreview = async () => {
      if (!key || myRole === "viewer") return;
      const blob = await encryptPreview(key, previewOf(ydoc), noteId, version);
      await localDB.notes.update(noteId, { enc_preview: blob, updated_at: new Date().toISOString() });
      await api.put(`/notes/${noteId}/enc/preview`, blob).catch(() => {}); // offline: next edit retries
    };

    const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE || origin === LOCAL_CACHE) return;
      outbox.push(update);
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(() => void serial(flush), PUSH_DELAY_MS);
      scheduleSave();
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(() => void serial(savePreview), PREVIEW_DELAY_MS);
    };
    ydoc.on("update", onLocalUpdate);

    // ---- replacing the key (someone lost access) ----
    const rotate = async () => {
      if (!key || (myRole !== "owner" && myRole !== "admin")) return;
      const r = await rotateNoteKey(noteId, ydoc, version);
      adoptKey(r.noteKey, r.version);
      shadow = new Y.Doc();
      contiguous = 0;
      aheadOfContiguous.clear();
      await loadFromServer(0); // our own new snapshot
      provider.sendStateless(JSON.stringify({ t: "rekeyed" }));
      scheduleSave();
    };
    rotateRef.current = () => serial(rotate).then(() => undefined);

    // ---- the relay connection ----
    // The provider's own Y.Doc stays empty forever: the real one never
    // touches the socket in plaintext.
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: `enc:${noteId}`,
      document: new Y.Doc(),
      token: async () => {
        try {
          const res = await api.get<{ token: string; role: NoteRole }>(`/notes/${noteId}/collab-token`);
          return res.data.token;
        } catch (e) {
          const s = errorStatus(e);
          if (s === 403 || s === 404) setAccessLost(true);
          throw e;
        }
      },
      onStatus: ({ status }) => {
        connected = status === "connected";
        if (!connected) caughtUp = false;
        setStatus(status as CollabStatus);
      },
      onSynced: () => void catchUp(),
      onStateless: ({ payload }) => onStateless(payload),
      onAuthenticationFailed: () => {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          if (destroyed || document.hidden) return;
          provider.disconnect();
          provider.connect();
        }, RETRY_MS);
      },
    });

    const onVisibilityChange = () => {
      window.clearTimeout(hiddenTimer);
      if (document.hidden) {
        hiddenTimer = window.setTimeout(() => provider.disconnect(), HIDDEN_DISCONNECT_MS);
      } else {
        provider.connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Offline copy first (instant, works without a network), then the server
    // over REST. Once the socket is up, onSynced catches up again for
    // anything sent in between; pushing waits for the socket (flush checks).
    void serial(loadLocal);
    void catchUp();

    setSession({ ydoc, provider: null });

    return () => {
      destroyed = true;
      rotateRef.current = null;
      [pushTimer, saveTimer, previewTimer, retryTimer, hiddenTimer].forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ydoc.off("update", onLocalUpdate);
      // Last unsent edits: encrypt + send, save the offline copy, then close.
      const pending = outbox.length && key && connected && myRole !== "viewer";
      const lastKey = key;
      const finish = async () => {
        if (pending && lastKey) {
          const blob = await encryptBytes(lastKey, own(Y.mergeUpdates(outbox)), noteId, version, "update");
          provider.sendStateless(JSON.stringify({ t: "push", cid: toB64(randomBytes(9)), ...blob }));
        }
        if (lastKey) {
          const blob = await encryptBytes(lastKey, own(Y.encodeStateAsUpdate(ydoc)), noteId, version, "snapshot");
          await localDB.encDocs.put({ id: noteId, ...blob });
        }
      };
      finish()
        .catch((e) => console.error("Encrypted note: final save failed", e))
        .finally(() => {
          provider.destroy();
          ydoc.destroy();
          shadow.destroy();
        });
      setSession(null);
      setSeeded(false);
      setRole(null);
      setAccessLost(false);
      setStatus("connecting");
      setKeyState("loading");
      setNoteKey(null);
    };
  }, [noteId, enabled, privateKey, myUserId]);

  return {
    session,
    status,
    seeded,
    role,
    accessLost,
    keyState,
    noteKey,
    /** Owner/admin: replace the note key now (after removing someone). */
    rotate: () => rotateRef.current?.() ?? Promise.resolve(),
  };
}
