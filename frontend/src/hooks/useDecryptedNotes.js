import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "../lib/db.js";
import { useAuthStore } from "../stores/useAuthStore.js";
import { decryptData, decryptHtml } from "../lib/crypto.js";

// Live list of the user's (non-deleted) notes, newest first, plus a decrypted
// copy once the vault key is in memory. Extracted from HomePage so the
// sidebar's "Hoisted Notes" can show real titles too.
export function useDecryptedNotes() {
  const { authUser, cryptoKey } = useAuthStore();
  // Tagged with the key that produced it, so after lockVault() (key -> null)
  // the old plaintext is no longer returned to any component.
  const [decrypted, setDecrypted] = useState({ key: null, list: [] });

  const notes = useLiveQuery(
    () =>
      localDB.notes
        .where("user_id")
        .equals(authUser?._id || authUser?.id || "")
        .filter((note) => note.is_deleted === false)
        .reverse()
        .sortBy("updated_at"),
    [authUser],
  );

  useEffect(() => {
    if (!notes || !cryptoKey) return;

    let isMounted = true;
    const decryptAll = async () => {
      const list = await Promise.all(
        notes.map(async (note) => {
          try {
            const title = note.iv_title
              ? await decryptData(note.title, note.iv_title, cryptoKey)
              : note.title;
            const content = note.iv_content
              ? await decryptHtml(note.content, note.iv_content, cryptoKey)
              : note.content;

            return { ...note, title, content };
          } catch (err) {
            console.error(`Failed to decrypt note ${note.id}`, err);
            // Fallback so the Promise.all doesn't reject entirely
            return {
              ...note,
              decryptFailed: true,
              title: "Decryption Failed",
              content:
                "<p>Could not decrypt this note. It may be corrupted or encrypted with a different PIN.</p>",
            };
          }
        }),
      );
      if (isMounted) setDecrypted({ key: cryptoKey, list });
    };

    decryptAll();
    return () => {
      isMounted = false;
    };
  }, [notes, cryptoKey]);

  return {
    notes,
    decryptedNotes: cryptoKey && decrypted.key === cryptoKey ? decrypted.list : [],
    isUnlocked: Boolean(cryptoKey),
    loading: notes === undefined,
  };
}
