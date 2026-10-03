// Note-key lifecycle for end-to-end encrypted notes. Everything that needs
// both a note key and other members' public keys lives here; the server only
// stores what these functions produce.
import * as Y from "yjs";
import api from "./axios";
import {
  encryptBytes,
  encryptPreview,
  exportNoteKey,
  fromB64Url,
  importNoteKey,
  newNoteKey,
  toB64Url,
  wrapNoteKey,
  type NotePreview,
  type WrappedNoteKey,
} from "./crypto";

interface Member {
  _id: string;
  fullName: string;
  publicKey: string | null;
  hasKey: boolean;
}

const fetchMembers = async (noteId: string) =>
  (await api.get<{ members: Member[] }>(`/notes/${noteId}/enc/members`)).data.members;

/** The note key wrapped for every member who has a PIN. */
const wrapForMembers = async (noteKey: CryptoKey, members: Member[], noteId: string, v: number) =>
  Promise.all(
    members
      .filter((m) => m.publicKey)
      .map(async (m) => ({ user: m._id, ...(await wrapNoteKey(noteKey, m.publicKey!, noteId, v)) })),
  );

/** Title + the first few hundred characters of text, for note lists. */
export const previewOf = (ydoc: Y.Doc): NotePreview => {
  const title = String(ydoc.getMap("meta").get("title") ?? "");
  const text = ydoc
    .getXmlFragment("default")
    .toString()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return { title, text };
};

const encryptState = (noteKey: CryptoKey, ydoc: Y.Doc, noteId: string, v: number) =>
  encryptBytes(noteKey, new Uint8Array(Y.encodeStateAsUpdate(ydoc)), noteId, v, "snapshot");

/**
 * Turns a plaintext note into an encrypted one. `ydoc` is the live,
 * fully-loaded plaintext document; its current state becomes the first
 * encrypted snapshot. Owner/admin only.
 */
export const enableEncryption = async (noteId: string, ydoc: Y.Doc) => {
  const members = await fetchMembers(noteId);
  const v = 1;
  const noteKey = await newNoteKey();
  const [snapshot, preview, keys] = await Promise.all([
    encryptState(noteKey, ydoc, noteId, v),
    encryptPreview(noteKey, previewOf(ydoc), noteId, v),
    wrapForMembers(noteKey, members, noteId, v),
  ]);
  await api.post(`/notes/${noteId}/enc/enable`, { snapshot, preview, keys });
  return {
    noteKey,
    version: v,
    // Members without a PIN couldn't get a key; they'll need to set one up.
    withoutPin: members.filter((m) => !m.publicKey).map((m) => m.fullName),
  };
};

/**
 * Replaces the note key after someone lost access: new key, current content
 * re-encrypted under it, wrapped only for who's still on the note. Anyone
 * removed keeps what they already saw, but nothing written from now on.
 */
export const rotateNoteKey = async (noteId: string, ydoc: Y.Doc, fromVersion: number) => {
  const members = await fetchMembers(noteId);
  const v = fromVersion + 1;
  const noteKey = await newNoteKey();
  const [snapshot, preview, keys] = await Promise.all([
    encryptState(noteKey, ydoc, noteId, v),
    encryptPreview(noteKey, previewOf(ydoc), noteId, v),
    wrapForMembers(noteKey, members, noteId, v),
  ]);
  await api.post(`/notes/${noteId}/enc/rotate`, { fromVersion, snapshot, preview, keys });
  return { noteKey, version: v };
};

/** Wraps the current key for members who have a PIN but no key (e.g. they reset their PIN). */
export const healMissingKeys = async (noteId: string, noteKey: CryptoKey, v: number) => {
  const missing = (await fetchMembers(noteId)).filter((m) => m.publicKey && !m.hasKey);
  if (!missing.length) return 0;
  const keys = await wrapForMembers(noteKey, missing, noteId, v);
  await api.put(`/notes/${noteId}/enc/keys`, { v, keys });
  return keys.length;
};

/** Someone who arrived through a link: store their own wrapped copy. */
export const saveOwnKey = async (
  noteId: string,
  noteKey: CryptoKey,
  v: number,
  myUserId: string,
  myPublicKey: string,
) => {
  const wrapped = await wrapNoteKey(noteKey, myPublicKey, noteId, v);
  await api.put(`/notes/${noteId}/enc/keys`, { v, keys: [{ user: myUserId, ...wrapped }] });
};

/** For an invite (the share endpoint's NEEDS_KEY answer). */
export const wrapForInvite = (
  noteKey: CryptoKey,
  publicKey: string,
  noteId: string,
  v: number,
): Promise<WrappedNoteKey> => wrapNoteKey(noteKey, publicKey, noteId, v);

// ---------- share links ----------
// The key rides in the URL fragment (#k=...). Browsers never send the
// fragment to the server, so the server can grant link *access* without ever
// seeing the key. Same idea as Excalidraw / CryptPad links.

export const shareLinkFor = async (noteId: string, noteKey: CryptoKey, v: number) =>
  `${location.origin}/note/${noteId}#k=${toB64Url(await exportNoteKey(noteKey))}&v=${v}`;

export const keyFromFragment = async (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const k = params.get("k");
  const v = Number(params.get("v"));
  if (!k || !Number.isInteger(v) || v < 1) return null;
  try {
    return { key: await importNoteKey(fromB64Url(k)), version: v };
  } catch {
    return null;
  }
};
