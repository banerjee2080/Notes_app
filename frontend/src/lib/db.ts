import Dexie, { type Table } from "dexie";
import type { MetaEntry, Note, StoredVaultKey, VaultCheck } from "../types/notes";

class PrismDB extends Dexie {
  notes!: Table<Note, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("PrismDB");
    this.version(2).stores({
      notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
      meta: "key, value",
    });
  }
}

export const localDB = new PrismDB();

// How many of this user's notes the server has NOT confirmed yet.
// "synced" is the only state that means "safe to delete locally".
export const countUnsyncedNotes = async (
  userId: string | undefined,
): Promise<number> => {
  if (!userId) return 0;
  return localDB.notes
    .where("sync_status")
    .notEqual("synced")
    .and((note) => note.user_id === userId)
    .count();
};

// keepUnsynced: true  -> delete synced notes + all meta, KEEP unsynced notes
// keepUnsynced: false -> delete everything (only after the user chose to discard)
export const clearLocalDB = async ({
  keepUnsynced = false,
}: { keepUnsynced?: boolean } = {}): Promise<boolean> => {
  try {
    if (keepUnsynced) {
      await localDB.transaction("rw", localDB.notes, localDB.meta, async () => {
        await localDB.notes.where("sync_status").equals("synced").delete();
        await localDB.meta.clear();
      });
      console.log("Local IndexedDB cleared (unsynced notes kept).");
    } else {
      await Promise.all(localDB.tables.map((table) => table.clear()));
      console.log("Local IndexedDB cleared.");
    }
    return true;
  } catch (error) {
    console.error("Failed to clear local IndexedDB:", error);
    return false;
  }
};

/** Read one meta row and narrow its value to `T`. */
const readMeta = async <T>(key: string): Promise<T | undefined> => {
  const entry = await localDB.meta.get(key);
  return entry?.value as T | undefined;
};

// Tracks (per-user, per-device) whether a vault PIN has already been established.
// Stored in IndexedDB rather than inferred from notes so it survives reloads/tab
// closes even before any note has synced locally.
const pinMetaKey = (userId: string) => `pinConfigured_${userId}`;

export const isPinConfigured = async (
  userId: string | undefined,
): Promise<boolean> => {
  if (!userId) return false;
  return !!(await readMeta<boolean>(pinMetaKey(userId)));
};

export const markPinConfigured = async (
  userId: string | undefined,
): Promise<void> => {
  if (!userId) return;
  await localDB.meta.put({ key: pinMetaKey(userId), value: true });
};

// ── Vault key persistence ───────────────────────────────────────────────
// We store the derived CryptoKey (non-extractable), never the PIN itself.

const VAULT_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const vaultKeyMetaKey = (userId: string) => `vaultKey_${userId}`;

/**
 * A key read back from IndexedDB is only trustworthy if it is what we put
 * there: a real, non-extractable, AES-GCM CryptoKey. IndexedDB is same-origin
 * writable, so an XSS could plant an extractable key of its own and have us
 * encrypt every future note under a key it controls.
 */
const isTrustworthyVaultKey = (key: unknown): key is CryptoKey =>
  typeof CryptoKey !== "undefined" &&
  key instanceof CryptoKey &&
  key.extractable === false &&
  key.algorithm?.name === "AES-GCM" &&
  key.usages?.includes("encrypt") &&
  key.usages?.includes("decrypt");

export const saveVaultKey = async (
  userId: string | undefined,
  cryptoKey: CryptoKey | null,
  ttlMs: number = VAULT_KEY_TTL_MS,
): Promise<void> => {
  if (!userId || !cryptoKey) return;
  if (!isTrustworthyVaultKey(cryptoKey)) {
    console.error(
      "Refusing to persist a key that is not a non-extractable AES-GCM CryptoKey",
    );
    return;
  }
  const value: StoredVaultKey = { cryptoKey, expiry: Date.now() + ttlMs };
  await localDB.meta.put({ key: vaultKeyMetaKey(userId), value });
};

export const getVaultKey = async (
  userId: string | undefined,
): Promise<CryptoKey | null> => {
  if (!userId) return null;

  const stored = await readMeta<StoredVaultKey>(vaultKeyMetaKey(userId));
  if (!stored?.cryptoKey) return null;

  if (Date.now() > stored.expiry) {
    await localDB.meta.delete(vaultKeyMetaKey(userId));
    return null;
  }

  if (!isTrustworthyVaultKey(stored.cryptoKey)) {
    console.error("Stored vault key failed integrity check - discarding");
    await localDB.meta.delete(vaultKeyMetaKey(userId));
    return null;
  }

  return stored.cryptoKey;
};

export const clearVaultKey = async (
  userId: string | undefined,
): Promise<void> => {
  if (!userId) return;
  await localDB.meta.delete(vaultKeyMetaKey(userId));
};

// ── Vault check cache ───────────────────────────────────────────────────
// Local copy of the server's vault check, so the PIN can be verified offline.
// Not secret: it is ciphertext that only the correct key can open.

const vaultCheckMetaKey = (userId: string) => `vaultCheck_${userId}`;

export const getLocalVaultCheck = async (
  userId: string | undefined,
): Promise<VaultCheck | null> => {
  if (!userId) return null;
  const value = await readMeta<VaultCheck>(vaultCheckMetaKey(userId));
  if (!value?.ciphertext || !value?.iv) return null;
  return value;
};

export const saveLocalVaultCheck = async (
  userId: string | undefined,
  vaultCheck: VaultCheck | null | undefined,
): Promise<void> => {
  if (!userId || !vaultCheck?.ciphertext || !vaultCheck?.iv) return;
  await localDB.meta.put({
    key: vaultCheckMetaKey(userId),
    value: { ciphertext: vaultCheck.ciphertext, iv: vaultCheck.iv },
  });
};
