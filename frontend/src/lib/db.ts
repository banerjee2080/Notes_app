import Dexie, { type Table } from "dexie";
import type { MetaEntry, Note } from "../types/notes";
import type { EncBlob } from "./crypto";
import { deleteCollabCache } from "./collabCache";

// Meta rows written by the removed PIN vault. Version 3 deletes them so an
// existing install doesn't keep carrying a derived key around in IndexedDB.
const LEGACY_META_PREFIXES = ["vaultKey_", "vaultCheck_", "pinConfigured_"];

/** Offline copy of an encrypted note: its whole Yjs state, encrypted with the note key. */
export interface EncDocEntry extends EncBlob {
  id: string;
}

class PrismDB extends Dexie {
  notes!: Table<Note, string>;
  meta!: Table<MetaEntry, string>;
  encDocs!: Table<EncDocEntry, string>;

  constructor() {
    super("PrismDB");
    this.version(2).stores({
      notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
      meta: "key, value",
    });
    this.version(3)
      .stores({
        notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
        meta: "key, value",
      })
      .upgrade((tx) =>
        tx
          .table<MetaEntry, string>("meta")
          .filter((entry) =>
            LEGACY_META_PREFIXES.some((prefix) => entry.key.startsWith(prefix)),
          )
          .delete(),
      );
    // Encrypted notes can't use y-indexeddb (it stores plaintext), so they
    // keep an encrypted snapshot here instead.
    this.version(4).stores({
      notes: "id, user_id, title, content, updated_at, is_deleted, sync_status",
      meta: "key, value",
      encDocs: "id",
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
    // Each opened note also has its own Yjs database (collab-<id>). Wipe the
    // ones for the notes being removed below, so the next person on this
    // browser can't read them.
    const forgetIds = keepUnsynced
      ? await localDB.notes.where("sync_status").equals("synced").primaryKeys()
      : await localDB.notes.toCollection().primaryKeys();
    await Promise.all(forgetIds.map((noteId) => deleteCollabCache(noteId)));

    if (keepUnsynced) {
      await localDB.transaction("rw", localDB.notes, localDB.meta, localDB.encDocs, async () => {
        await localDB.notes.where("sync_status").equals("synced").delete();
        await localDB.meta.clear(); // includes a remembered vault key
        await localDB.encDocs.clear();
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
