import express from "express";
import { addNote, delNote, getAllNotes, getNotesById, modifyNote } from "../controllers/note.controller.js";
import { ProtectedRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/",ProtectedRoute,getAllNotes);
router.get("/:id",ProtectedRoute,getNotesById);
router.post("/",ProtectedRoute,addNote);
router.put("/:id",ProtectedRoute,modifyNote); 
router.delete("/:id",ProtectedRoute,delNote); 

export default router;