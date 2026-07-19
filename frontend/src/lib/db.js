import dexie from "dexie";

export const localDB = new dexie("PrismDB");
localDB.version(1).stores({
  notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
});

export const clearLocalDB = async () => {
  try {
    await Promise.all(localDB.tables.map(table => table.clear()));
    console.log("Local IndexedDB cleared.");
  } catch (error) {
    console.error("Failed to clear local IndexedDB:", error);
  }
};
