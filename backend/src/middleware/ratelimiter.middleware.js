import ratelimit from "../config/upstash.js"

const rateLimiter = async (req, res, next) => {
    const { success } = await ratelimit.limit("my-rate-limit");
    if (!success) {
        return res.status(429).json({ message: "Too Many Requests" });
    }
    next();
}

export default rateLimiter