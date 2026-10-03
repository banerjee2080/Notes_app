import express from "express";
import {
  syncNotes,
  uploadImage,
  clearRecycleBin,
  upsertNote,
  getCollabToken,
  getCollaborators,
  shareNote,
  unshareNote,
} from "../controllers/note.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sync", ProtectedRoute, syncNotes);
router.post("/uploadImage", ProtectedRoute, uploadImage);
router.delete("/clear-recycle-bin", ProtectedRoute, clearRecycleBin);
router.post("/upsert", ProtectedRoute, upsertNote);
router.get("/:id/collab-token", ProtectedRoute, getCollabToken);
router.get("/:id/collaborators", ProtectedRoute, getCollaborators);
router.post("/:id/share", ProtectedRoute, shareNote);
router.delete("/:id/share/:userId", ProtectedRoute, unshareNote);

export default router;
