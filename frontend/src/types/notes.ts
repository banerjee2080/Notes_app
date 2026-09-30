// The note record exactly as it lives in IndexedDB and travels to the server.
//
// `title` and `content` hold ciphertext whenever the matching `iv_*` field is
// present; the plaintext versions only ever exist in memory (see DecryptedNote).

export type SyncStatus = "synced" | "pending_update";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  /** Base64 IV for `title`. Absent on notes written before encryption. */
  iv_title?: string;
  /** Base64 IV for `content`. Absent on notes written before encryption. */
  iv_content?: string;
  updated_at: string;
  is_deleted: boolean;
  sync_status: SyncStatus;
  createdAt?: string;
  created_at?: string;
}

/** A note whose title/content have been decrypted for display. */
export interface DecryptedNote extends Note {
  /** Set when the vault key could not open this note. */
  decryptFailed?: boolean;
}

/** Row of the `meta` key/value table. */
export interface MetaEntry<T = unknown> {
  key: string;
  value: T;
}

/** A known phrase encrypted with the vault key, used to verify a PIN. */
export interface VaultCheck {
  ciphertext: string;
  iv: string;
}

export interface StoredVaultKey {
  cryptoKey: CryptoKey;
  expiry: number;
}
