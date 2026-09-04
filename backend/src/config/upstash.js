import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

const redis = Redis.fromEnv();

// Normal traffic: 100 requests per minute, per IP.
export const globalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "60 s"),
  prefix: "rl:global",
  analytics: false,
});

// Login / signup: much tighter, 10 per minute, per IP.
export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "rl:auth",
  analytics: false,
});

export default globalLimiter;
