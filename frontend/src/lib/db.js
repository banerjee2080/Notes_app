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

export const saveVaultKey = async (userId, cryptoKey, ttlMs = VAULT_KEY_TTL_MS) => {
  if (!userId || !cryptoKey) return;
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
  if (!entry?.value?.cryptoKey) return null;

  if (Date.now() > entry.value.expiry) {
    await localDB.meta.delete(vaultKeyMetaKey(userId));
    return null;
  }

  return entry.value.cryptoKey;
};

export const clearVaultKey = async (userId) => {
  if (!userId) return;
  await localDB.meta.delete(vaultKeyMetaKey(userId));
};
