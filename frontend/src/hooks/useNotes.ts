import { useLiveQuery } from "dexie-react-hooks";
import { localDB } from "../lib/db";
import { useAuthStore } from "../stores/useAuthStore";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";

interface NotesResult {
  /** The user's live notes, or undefined until the first query lands. */
  notes: Note[] | undefined;
  loading: boolean;
}

// Live list of the user's (non-deleted) notes, newest first. Extracted from
// HomePage so the sidebar's "Hoisted Notes" can show titles too.
// Includes notes shared with the user: their user_id is the owner's, so an
// index lookup on user_id alone would miss them.
export function useNotes(): NotesResult {
  const { authUser } = useAuthStore();

  const notes = useLiveQuery(() => {
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

  return { notes, loading: notes === undefined };
}
