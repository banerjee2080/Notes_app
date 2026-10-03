import express from "express";
import {
  syncNotes,
  uploadImage,
  clearRecycleBin,
  upsertNote,
  getCollabToken,
  openNote,
  getSharing,
  shareNote,
  unshareNote,
  updateLinkSharing,
} from "../controllers/note.controller.js";
import {
  getEncState,
  getMemberKeys,
  enableEncryption,
  rotateNoteKey,
  saveSnapshot,
  savePreview,
  putMemberKeys,
} from "../controllers/encryption.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/sync", ProtectedRoute, syncNotes);
router.post("/uploadImage", ProtectedRoute, uploadImage);
router.delete("/clear-recycle-bin", ProtectedRoute, clearRecycleBin);
router.post("/upsert", ProtectedRoute, upsertNote);
router.get("/:id/collab-token", ProtectedRoute, getCollabToken);
router.post("/:id/open", ProtectedRoute, openNote);
router.get("/:id/sharing", ProtectedRoute, getSharing);
router.post("/:id/share", ProtectedRoute, shareNote);
router.delete("/:id/share/:userId", ProtectedRoute, unshareNote);
router.patch("/:id/link", ProtectedRoute, updateLinkSharing);

// End-to-end encryption (ciphertext and wrapped keys only)
router.get("/:id/enc", ProtectedRoute, getEncState);
router.get("/:id/enc/members", ProtectedRoute, getMemberKeys);
router.post("/:id/enc/enable", ProtectedRoute, enableEncryption);
router.post("/:id/enc/rotate", ProtectedRoute, rotateNoteKey);
router.put("/:id/enc/snapshot", ProtectedRoute, saveSnapshot);
router.put("/:id/enc/preview", ProtectedRoute, savePreview);
router.put("/:id/enc/keys", ProtectedRoute, putMemberKeys);

export default router;
