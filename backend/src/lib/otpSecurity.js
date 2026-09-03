// backend/src/lib/otpSecurity.js
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

export const redis = Redis.fromEnv();

// ---------- tunable policy ----------
const OTP_TTL_SECONDS = 300; // code lives 5 minutes
const SEND_WINDOW_SECONDS = 60 * 60; // send quota window: 1 hour
const MAX_SENDS_PER_WINDOW = 3; // 3 emails per address per hour
const MAX_SENDS_PER_IP = 10; // 10 emails per IP per hour
const MAX_VERIFY_ATTEMPTS = 5; // 5 guesses per issued code
const TOKEN_TTL_SECONDS = 600; // verification receipt: 10 minutes

export const ALLOWED_PURPOSES = ["signup", "pin_setup"];

const TOKEN_SECRET = process.env.OTP_TOKEN_SECRET || process.env.JWT_SECRET;

// ---------- key helpers ----------
export const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const otpKey = (email, purpose) => `otp:code:${purpose}:${email}`;
const attemptsKey = (email, purpose) => `otp:attempts:${purpose}:${email}`;
const sendQuotaKey = (email, purpose) => `otp:sendq:${purpose}:${email}`;
const ipQuotaKey = (ip) => `otp:ipq:${ip}`;
const usedTokenKey = (jti) => `otp:usedtoken:${jti}`;

// ---------- primitives ----------
export const generateOtp = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

// ---------- generic fixed-window counter ----------
const consumeQuota = async (key, limit, windowSeconds) => {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);

  if (count > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
  }
  return { allowed: true, remaining: limit - count };
};

export const consumeSendQuota = (email, purpose) =>
  consumeQuota(
    sendQuotaKey(email, purpose),
    MAX_SENDS_PER_WINDOW,
    SEND_WINDOW_SECONDS,
  );

export const consumeIpQuota = (ip) =>
  consumeQuota(ipQuotaKey(ip), MAX_SENDS_PER_IP, SEND_WINDOW_SECONDS);

// ---------- store / check the code ----------
export const storeOtp = async (email, purpose, otp) => {
  await redis.set(otpKey(email, purpose), hashOtp(otp), {
    ex: OTP_TTL_SECONDS,
  });
  await redis.del(attemptsKey(email, purpose));
};

export const checkOtp = async (email, purpose, submittedOtp) => {
  const storedHash = await redis.get(otpKey(email, purpose));
  if (!storedHash) return { ok: false, reason: "expired" };

  const aKey = attemptsKey(email, purpose);
  const attempts = await redis.incr(aKey);
  if (attempts === 1) await redis.expire(aKey, OTP_TTL_SECONDS);

  if (attempts > MAX_VERIFY_ATTEMPTS) {
    await redis.del(otpKey(email, purpose));
    await redis.del(aKey);
    return { ok: false, reason: "too_many_attempts" };
  }

  const a = Buffer.from(String(storedHash), "utf8");
  const b = Buffer.from(hashOtp(submittedOtp), "utf8");
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    return {
      ok: false,
      reason: "invalid",
      attemptsLeft: MAX_VERIFY_ATTEMPTS - attempts,
    };
  }

  await redis.del(otpKey(email, purpose));
  await redis.del(aKey);
  return { ok: true };
};

// ---------- the verification receipt ----------
export const issueVerificationToken = (email, purpose) => {
  const jti = crypto.randomUUID();
  return jwt.sign({ email, purpose, jti }, TOKEN_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
    subject: "otp-verification",
  });
};

export const consumeVerificationToken = async (
  token,
  expectedEmail,
  expectedPurpose,
) => {
  if (!token || typeof token !== "string")
    return { ok: false, reason: "missing" };

  let payload;
  try {
    payload = jwt.verify(token, TOKEN_SECRET, { subject: "otp-verification" });
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (payload.email !== expectedEmail)
    return { ok: false, reason: "email_mismatch" };
  if (payload.purpose !== expectedPurpose)
    return { ok: false, reason: "purpose_mismatch" };

  const stored = await redis.set(usedTokenKey(payload.jti), "1", {
    ex: TOKEN_TTL_SECONDS + 60,
    nx: true,
  });
  if (stored === null) return { ok: false, reason: "already_used" };

  return { ok: true, payload };
};
