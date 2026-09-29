// Data layer for the console's `ls` and `rm` commands.
// Mirrors exactly what the UI already does (NoteCard delete, RecycleBin
// "empty bin"), so the terminal and the buttons can never disagree.
import { localDB } from "./db.js";
import { decryptData } from "./crypto.js";
import { triggerSync } from "./syncEngine.js";
import api from "./axios.js";

export const SHORT_ID = 8; // uuid v4 prefix shown by `ls`

// Tell open pages (e.g. RecycleBinPage) to re-read IndexedDB.
const announce = () => window.dispatchEvent(new CustomEvent("notes-changed"));

/** Notes (or bin items) for `ls`, newest first, with decrypted titles when unlocked. */
export async function listNotes(userId, cryptoKey, { deleted = false } = {}) {
  const rows = await localDB.notes
    .where("user_id")
    .equals(userId)
    .filter((n) => n.is_deleted === deleted)
    .toArray();
  rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return Promise.all(
    rows.map(async (n) => {
      let title = null; // null = can't show (vault locked)
      if (!n.iv_title) title = n.title;
      else if (cryptoKey) {
        try {
          title = await decryptData(n.title, n.iv_title, cryptoKey);
        } catch {
          title = "⚠ decryption failed";
        }
      }
      return { id: n.id, title, updated_at: n.updated_at };
    }),
  );
}

/**
 * Resolve what the user typed to exactly one live note.
 * Accepts the full uuid or any unique prefix of at least 4 characters.
 */
export async function resolveNote(userId, idOrPrefix, cmdName = "rm") {
  const q = idOrPrefix.toLowerCase();
  if (q.length < 4) return { error: `${cmdName}: id too short — use at least 4 characters (see \`ls\`)` };
  const matches = await localDB.notes
    .where("user_id")
    .equals(userId)
    .filter((n) => n.is_deleted === false && n.id.toLowerCase().startsWith(q))
    .toArray();
  if (matches.length === 0) return { error: `${cmdName}: '${idOrPrefix}': no such note` };
  if (matches.length > 1)
    return { error: `${cmdName}: '${idOrPrefix}' is ambiguous (${matches.length} notes) — type more of the id` };
  return { note: matches[0] };
}

/** Soft delete → recycle bin. Same fields NoteCard sets; works offline, syncs later. */
export async function moveToBin(userId, id) {
  await localDB.notes.update(id, {
    is_deleted: true,
    updated_at: new Date().toISOString(),
    sync_status: "pending_update",
  });
  triggerSync(userId);
  announce();
}

/** Permanently empty the bin. Online only: the server copy must go too. */
export async function emptyBin(userId) {
  if (!navigator.onLine) {
    throw new Error("offline — emptying the bin needs a connection so the server copies are deleted too");
  }
  await api.delete("/notes/clear-recycle-bin");
  const removed = await localDB.notes
    .where("user_id")
    .equals(userId)
    .filter((n) => n.is_deleted === true)
    .delete();
  announce();
  return removed;
}

/** Decrypted title of a raw note record, or null if the vault is locked. */
export async function titleOf(note, cryptoKey) {
  if (!note.iv_title) return note.title;
  if (!cryptoKey) return null;
  try {
    return await decryptData(note.title, note.iv_title, cryptoKey);
  } catch {
    return null;
  }
}
