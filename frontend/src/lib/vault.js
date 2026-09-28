// frontend/src/lib/vault.js
import api from "./axios.js";
import { localDB, getLocalVaultCheck, saveLocalVaultCheck } from "./db.js";
import { createVaultCheck, verifyVaultCheck, decryptData } from "./crypto.js";

export class VaultAlreadySetError extends Error {
  constructor() {
    super("A different PIN is already set for this account");
    this.name = "VaultAlreadySetError";
  }
}

/** Server's view of the vault, or null if we can't reach the server. */
export const fetchServerVaultState = async () => {
  if (!navigator.onLine) return null;
  try {
    const res = await api.get("/auth/vault-check");
    return {
      vaultCheck: res.data?.vaultCheck ?? null,
      hasEncryptedNotes: !!res.data?.hasEncryptedNotes,
    };
  } catch (err) {
    console.error("Could not fetch vault state", err);
    return null;
  }
};

const findLocalEncryptedNote = async (userId) => {
  const notes = await localDB.notes.where("user_id").equals(userId).toArray();
  return notes.find((n) => !!n.iv_content) || null;
};

/**
 * Decides which screen PinPage should show:
 *  "unlock"  - a PIN definitely exists; ask for it
 *  "setup"   - server confirms there is no PIN and no encrypted data
 *  "offline" - we can't tell, so we must not guess
 */
export const getVaultMode = async (userId) => {
  const server = await fetchServerVaultState();

  if (server?.vaultCheck) {
    await saveLocalVaultCheck(userId, server.vaultCheck);
    return "unlock";
  }
  if (await getLocalVaultCheck(userId)) return "unlock";
  if (await findLocalEncryptedNote(userId)) return "unlock";

  if (server) return server.hasEncryptedNotes ? "unlock" : "setup";
  return "offline";
};

/**
 * Stores the vault check for a newly chosen PIN. Write-once on the server.
 * Throws VaultAlreadySetError if a *different* PIN already owns the vault.
 */
export const establishVaultCheck = async (userId, cryptoKey) => {
  const vaultCheck = await createVaultCheck(cryptoKey);

  try {
    await api.post("/auth/vault-check", vaultCheck);
  } catch (err) {
    if (err.response?.status !== 409) throw err;

    const existing = err.response.data?.vaultCheck;
    if (!(await verifyVaultCheck(existing, cryptoKey))) {
      throw new VaultAlreadySetError();
    }
    await saveLocalVaultCheck(userId, existing);
    return;
  }

  await saveLocalVaultCheck(userId, vaultCheck);
};

/**
 * The single source of truth for "is this key the vault key?".
 * Returns { ok: true } or { ok: false, reason: "wrong_pin" | "cannot_verify" }.
 * Never returns ok:true without positive cryptographic proof.
 */
export const verifyPinKey = async (userId, cryptoKey) => {
  // 1. Preferred: the vault check (local cache first, so offline works).
  let vaultCheck = await getLocalVaultCheck(userId);
  if (!vaultCheck) {
    const server = await fetchServerVaultState();
    if (server?.vaultCheck) {
      vaultCheck = server.vaultCheck;
      await saveLocalVaultCheck(userId, vaultCheck);
    }
  }
  if (vaultCheck) {
    return (await verifyVaultCheck(vaultCheck, cryptoKey))
      ? { ok: true }
      : { ok: false, reason: "wrong_pin" };
  }

  // 2. Legacy accounts (created before vault checks): verify against a note,
  //    then create the vault check so this path is only ever used once.
  const note = await findLocalEncryptedNote(userId);
  if (note) {
    try {
      await decryptData(note.content, note.iv_content, cryptoKey);
    } catch {
      return { ok: false, reason: "wrong_pin" };
    }
    try {
      await establishVaultCheck(userId, cryptoKey);
    } catch (err) {
      // Offline, or server hiccup: fine, the note check already proved the
      // key. We'll migrate on a later unlock.
      console.warn("Vault check migration deferred", err);
    }
    return { ok: true };
  }

  // 3. Nothing to verify against. The old code said "ok" here - that was the bug.
  return { ok: false, reason: "cannot_verify" };
};
