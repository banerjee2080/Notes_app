import express from "express";
import { syncNotes, uploadImage } from "../controllers/note.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sync", ProtectedRoute, syncNotes);
router.post("/uploadImage", ProtectedRoute, uploadImage);

export default router;
