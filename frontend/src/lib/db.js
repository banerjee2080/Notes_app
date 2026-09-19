import dexie from "dexie";

export const localDB = new dexie("PrismDB");
localDB.version(2).stores({
  notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
  meta: "key, value",
});

export const clearLocalDB = async () => {
  try {
    await Promise.all(localDB.tables.map(table => table.clear()));
    console.log("Local IndexedDB cleared.");
  } catch (error) {
    console.error("Failed to clear local IndexedDB:", error);
  }
};

// Tracks (per-user, per-device) whether a vault PIN has already been established.
// Stored in IndexedDB rather than inferred from notes so it survives reloads/tab
// closes even before any note has synced locally.
const pinMetaKey = (userId) => `pinConfigured_${userId}`;

export const isPinConfigured = async (userId) => {
  if (!userId) return false;
  const entry = await localDB.meta.get(pinMetaKey(userId));
  return !!entry?.value;
};

export const markPinConfigured = async (userId) => {
  if (!userId) return;
  await localDB.meta.put({ key: pinMetaKey(userId), value: true });
};

// ── Vault key persistence ───────────────────────────────────────────────
// We store the derived CryptoKey (non-extractable), never the PIN itself.

const VAULT_KEY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const vaultKeyMetaKey = (userId) => `vaultKey_${userId}`;

/**
 * A key read back from IndexedDB is only trustworthy if it is what we put
 * there: a real, non-extractable, AES-GCM CryptoKey. IndexedDB is same-origin
 * writable, so an XSS could plant an extractable key of its own and have us
 * encrypt every future note under a key it controls.
 */
const isTrustworthyVaultKey = (key) =>
  typeof CryptoKey !== "undefined" &&
  key instanceof CryptoKey &&
  key.extractable === false &&
  key.algorithm?.name === "AES-GCM" &&
  key.usages?.includes("encrypt") &&
  key.usages?.includes("decrypt");

export const saveVaultKey = async (userId, cryptoKey, ttlMs = VAULT_KEY_TTL_MS) => {
  if (!userId || !cryptoKey) return;
  if (!isTrustworthyVaultKey(cryptoKey)) {
    console.error(
      "Refusing to persist a key that is not a non-extractable AES-GCM CryptoKey",
    );
    return;
  }
  await localDB.meta.put({
    key: vaultKeyMetaKey(userId),
    value: {
      cryptoKey,
      expiry: Date.now() + ttlMs,
    },
  });
};

export const getVaultKey = async (userId) => {
  if (!userId) return null;

  const entry = await localDB.meta.get(vaultKeyMetaKey(userId));
  const stored = entry?.value?.cryptoKey;
  if (!stored) return null;

  if (Date.now() > entry.value.expiry) {
    await localDB.meta.delete(vaultKeyMetaKey(userId));
    return null;
  }

  if (!isTrustworthyVaultKey(stored)) {
    console.error("Stored vault key failed integrity check - discarding");
    await localDB.meta.delete(vaultKeyMetaKey(userId));
    return null;
  }

  return stored;
};

export const clearVaultKey = async (userId) => {
  if (!userId) return;
  await localDB.meta.delete(vaultKeyMetaKey(userId));
};
