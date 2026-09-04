import { globalLimiter, authLimiter } from "../config/upstash.js";

const getClientKey = (req) => req.ip || "unknown";

const makeRateLimiter = (limiter) => async (req, res, next) => {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(
      getClientKey(req),
    );

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining));

    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        message: "Too Many Requests",
        retryAfterSeconds: retryAfter,
      });
    }

    next();
  } catch (error) {
    console.error(
      "Rate limiter bypassed (Upstash unreachable):",
      error.message,
    );
    next();
  }
};

export const globalRateLimiter = makeRateLimiter(globalLimiter);
export const authRateLimiter = makeRateLimiter(authLimiter);

export default globalRateLimiter;
