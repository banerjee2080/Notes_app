import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "../lib/db";
import { decryptPreview, type NotePreview } from "../lib/crypto";
import { useAuthStore } from "../stores/useAuthStore";
import { useVaultStore } from "../stores/useVaultStore";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";

interface NotesResult {
  /** The user's live notes, or undefined until the first query lands. */
  notes: Note[] | undefined;
  loading: boolean;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LOCKED_HTML = "<p>🔒 end-to-end encrypted - enter your PIN to read</p>";

// Live list of the user's (non-deleted) notes, newest first. Extracted from
// HomePage so the sidebar's "Hoisted Notes" can show titles too.
// Includes notes shared with the user: their user_id is the owner's, so an
// index lookup on user_id alone would miss them.
// Encrypted notes get their title/preview decrypted in memory while the
// vault is unlocked; the decrypted text is never written back to IndexedDB.
export function useNotes(): NotesResult {
  const { authUser } = useAuthStore();
  const privateKey = useVaultStore((s) => s.privateKey);
  // noteId → decrypted preview, tagged with the ciphertext it came from.
  const [previews, setPreviews] = useState<Map<string, NotePreview & { ct: string }>>(new Map());

  const rows = useLiveQuery(() => {
    const me = userIdOf(authUser) ?? "";
    return localDB.notes
      .filter(
        (note) =>
          note.is_deleted === false &&
          (note.user_id === me || (note.collaborator_ids ?? []).includes(me)),
      )
      .reverse()
      .sortBy("updated_at");
  }, [authUser]);

  // Locking forgets the decrypted text too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors the external vault state
    if (!privateKey) setPreviews(new Map());
  }, [privateKey]);

  useEffect(() => {
    if (!rows || !privateKey) return;
    let cancelled = false;
    const vault = useVaultStore.getState();
    const stale = rows.filter(
      (n) =>
        n.is_encrypted &&
        n.enc_preview &&
        n.enc_key &&
        n.enc_key.v === n.enc_preview.v &&
        previews.get(n.id)?.ct !== n.enc_preview.ct,
    );
    if (!stale.length) return;
    (async () => {
      const found = await Promise.all(
        stale.map(async (n) => {
          try {
            const key = await vault.openNoteKey(n.id, n.enc_key!);
            if (!key) return null;
            return [n.id, { ...(await decryptPreview(key, n.enc_preview!, n.id)), ct: n.enc_preview!.ct }] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setPreviews((prev) => {
        const next = new Map(prev);
        for (const entry of found) if (entry) next.set(entry[0], entry[1]);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, privateKey, previews]);

  const notes = useMemo(() => {
    if (!rows) return undefined;
    return rows.map((note) => {
      if (!note.is_encrypted) return note;
      const p = privateKey ? previews.get(note.id) : undefined;
      return p
        ? { ...note, title: p.title, content: `<p>${escapeHtml(p.text)}</p>` }
        : { ...note, title: "", content: LOCKED_HTML };
    });
  }, [rows, previews, privateKey]);

  return { notes, loading: notes === undefined };
}
