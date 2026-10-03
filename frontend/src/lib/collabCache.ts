// Each note opened in the collaborative editor keeps an offline copy of its
// Yjs document in its own IndexedDB database. Kept dependency-free on purpose:
// lib/db.ts imports it, and db.ts is also bundled into the service worker.

export const collabCacheName = (noteId: string) => `collab-${noteId}`;

/** Deletes a note's offline Yjs copy. Never rejects. */
export const deleteCollabCache = (noteId: string) =>
  new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(collabCacheName(noteId));
    const done = () => resolve();
    request.onsuccess = done;
    request.onerror = done;
    // Blocked = the note is still open in another tab; the browser deletes it
    // once that tab lets go, so don't wait for it.
    request.onblocked = done;
  });
