// The note record exactly as it lives in IndexedDB and travels to the server.

export type SyncStatus = "synced" | "pending_update";

/** What the current user may do with a note. */
export type NoteRole = "owner" | "editor" | "viewer";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  updated_at: string;
  is_deleted: boolean;
  sync_status: SyncStatus;
  createdAt?: string;
  created_at?: string;
  /** Sent by /sync; older local rows don't have it. */
  role?: NoteRole;
  /** Users the note is shared with (lets shared notes show up in the list). */
  collaborator_ids?: string[];
}

/** Row of the `meta` key/value table. */
export interface MetaEntry<T = unknown> {
  key: string;
  value: T;
}
