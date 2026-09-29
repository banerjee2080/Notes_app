import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

// Redis.fromEnv() throws at import time when the variables are absent, which
// would take the entire app down before a single route is reachable.
const hasCredentials = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

if (!hasCredentials) {
  console.warn("Upstash credentials missing - rate limiting is disabled.");
}

const redis = hasCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const createLimiter = (requests, prefix) =>
  redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, "60 s"),
        prefix,
        analytics: false,
      })
    : null;

// Normal traffic: 100 requests per minute, per IP.
export const globalLimiter = createLimiter(100, "rl:global");

// Login / signup: much tighter, 10 per minute, per IP.
export const authLimiter = createLimiter(10, "rl:auth");

export default globalLimiter;
