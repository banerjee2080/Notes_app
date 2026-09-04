import express from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";
import { authRateLimiter } from "../middleware/ratelimiter.middleware.js";

const router = express.Router();

router.post("/", authRateLimiter, sendOtp);
router.post("/verify", authRateLimiter, verifyOtp);

export default router;
