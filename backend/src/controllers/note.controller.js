import Note from "../models/note.model.js";
import cloudinary from "../lib/cloudinary.js";
import { processHtmlImages } from "../lib/cloudinary.js";
import { sanitizeHtml } from "../lib/sanitize.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import { getNoteRole } from "../collab/noteAccess.js";

export const syncNotes = async (req, res) => {
  const userId = req.user._id;
  const { lastSyncedAt, localChanges } = req.body;

  try {
    if (Array.isArray(localChanges) && localChanges.length > 0) {
      const ids = [];
      for (const localNote of localChanges) {
        if (
          !localNote ||
          typeof localNote.id !== "string" ||
          localNote.id.length === 0 ||
          localNote.id.length > 64
        ) {
          return res.status(400).json({ message: "Invalid note id" });
        }
        if (isNaN(new Date(localNote.updated_at).getTime())) {
          return res.status(400).json({ message: "Invalid updated_at" });
        }
        ids.push(localNote.id);
      }

      const existingNotes = await Note.find({ _id: { $in: ids } })
        .select("_id user_id updated_at is_collaborative")      // + is_collaborative
        .lean();

      const foreign = existingNotes.find(
        (n) => String(n.user_id) !== String(userId),
      );
      if (foreign) {
        return res
          .status(403)
          .json({ message: "One or more notes do not belong to you" });
      }

      const serverById = new Map(existingNotes.map((n) => [n._id, n]));

      for (const localNote of localChanges) {
        const safeContent = await sanitizeHtml(localNote.content);
        const cleanContent = await processHtmlImages(safeContent);
        const serverNote = serverById.get(localNote.id);

        if (!serverNote) {
          await Note.create({
            _id: localNote.id,
            user_id: userId,
            title: localNote.title,
            content: cleanContent,
            updated_at: new Date(localNote.updated_at),
            is_deleted: localNote.is_deleted,
          });
        } else {
          const localTime = new Date(localNote.updated_at).getTime();
          const serverTime = new Date(serverNote.updated_at).getTime();

          if (localTime > serverTime) {                           // client copy is newer by timestamp
            const changes = serverNote.is_collaborative           // is this note managed by Yjs?
              ? {                                                 // yes → only accept delete/restore
                  is_deleted: localNote.is_deleted,
                  updated_at: new Date(localNote.updated_at),
                }
              : {                                                 // no → old behaviour, full overwrite
                  title: localNote.title,
                  content: cleanContent,
                  updated_at: new Date(localNote.updated_at),
                  is_deleted: localNote.is_deleted,
                };
            await Note.updateOne({ _id: localNote.id, user_id: userId }, { $set: changes });
          }
        }
      }
    }

    const query = {                                               // notes I own OR notes shared with me
      $or: [{ user_id: userId }, { "collaborators.user": userId }],
    };

    if (lastSyncedAt) {
      query.updatedAt = { $gt: new Date(lastSyncedAt) };          // unchanged: only things newer than last sync
    }

    const serverChangesRaw = await Note.find(query);

    const serverChanges = serverChangesRaw.map((note) => ({
      id: note._id,
      user_id: note.user_id,
      title: note.title,
      content: note.content,
      updated_at: note.updated_at.toISOString(),
      is_deleted: note.is_deleted,
      role: getNoteRole(note, userId),                            // "owner" | "editor" | "viewer" for THIS user
      collaborator_ids: note.collaborators.map((c) => String(c.user)), // lets the client list shared notes
    }));

    res.status(200).json({
      serverChanges,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(403).json({ message: "Note does not belong to you" });
    }
    console.error("Error in background sync upsert:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const uploadImage = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: "Image is required" });
    }
    const uploadedImg = await cloudinary.uploader.upload(image);
    res.status(200).json({ secure_url: uploadedImg.secure_url });
  } catch (error) {
    console.error("Upload Image Error:", error);
    res.status(500).json({ message: "Image upload failed" });
  }
};

export const clearRecycleBin = async (req, res) => {
  const userId = req.user._id;
  try {
    await Note.deleteMany({ user_id: userId, is_deleted: true });
    res.status(200).json({ message: "Recycle bin cleared successfully" });
  } catch (error) {
    console.error("Clear Recycle Bin Error:", error);
    res.status(500).json({ message: "Failed to clear recycle bin" });
  }
};

export const upsertNote = async (req, res) => {
  const { id, title, content, updated_at, is_deleted } = req.body;
  const user_id = req.user._id;

  try {
    if (typeof id !== "string" || id.length === 0 || id.length > 64) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    if (isNaN(new Date(updated_at).getTime())) {
      return res.status(400).json({ message: "Invalid updated_at" });
    }

    // Reject writes to a note owned by someone else. findOneAndUpdate with
    // upsert:true and a user_id in the filter would otherwise silently CREATE
    // a second document with the same _id on an ownership mismatch, which
    // surfaces as a confusing 11000 rather than a 403.
    const existing = await Note.findById(id)
      .select("user_id is_collaborative")
      .lean();
    if (existing && String(existing.user_id) !== String(user_id)) {
      return res.status(403).json({ message: "Note does not belong to you" });
    }

    if (existing?.is_collaborative) {                             // Yjs owns this note's text
      const note = await Note.findOneAndUpdate(
        { _id: id, user_id },
        { $set: { is_deleted, updated_at: new Date(updated_at) } }, // only accept delete/restore
        { new: true },
      );
      return res.status(200).json(note);
    }

    // This was missing entirely: /notes/upsert is the path CreatePage takes
    // for every new note, so it was an unsanitized write straight to the DB.
    const safeContent = await sanitizeHtml(content);
    const cleanContent = await processHtmlImages(safeContent);

    const note = await Note.findOneAndUpdate(
      { _id: id, user_id: user_id },
      {
        $set: {
          title,
          content: cleanContent,
          updated_at: new Date(updated_at),
          is_deleted,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );

    res.status(200).json(note);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(403).json({ message: "Note does not belong to you" });
    }
    console.error("Error in background sync upsert:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

const NOTE_ROLES = ["editor", "viewer"]; // roles an owner can hand out

const isValidNoteId = (
  id, // same rule your sync code uses
) => typeof id === "string" && id.length > 0 && id.length <= 64;

// Returns [{ _id, fullName, email, role }] for a note's collaborators.
const collaboratorList = async (noteId) => {
  const note = await Note.findById(noteId) // load the note
    .select("collaborators") // only the list
    .populate("collaborators.user", "fullName email") // replace each user id with { _id, fullName, email }
    .lean(); // plain objects
  return (note?.collaborators ?? []) // empty list if none
    .filter((c) => c.user) // skip entries whose user account was deleted
    .map((c) => ({
      // shape for the frontend
      _id: String(c.user._id),
      fullName: c.user.fullName,
      email: c.user.email,
      role: c.role,
    }));
};

// GET /api/notes/:id/collab-token → { token, role }
export const getCollabToken = async (req, res) => {
  try {
    if (!isValidNoteId(req.params.id)) {
      // reject garbage ids early
      return res.status(400).json({ message: "Invalid note id" });
    }
    const note = await Note.findById(req.params.id) // load the note
      .select("user_id collaborators is_deleted") // just what the access check needs
      .lean();
    const role = getNoteRole(note, req.user._id); // owner / editor / viewer / null
    if (!role || note.is_deleted) {
      // no access → 404 (doesn't reveal the note exists)
      return res.status(404).json({ message: "Note not found" });
    }
    const token = jwt.sign(
      // create the ticket
      { userId: String(req.user._id), noteId: note._id, role }, // what's inside it
      process.env.COLLAB_TOKEN_SECRET, // signed with the collab-only secret
      { expiresIn: "5m" }, // short-lived: only needed to open the socket
    );
    res.status(200).json({ token, role }); // the browser hands this to Hocuspocus
  } catch (error) {
    console.error("Collab token error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/notes/:id/collaborators → { collaborators } (anyone with access may look)
export const getCollaborators = async (req, res) => {
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    const note = await Note.findById(req.params.id)
      .select("user_id collaborators")
      .lean();
    if (!getNoteRole(note, req.user._id)) {
      // must be owner or collaborator
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json({ collaborators: await collaboratorList(note._id) });
  } catch (error) {
    console.error("Get collaborators error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/notes/:id/share  body: { email, role } → { collaborators } (owner only)
export const shareNote = async (req, res) => {
  const { email, role = "editor" } = req.body ?? {}; // role defaults to editor; {} when no JSON body was sent
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    if (typeof email !== "string" || !NOTE_ROLES.includes(role)) {
      // validate input
      return res
        .status(400)
        .json({ message: "Email and a valid role are required" });
    }
    const note = await Note.findById(req.params.id).select(
      "user_id collaborators",
    ); // NOT lean: we'll .save() it
    if (!note || String(note.user_id) !== String(req.user._id)) {
      // only the owner can share
      return res.status(404).json({ message: "Note not found" });
    }
    const target = await User.findOne({ email: email.trim() }) // find the person (same matching as your login)
      .select("_id")
      .lean();
    if (!target) {
      return res.status(404).json({ message: "No user with that email" });
    }
    if (String(target._id) === String(req.user._id)) {
      // can't share with yourself
      return res.status(400).json({ message: "You already own this note" });
    }
    const existing = note.collaborators.find(
      // already shared with them?
      (c) => String(c.user) === String(target._id),
    );
    if (existing)
      existing.role = role; // yes → just change the role
    else note.collaborators.push({ user: target._id, role }); // no → add them
    await note.save(); // also bumps updatedAt → their next /sync pulls the note
    res.status(200).json({ collaborators: await collaboratorList(note._id) });
  } catch (error) {
    console.error("Share note error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// DELETE /api/notes/:id/share/:userId → { collaborators }
// The owner can remove anyone; a collaborator can remove themselves ("leave note").
export const unshareNote = async (req, res) => {
  const { id, userId } = req.params; // note id and the user being removed
  try {
    if (!isValidNoteId(id) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const note = await Note.findById(id).select("user_id").lean();
    const isOwner = note && String(note.user_id) === String(req.user._id); // caller is owner?
    const isSelf = String(userId) === String(req.user._id); // caller is removing themselves?
    if (!note || (!isOwner && !isSelf)) {
      // anyone else → not allowed
      return res.status(404).json({ message: "Note not found" });
    }
    await Note.updateOne(
      { _id: id },
      { $pull: { collaborators: { user: userId } } }, // remove matching entries from the array
    );
    res.status(200).json({ collaborators: await collaboratorList(id) });
  } catch (error) {
    console.error("Unshare note error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
