import express from "express";
import {
  syncNotes,
  uploadImage,
  clearRecycleBin,
  upsertNote,
} from "../controllers/note.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sync", ProtectedRoute, syncNotes);
router.post("/uploadImage", ProtectedRoute, uploadImage);
router.delete("/clear-recycle-bin", ProtectedRoute, clearRecycleBin);
router.post("/upsert", ProtectedRoute, upsertNote);

export default router;
