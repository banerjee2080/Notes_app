import express from "express";
import {
  checkAuth,
  login,
  logout,
  signup,
  updateProfile,
  sendMail,
  setBackgroundImg,
  googleAuth,
} from "../controllers/auth.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";
import { authRateLimiter } from "../middleware/ratelimiter.middleware.js";

const authRouter = express.Router();

authRouter.post("/signup", authRateLimiter, signup);
authRouter.post("/login", authRateLimiter, login);
authRouter.post("/google", authRateLimiter, googleAuth);
authRouter.post("/logout", logout);
authRouter.put("/updateProfile", ProtectedRoute, updateProfile);
authRouter.put("/setBackgroundImg", ProtectedRoute, setBackgroundImg);
authRouter.get("/check", ProtectedRoute, checkAuth);

export default authRouter;
