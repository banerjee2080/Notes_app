import crypto from "crypto";
import { redis } from "../config/upstash.js";

// Revoked session JWTs live in Redis, keyed by the token's jti, with a TTL equal
// to the token's remaining lifetime. Once the JWT would have expired anyway the
// key disappears on its own - no cleanup job, no Mongo collection.
const PREFIX = "jwt:revoked:";

// Tokens issued before jti was added have no id, so fall back to a hash of the
// token. The raw token is never stored.
const revocationId = (token, payload) =>
  payload?.jti ?? crypto.createHash("sha256").update(token).digest("hex");

const keyFor = (token, payload) => PREFIX + revocationId(token, payload);

export const isBlacklistEnabled = Boolean(redis);

export const revokeToken = async (token, payload) => {
  if (!redis || !payload?.exp) return;
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return; // already expired, nothing to revoke
  await redis.set(keyFor(token, payload), "1", { ex: ttl });
};

export const isTokenRevoked = async (token, payload) => {
  if (!redis) return false;
  return (await redis.exists(keyFor(token, payload))) === 1;
};
