import express from "express";
import {
  checkAuth,
  login,
  logout,
  signup,
  updateProfile,
  sendMail,
} from "../controllers/auth.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const authRouter = express.Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.get("/logout", logout);
authRouter.put("/updateProfile", ProtectedRoute, updateProfile);
authRouter.get("/check", ProtectedRoute, checkAuth);
authRouter.post("/send-mail", sendMail);

export default authRouter;
