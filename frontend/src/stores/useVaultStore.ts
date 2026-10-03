import { create } from "zustand";
import api from "../lib/axios";
import { localDB } from "../lib/db";
import { errorBody, errorStatus } from "../lib/errors";
import {
  PBKDF2_ITERATIONS,
  createIdentity,
  deriveAuthKey,
  derivePinSecret,
  deriveWrapKey,
  fromB64,
  randomBytes,
  toB64,
  unwrapIdentity,
  unwrapNoteKey,
  type WrappedBlob,
  type WrappedNoteKey,
} from "../lib/crypto";

// The PIN vault in the browser. Holds the unlocked private key (never
// exportable) and the note keys opened with it - in memory only, unless the
// user ticks "keep unlocked": then the private key CryptoKey itself is stored
// in IndexedDB (browsers store it without ever exposing its bytes) for 7 days.

export type VaultStatus = "unknown" | "none" | "locked" | "unlocked";

const KEEP_UNLOCKED_MS = 7 * 24 * 60 * 60 * 1000;
const metaKey = (userId: string) => `vault_${userId}`;

interface RememberedVault {
  privateKey: CryptoKey;
  publicKey: string;
  expires: number;
}

interface VaultInfo {
  status: "none" | "set";
  salt?: string;
  iterations?: number;
  publicKey?: string;
  lockedUntil?: string | null;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; message: string; lockedUntil?: string | null };

interface VaultState {
  userId: string | null;
  status: VaultStatus;
  privateKey: CryptoKey | null;
  publicKey: string | null;
  /** "<noteId>:<version>" → note key. */
  noteKeys: Map<string, CryptoKey>;

  /** Load the vault state for this user (and a remembered key, if any). */
  refresh: (userId: string | undefined) => Promise<void>;
  setup: (pin: string, keepUnlocked: boolean) => Promise<UnlockResult>;
  unlock: (pin: string, keepUnlocked: boolean) => Promise<UnlockResult>;
  lock: () => Promise<void>;
  /** Forgot PIN: needs a verificationToken from the "vault_reset" OTP. */
  reset: (verificationToken: string) => Promise<UnlockResult>;
  /** The note key for a wrapped copy, unwrapping (and caching) it if needed. */
  openNoteKey: (noteId: string, wrapped: WrappedNoteKey) => Promise<CryptoKey | null>;
  cachedNoteKey: (noteId: string, version: number) => CryptoKey | null;
  rememberNoteKey: (noteId: string, version: number, key: CryptoKey) => void;
}

const failure = (e: unknown, fallback: string): UnlockResult => {
  const body = errorBody<{ message?: string; lockedUntil?: string | null }>(e);
  return { ok: false, message: body?.message ?? fallback, lockedUntil: body?.lockedUntil ?? null };
};

const forget = async (userId: string) => {
  try {
    await localDB.meta.delete(metaKey(userId));
  } catch (e) {
    console.error("Could not clear the stored vault key", e);
  }
};

const remember = async (userId: string, privateKey: CryptoKey, publicKey: string, keep: boolean) => {
  if (!keep) return forget(userId);
  try {
    const value: RememberedVault = { privateKey, publicKey, expires: Date.now() + KEEP_UNLOCKED_MS };
    await localDB.meta.put({ key: metaKey(userId), value });
  } catch (e) {
    console.error("Could not store the vault key", e);
  }
};

export const useVaultStore = create<VaultState>()((set, get) => ({
  userId: null,
  status: "unknown",
  privateKey: null,
  publicKey: null,
  noteKeys: new Map(),

  refresh: async (userId) => {
    if (!userId) {
      set({ userId: null, status: "unknown", privateKey: null, publicKey: null, noteKeys: new Map() });
      return;
    }
    if (get().userId === userId && get().status === "unlocked") return;
    set({ userId });

    // A remembered key works offline too.
    try {
      const entry = await localDB.meta.get(metaKey(userId));
      const saved = entry?.value as RememberedVault | undefined;
      if (saved && saved.expires > Date.now() && saved.privateKey) {
        set({ status: "unlocked", privateKey: saved.privateKey, publicKey: saved.publicKey });
        return;
      }
      if (saved) await localDB.meta.delete(metaKey(userId));
    } catch {
      // storage unavailable: fall through to the server
    }

    try {
      const { data } = await api.get<VaultInfo>("/vault");
      if (get().userId !== userId) return;
      set({ status: data.status === "set" ? "locked" : "none", publicKey: data.publicKey ?? null });
    } catch {
      // Offline and nothing remembered: treat as locked; the dialog retries.
      if (get().userId === userId) set({ status: "locked" });
    }
  },

  setup: async (pin, keepUnlocked) => {
    const userId = get().userId;
    if (!userId) return { ok: false, message: "Not signed in" };
    try {
      const { data: begin } = await api.post<{ pepper: string }>("/vault/setup/begin");
      const salt = randomBytes(16);
      const secret = await derivePinSecret(pin, salt, PBKDF2_ITERATIONS);
      const wrapKey = await deriveWrapKey(secret, fromB64(begin.pepper));
      const identity = await createIdentity(wrapKey);
      await api.post("/vault/setup", {
        salt: toB64(salt),
        iterations: PBKDF2_ITERATIONS,
        authKey: await deriveAuthKey(secret),
        publicKey: identity.publicKey,
        wrappedPrivateKey: identity.wrappedPrivateKey,
      });
      // Re-open it the normal way: proves the round trip and leaves only a
      // non-extractable private key in memory.
      const privateKey = await unwrapIdentity(identity.wrappedPrivateKey, wrapKey);
      set({ status: "unlocked", privateKey, publicKey: identity.publicKey });
      await remember(userId, privateKey, identity.publicKey, keepUnlocked);
      return { ok: true };
    } catch (e) {
      return failure(e, "Could not set the PIN");
    }
  },

  unlock: async (pin, keepUnlocked) => {
    const userId = get().userId;
    if (!userId) return { ok: false, message: "Not signed in" };
    try {
      const { data: info } = await api.get<VaultInfo>("/vault");
      if (info.status !== "set" || !info.salt || !info.iterations) {
        set({ status: "none" });
        return { ok: false, message: "No PIN set yet" };
      }
      const secret = await derivePinSecret(pin, fromB64(info.salt), info.iterations);
      const { data } = await api.post<{ pepper: string; wrappedPrivateKey: WrappedBlob; publicKey: string }>(
        "/vault/unlock",
        { authKey: await deriveAuthKey(secret) },
      );
      const wrapKey = await deriveWrapKey(secret, fromB64(data.pepper));
      const privateKey = await unwrapIdentity(data.wrappedPrivateKey, wrapKey);
      set({ status: "unlocked", privateKey, publicKey: data.publicKey });
      await remember(userId, privateKey, data.publicKey, keepUnlocked);
      return { ok: true };
    } catch (e) {
      if (errorStatus(e) === 401 || errorStatus(e) === 429) return failure(e, "Wrong PIN");
      return failure(e, "Could not unlock");
    }
  },

  lock: async () => {
    const userId = get().userId;
    if (userId) await forget(userId);
    set({
      status: get().status === "unlocked" ? "locked" : get().status,
      privateKey: null,
      noteKeys: new Map(),
    });
  },

  reset: async (verificationToken) => {
    const userId = get().userId;
    try {
      await api.post("/vault/reset", { verificationToken });
      if (userId) await forget(userId);
      set({ status: "none", privateKey: null, publicKey: null, noteKeys: new Map() });
      return { ok: true };
    } catch (e) {
      return failure(e, "Could not reset the PIN");
    }
  },

  openNoteKey: async (noteId, wrapped) => {
    const cached = get().cachedNoteKey(noteId, wrapped.v);
    if (cached) return cached;
    const privateKey = get().privateKey;
    if (!privateKey) return null;
    try {
      const key = await unwrapNoteKey(wrapped, privateKey, noteId);
      get().rememberNoteKey(noteId, wrapped.v, key);
      return key;
    } catch {
      return null; // wrapped for an older key pair (PIN was reset)
    }
  },

  cachedNoteKey: (noteId, version) => get().noteKeys.get(`${noteId}:${version}`) ?? null,

  rememberNoteKey: (noteId, version, key) => {
    const next = new Map(get().noteKeys);
    next.set(`${noteId}:${version}`, key);
    set({ noteKeys: next });
  },
}));
