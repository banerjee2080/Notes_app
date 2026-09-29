import { localDB } from "../lib/db.js";
import axiosInstance from "../lib/axios.js";
import { useSyncStore } from "../stores/useSyncStore.js";

const toMs = (value) => new Date(value).getTime();

// The currently running sync (or null). A second caller waits on the same
// promise instead of returning early, so logout can reliably await a sync.
let inFlightSync = null;

export const triggerSync = (userId) => {
  if (!navigator.onLine || !userId) {
    if (userId) registerBackgroundSync(userId);
    return Promise.resolve(false);
  }

  if (inFlightSync) return inFlightSync;

  inFlightSync = runSync(userId).finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
};

const runSync = async (userId) => {
  const { setSyncing } = useSyncStore.getState();
  setSyncing(true);

  try {
    const localChanges = await localDB.notes
      .where("sync_status")
      .notEqual("synced")
      .and((note) => note.user_id === userId)
      .toArray();

    // Remember exactly which version of each note we are sending
    const sentVersions = new Map(
      localChanges.map((note) => [note.id, note.updated_at]),
    );

    const metaEntry = await localDB.meta.get(`lastSyncedAt_${userId}`);
    const lastSyncedAt = metaEntry ? metaEntry.value : null;

    const res = await axiosInstance.post("/notes/sync", {
      lastSyncedAt,
      localChanges,
    });
    const { serverChanges, timestamp } = res.data;

    await localDB.transaction("rw", localDB.notes, localDB.meta, async () => {
      // Apply server changes, unless this device holds a newer unsent edit
      for (const serverNote of serverChanges ?? []) {
        const localNote = await localDB.notes.get(serverNote.id);
        const localHasNewerPendingEdit =
          localNote &&
          localNote.sync_status !== "synced" &&
          toMs(localNote.updated_at) > toMs(serverNote.updated_at);

        if (localHasNewerPendingEdit) continue;

        await localDB.notes.put({ ...serverNote, sync_status: "synced" });
      }

      // Mark a note synced only if it is still the exact version we sent
      for (const [id, sentUpdatedAt] of sentVersions) {
        const current = await localDB.notes.get(id);
        if (
          current &&
          current.sync_status !== "synced" &&
          current.updated_at === sentUpdatedAt
        ) {
          await localDB.notes.update(id, { sync_status: "synced" });
        }
      }

      await localDB.meta.put({ key: `lastSyncedAt_${userId}`, value: timestamp });
    });

    console.log("Sync complete at", timestamp);
    return true;
  } catch (error) {
    console.error("Sync Engine Failed:", error);
    return false;
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
