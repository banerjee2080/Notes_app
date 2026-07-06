import { localDB } from "../lib/db.js";
import axiosInstance from "../lib/axios.js";
import { useSyncStore } from "../stores/useSyncStore.js";

export const triggerSync = async (userId) => {
  if (!navigator.onLine || !userId) return;

  const { isSyncing, setSyncing } = useSyncStore.getState();
  if (isSyncing) return;
  
  setSyncing(true);

  try {
    const localChanges = await localDB.notes
      .where("sync_status")
      .notEqual("synced")
      .and((note) => note.user_id === userId)
      .toArray();
    const lastSyncedAt = localStorage.getItem(`lastSyncedAt_${userId}`) || null;
    const res = await axiosInstance.post("/notes/sync", {
      lastSyncedAt,
      localChanges,
    });

    const { serverChanges, timestamp } = res.data;
    await localDB.transaction("rw", localDB.notes, async () => {
      if (serverChanges.length > 0) {
        for (const serverNote of serverChanges) {
          await localDB.notes.put({
            ...serverNote,
            sync_status: "synced",
          });
        }
      }

      if (localChanges.length > 0) {
        for (const localNote of localChanges) {
          await localDB.notes.update(localNote.id, { sync_status: "synced" });
        }
      }
    });

    localStorage.setItem(`lastSyncedAt_${userId}`, timestamp);
    console.log("Sync complete at", timestamp);
  } catch (error) {
    console.error("Sync Engine Failed:", error);
  } finally {
    setSyncing(false);
  }
};
