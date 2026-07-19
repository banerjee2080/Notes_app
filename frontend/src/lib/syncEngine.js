import { localDB } from "../lib/db.js";
import axiosInstance from "../lib/axios.js";
import { useSyncStore } from "../stores/useSyncStore.js";

export const triggerSync = async (userId) => {
  if (!navigator.onLine || !userId) {
    if (userId) registerBackgroundSync(userId);
    return;
  }

  const { isSyncing, setSyncing } = useSyncStore.getState();
  if (isSyncing) return;

  setSyncing(true);

  try {
    const localChanges = await localDB.notes
      .where("sync_status")
      .notEqual("synced")
      .and((note) => note.user_id === userId)
      .toArray();
    const metaEntry = await localDB.meta.get(`lastSyncedAt_${userId}`);
    const lastSyncedAt = metaEntry ? metaEntry.value : null;
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

    await localDB.meta.put({ key: `lastSyncedAt_${userId}`, value: timestamp });
    console.log("Sync complete at", timestamp);
  } catch (error) {
    console.error("Sync Engine Failed:", error);
  } finally {
    setSyncing(false);
  }
};

export const registerBackgroundSync = async (userId) => {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(`sync-notes-${userId}`);
      console.log("Background sync registered successfully");
    } catch (err) {
      console.error("Background sync registration failed:", err);
    }
  } else {
    console.log("Background Sync is not supported by this browser.");
  }
};
