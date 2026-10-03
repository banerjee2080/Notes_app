import express from "express";
import {
  getVault,
  beginSetup,
  setupVault,
  unlockVault,
  resetVault,
} from "../controllers/vault.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/ratelimiter.middleware.js";

const router = express.Router();

router.get("/", ProtectedRoute, getVault);
router.post("/setup/begin", ProtectedRoute, beginSetup);
router.post("/setup", ProtectedRoute, setupVault);
// The per-account lockout is the real brake; the IP limiter is a second one.
router.post("/unlock", authRateLimiter, ProtectedRoute, unlockVault);
router.post("/reset", authRateLimiter, ProtectedRoute, resetVault);

export default router;
