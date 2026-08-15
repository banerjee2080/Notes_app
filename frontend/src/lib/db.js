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
