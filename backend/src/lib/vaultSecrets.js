// Server half of the PIN vault. The browser derives everything that matters
// from the PIN; the server only adds two things a stolen database can't give
// an attacker:
//   - a verifier: HMAC(server secret, authKey), so a PIN guess can't be
//     checked offline against a database dump, and
//   - a pepper: random bytes mixed into the key that unwraps the private
//     key, stored sealed under the server secret and only handed out after
//     a correct PIN (online, rate-limited).
// See frontend/src/lib/crypto.ts for the browser half.
import crypto from "crypto";

const secret = () => {
  const s = process.env.VAULT_SERVER_SECRET;
  if (!s || s.length < 32) {
    throw new Error("VAULT_SERVER_SECRET must be set (32+ characters)");
  }
  return s;
};

// Separate keys for separate jobs, all derived from the one env secret.
const subkey = (label) =>
  crypto.createHmac("sha256", secret()).update(label).digest();

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
export const isB64 = (value, min = 1, max = 4096) =>
  typeof value === "string" &&
  value.length >= min &&
  value.length <= max &&
  B64.test(value);

export const verifierFor = (authKeyB64) =>
  crypto
    .createHmac("sha256", subkey("vault-verifier"))
    .update(Buffer.from(authKeyB64, "base64"))
    .digest("base64");

export const verifierMatches = (authKeyB64, stored) => {
  const a = Buffer.from(verifierFor(authKeyB64), "base64");
  const b = Buffer.from(String(stored), "base64");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const newPepper = () => crypto.randomBytes(32);

// AES-256-GCM under the server secret. Stored as base64(iv | tag | ciphertext).
export const sealPepper = (pepper) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subkey("vault-pepper"), iv);
  const ct = Buffer.concat([cipher.update(pepper), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
};

export const openPepper = (sealed) => {
  const buf = Buffer.from(sealed, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    subkey("vault-pepper"),
    buf.subarray(0, 12),
  );
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
};
