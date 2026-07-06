import dexie from "dexie";

export const localDB = new dexie("PrismDB");
localDB.version(1).stores({
  notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
});
