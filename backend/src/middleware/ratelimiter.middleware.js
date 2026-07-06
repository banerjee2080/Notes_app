import ratelimit from "../config/upstash.js"

const rateLimiter = async (req, res, next) => {
    try {
        const { success } = await ratelimit.limit("my-rate-limit");
        if (!success) {
            return res.status(429).json({ message: "Too Many Requests" });
        }
        next();
    } catch (error) {
        // Fail open: if Upstash is unreachable (e.g., offline), allow the request to proceed
        console.error("Rate limiter bypassed due to error (offline?):", error.message);
        next();
    }
}

export default rateLimiter