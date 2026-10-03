// End-to-end encryption primitives. WebCrypto only, no dependencies.
//
//   PIN ──PBKDF2(600k, salt)──► K ──HKDF "auth"──────────► authKey (proves the PIN to the server)
//                                └─HKDF(salt = pepper) "wrap"─► wrapKey (unwraps the private key)
//
//   identity key pair (ECDH P-256): public half on the server in the clear,
//   private half on the server wrapped with wrapKey.
//
//   note key NK (AES-GCM 256, random per note): encrypts the note's Yjs
//   updates, snapshots and preview. Wrapped for every member with ECIES:
//   ephemeral ECDH + HKDF + AES-GCM, so only that member's private key opens it.
//
// Every ciphertext is bound to where it belongs through AES-GCM's
// additional data ("note|<id>|<version>|<kind>"), so the server can't move a
// blob from one note, key version or purpose to another.

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 for PBKDF2-SHA256

// ---------- encoding ----------
export const toB64 = (bytes: ArrayBuffer | Uint8Array): string => {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

export const fromB64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// URL-safe variant for the #k=... fragment of share links.
export const toB64Url = (bytes: ArrayBuffer | Uint8Array) =>
  toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64Url = (s: string) =>
  fromB64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ---------- PIN → keys ----------
/** The slow part (~0.5 s): PIN → 256 bits. */
export const derivePinSecret = async (pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) => {
  const base = await subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    256,
  );
  return subtle.importKey("raw", bits, "HKDF", false, ["deriveBits", "deriveKey"]);
};

/** Sent to the server, which only keeps HMAC(server secret, authKey). */
export const deriveAuthKey = async (pinSecret: CryptoKey) =>
  toB64(
    await subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("notejs-vault-auth") },
      pinSecret,
      256,
    ),
  );

/** Needs both the PIN and the server's pepper. */
export const deriveWrapKey = (pinSecret: CryptoKey, pepper: Uint8Array<ArrayBuffer>) =>
  subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: pepper, info: enc.encode("notejs-vault-wrap") },
    pinSecret,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );

// ---------- identity key pair ----------
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const PRIVATE_AAD = enc.encode("notejs-identity-private-key");

export interface WrappedBlob {
  iv: string;
  ct: string;
}

/** New key pair, the private half wrapped for storage on the server. */
export const createIdentity = async (wrapKey: CryptoKey) => {
  const pair = (await subtle.generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const iv = randomBytes(12);
  const ct = await subtle.wrapKey("pkcs8", pair.privateKey, wrapKey, {
    name: "AES-GCM",
    iv,
    additionalData: PRIVATE_AAD,
  });
  const publicKey = toB64(await subtle.exportKey("raw", pair.publicKey));
  return { publicKey, wrappedPrivateKey: { iv: toB64(iv), ct: toB64(ct) } };
};

/** Throws if the PIN (and so wrapKey) is wrong: AES-GCM's tag won't verify. */
export const unwrapIdentity = (wrapped: WrappedBlob, wrapKey: CryptoKey) =>
  subtle.unwrapKey(
    "pkcs8",
    fromB64(wrapped.ct),
    wrapKey,
    { name: "AES-GCM", iv: fromB64(wrapped.iv), additionalData: PRIVATE_AAD },
    ECDH,
    false, // non-extractable: scripts can use it, nobody can export it
    ["deriveBits"],
  );

const importPublic = (rawB64: string) =>
  subtle.importKey("raw", fromB64(rawB64), ECDH, true, []);

// ---------- note keys ----------
export const newNoteKey = () =>
  subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

export const exportNoteKey = async (key: CryptoKey) =>
  new Uint8Array(await subtle.exportKey("raw", key));

export const importNoteKey = (raw: Uint8Array<ArrayBuffer>) =>
  subtle.importKey("raw", raw, "AES-GCM", true, ["encrypt", "decrypt"]);

/** A note key wrapped for one member (ECIES). */
export interface WrappedNoteKey {
  v: number;
  epk: string; // ephemeral public key
  iv: string;
  ct: string;
}

const wrapInfo = (noteId: string, v: number) => enc.encode(`notejs-note-key|${noteId}|${v}`);

const eciesKey = async (privateKey: CryptoKey, publicKey: CryptoKey, noteId: string, v: number) => {
  const shared = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdf = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: wrapInfo(noteId, v) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const wrapNoteKey = async (
  noteKey: CryptoKey,
  memberPublicKeyB64: string,
  noteId: string,
  v: number,
): Promise<WrappedNoteKey> => {
  const eph = (await subtle.generateKey(ECDH, true, ["deriveBits"])) as CryptoKeyPair;
  const k = await eciesKey(eph.privateKey, await importPublic(memberPublicKeyB64), noteId, v);
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, k, await exportNoteKey(noteKey));
  return {
    v,
    epk: toB64(await subtle.exportKey("raw", eph.publicKey)),
    iv: toB64(iv),
    ct: toB64(ct),
  };
};

export const unwrapNoteKey = async (wrapped: WrappedNoteKey, privateKey: CryptoKey, noteId: string) => {
  const k = await eciesKey(privateKey, await importPublic(wrapped.epk), noteId, wrapped.v);
  const raw = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(wrapped.iv) }, k, fromB64(wrapped.ct));
  return importNoteKey(new Uint8Array(raw));
};

// ---------- content ----------
export type BlobKind = "update" | "snapshot" | "preview";

export interface EncBlob {
  v: number;
  iv: string;
  ct: string;
}

const aad = (noteId: string, v: number, kind: BlobKind) => enc.encode(`note|${noteId}|${v}|${kind}`);

export const encryptBytes = async (
  key: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
  noteId: string,
  v: number,
  kind: BlobKind,
): Promise<EncBlob> => {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(noteId, v, kind) }, key, data);
  return { v, iv: toB64(iv), ct: toB64(ct) };
};

export const decryptBytes = async (key: CryptoKey, blob: EncBlob, noteId: string, kind: BlobKind) =>
  new Uint8Array(
    await subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(blob.iv), additionalData: aad(noteId, blob.v, kind) },
      key,
      fromB64(blob.ct),
    ),
  );

export interface NotePreview {
  title: string;
  text: string;
}

export const encryptPreview = (key: CryptoKey, preview: NotePreview, noteId: string, v: number) =>
  encryptBytes(key, enc.encode(JSON.stringify(preview)), noteId, v, "preview");

export const decryptPreview = async (key: CryptoKey, blob: EncBlob, noteId: string): Promise<NotePreview> => {
  const parsed = JSON.parse(dec.decode(await decryptBytes(key, blob, noteId, "preview")));
  return { title: String(parsed.title ?? ""), text: String(parsed.text ?? "") };
};
