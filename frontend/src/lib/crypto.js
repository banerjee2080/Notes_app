// frontend/src/lib/crypto.js
import { sanitizeHtml } from "./sanitize.js";

const ITERATIONS = 300000; // High iteration count to strengthen the 6-digit PIN against brute-force

const bufferToBase64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const base64ToBuffer = (base64) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/**
 * Derives a 256-bit AES-GCM CryptoKey from a 6-digit PIN and user-specific Salt (user_id)
 */
export async function deriveKeyFromPin(pin, userSalt) {
  const encoder = new TextEncoder();

  // Import raw PIN as key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Derive AES-GCM Key using PBKDF2
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(userSalt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // Non-extractable from browser memory for security
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts a text string using the derived AES-GCM CryptoKey
 */
export async function encryptData(text, cryptoKey) {
  if (!text) return { ciphertext: "", iv: "" };

  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Fresh 12-byte IV per encryption

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(text),
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

export async function decryptData(ciphertext, ivBase64, cryptoKey) {
  if (!ciphertext || !ivBase64) return ciphertext || "";

  const iv = base64ToBuffer(ivBase64);
  const encryptedBuffer = base64ToBuffer(ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedBuffer,
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Encrypt note HTML. Sanitizes first.
 *
 * The server cannot sanitize ciphertext without breaking zero-knowledge, so
 * the client is the only place this can happen. Every note-body encryption
 * must go through here, never through encryptData directly.
 */
export async function encryptHtml(html, cryptoKey) {
  return encryptData(sanitizeHtml(html), cryptoKey);
}

/**
 * Decrypt note HTML and re-sanitize on the way out.
 *
 * Defence in depth: notes encrypted before this change, or synced from a
 * device running an older build, were never sanitized at write time.
 */
export async function decryptHtml(ciphertext, ivBase64, cryptoKey) {
  const plain = await decryptData(ciphertext, ivBase64, cryptoKey);
  return sanitizeHtml(plain);
}
