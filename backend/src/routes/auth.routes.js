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

const authRouter = express.Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.put("/updateProfile", ProtectedRoute, updateProfile);
authRouter.put("/setBackgroundImg", ProtectedRoute, setBackgroundImg);
authRouter.get("/check", ProtectedRoute, checkAuth);
authRouter.post("/send-mail", sendMail);
authRouter.post("/google", googleAuth);

export default authRouter;
