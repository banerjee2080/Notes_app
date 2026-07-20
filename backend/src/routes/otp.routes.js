import express from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";

const router = express.Router();

router.post("/", sendOtp);
router.post("/verify", verifyOtp);

export default router;
