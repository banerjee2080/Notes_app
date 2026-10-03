import Note from "../models/note.model.js";
import cloudinary from "../lib/cloudinary.js";
import { processHtmlImages } from "../lib/cloudinary.js";
import { sanitizeHtml } from "../lib/sanitize.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import NoteUpdate from "../models/noteUpdate.model.js";
import { getNoteRole, canManageSharing } from "../collab/noteAccess.js";
import { isB64 } from "../lib/vaultSecrets.js";

// A note in the shape the frontend stores in IndexedDB.
const toClientNote = (note, userId) => ({
  id: note._id,
  user_id: note.user_id,
  title: note.title,
  content: note.content,
  updated_at: note.updated_at.toISOString(),
  is_deleted: note.is_deleted,
  role: getNoteRole(note, userId), // "owner" | "admin" | "editor" | "viewer" for THIS user
  collaborator_ids: note.collaborators.map((c) => String(c.user)), // lets the client list shared notes
  // End-to-end encryption: the encrypted preview, plus THIS user's wrapped
  // copy of the note key, so the list can show titles once the PIN is entered.
  is_encrypted: !!note.is_encrypted,
  key_version: note.key_version ?? 0,
  enc_preview: note.is_encrypted ? (note.enc_preview ?? null) : null,
  enc_key: note.is_encrypted ? myWrappedKey(note, userId) : null,
});

function myWrappedKey(note, userId) {
  const k = (note.enc_keys ?? []).find(
    (e) => String(e.user) === String(userId) && e.v === note.key_version,
  );
  return k ? { v: k.v, epk: k.epk, iv: k.iv, ct: k.ct } : null;
}

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

    const serverChanges = serverChangesRaw.map((note) => toClientNote(note, userId));

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
    const ids = await Note.find({ user_id: userId, is_deleted: true }).distinct("_id");
    await Note.deleteMany({ _id: { $in: ids } });
    await NoteUpdate.deleteMany({ note: { $in: ids } }); // encrypted update logs
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


const INVITE_ROLES = ["admin", "editor", "viewer"]; // roles the owner/an admin can hand out
const LINK_ACCESS = ["restricted", "anyone"];
const LINK_ROLES = ["editor", "viewer"]; // a link never grants admin

const isValidNoteId = (
  id, // same rule your sync code uses
) => typeof id === "string" && id.length > 0 && id.length <= 64;

const ACCESS_FIELDS = "user_id collaborators is_deleted link_access link_role";

// The caller's role on a note. If they have none but the link is set to
// "anyone", opening it adds them (marked via_link) with the link's role, the
// way a Google Docs link puts the file in "Shared with me".
const resolveRole = async (note, userId) => {
  const role = getNoteRole(note, userId);
  if (role || note.link_access !== "anyone") return role;
  await Note.updateOne(
    { _id: note._id, "collaborators.user": { $ne: userId } }, // no duplicate on a double open
    {
      $push: {
        collaborators: { user: userId, role: note.link_role, via_link: true },
      },
    },
  ); // bumps updatedAt → the note arrives with their next /sync
  const fresh = await Note.findById(note._id).select("user_id collaborators").lean();
  return getNoteRole(fresh, userId);
};

const person = (user) => ({
  _id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  profilePic: user.profilePic || "",
});

// What the share dialog shows. Only the owner and admins get the people list
// (names and emails); everyone else just sees how the link is set up.
const sharingState = async (noteId, role) => {
  const note = await Note.findById(noteId)
    .select("user_id collaborators link_access link_role is_encrypted key_version needs_rotation")
    .populate("user_id", "fullName email profilePic")
    .populate("collaborators.user", "fullName email profilePic")
    .lean();
  const link = {
    access: note?.link_access ?? "restricted",
    role: note?.link_role ?? "viewer",
  };
  const encryption = {
    encrypted: !!note?.is_encrypted,
    keyVersion: note?.key_version ?? 0,
    needsRotation: !!note?.needs_rotation,
  };
  if (!note || !canManageSharing(role)) return { role, canManage: false, link, encryption };
  return {
    role,
    canManage: true,
    link,
    encryption,
    owner: note.user_id ? person(note.user_id) : null,
    collaborators: note.collaborators
      .filter((c) => c.user) // skip entries whose user account was deleted
      .map((c) => ({ ...person(c.user), role: c.role, viaLink: !!c.via_link })),
  };
};

// GET /api/notes/:id/collab-token → { token, role }
export const getCollabToken = async (req, res) => {
  try {
    if (!isValidNoteId(req.params.id)) {
      // reject garbage ids early
      return res.status(400).json({ message: "Invalid note id" });
    }
    const note = await Note.findById(req.params.id) // load the note
      .select(ACCESS_FIELDS) // just what the access check needs
      .lean();
    const role =
      note && !note.is_deleted ? await resolveRole(note, req.user._id) : null; // owner / admin / editor / viewer / null
    if (!role) {
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

// POST /api/notes/:id/open → { note }
// For a note that isn't on this device yet (opened from a shared link, or
// shared moments ago and not synced): checks access, joining via the link if
// it allows, and returns the note so the page can open it straight away.
export const openNote = async (req, res) => {
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    const note = await Note.findById(req.params.id).select(ACCESS_FIELDS).lean();
    const role =
      note && !note.is_deleted ? await resolveRole(note, req.user._id) : null;
    if (!role) {
      return res.status(404).json({ message: "Note not found" });
    }
    const full = await Note.findById(note._id).lean();
    res.status(200).json({ note: toClientNote(full, req.user._id) });
  } catch (error) {
    console.error("Open note error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/notes/:id/sharing → sharingState (anyone with access may look)
export const getSharing = async (req, res) => {
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    const note = await Note.findById(req.params.id)
      .select("user_id collaborators")
      .lean();
    const role = getNoteRole(note, req.user._id);
    if (!role) {
      // must be owner or collaborator
      return res.status(404).json({ message: "Note not found" });
    }
    res.status(200).json(await sharingState(note._id, role));
  } catch (error) {
    console.error("Get sharing error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/notes/:id/share  body: { email, role } → sharingState (owner/admin)
// Also how an existing collaborator's role gets changed.
export const shareNote = async (req, res) => {
  const { email, role = "editor", key } = req.body ?? {}; // role defaults to editor; {} when no JSON body was sent
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    if (typeof email !== "string" || !INVITE_ROLES.includes(role)) {
      // validate input
      return res
        .status(400)
        .json({ message: "Email and a valid role are required" });
    }
    const note = await Note.findById(req.params.id).select(
      "user_id collaborators is_encrypted key_version enc_keys",
    ); // NOT lean: we'll .save() it
    const myRole = getNoteRole(note, req.user._id);
    if (!myRole) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (!canManageSharing(myRole)) {
      return res
        .status(403)
        .json({ message: "Only the owner or an admin can share this note" });
    }
    const target = await User.findOne({ email: email.trim() }) // find the person (same matching as your login)
      .select("_id +vault")
      .lean();
    if (!target) {
      return res.status(404).json({ message: "No user with that email" });
    }
    if (String(target._id) === String(note.user_id)) {
      return res.status(400).json({ message: "They own this note" });
    }
    const existing = note.collaborators.find(
      // already shared with them?
      (c) => String(c.user) === String(target._id),
    );
    // Encrypted note + new person: they need the note key wrapped for their
    // public key. Only a browser holding the key can do that, so the first call
    // answers 409 with their public key and the browser retries with `key`.
    if (note.is_encrypted && !existing) {
      if (!target.vault?.publicKey) {
        return res.status(400).json({
          message: "They need to set up a notes PIN before joining an encrypted note",
        });
      }
      if (!key || key.v !== note.key_version) {
        return res.status(409).json({
          code: "NEEDS_KEY",
          message: "Encrypted note: wrap the key for this person",
          userId: String(target._id),
          publicKey: target.vault.publicKey,
          keyVersion: note.key_version,
        });
      }
      if (!isB64(key.epk, 80, 100) || !isB64(key.iv, 16, 16) || !isB64(key.ct, 40, 100)) {
        return res.status(400).json({ message: "Invalid key" });
      }
      note.enc_keys = [
        ...note.enc_keys.filter((k) => String(k.user) !== String(target._id)),
        { user: target._id, v: key.v, epk: key.epk, iv: key.iv, ct: key.ct },
      ];
    }
    if (existing) {
      existing.role = role; // yes → just change the role
      existing.via_link = false; // now on the list in their own right
    } else note.collaborators.push({ user: target._id, role }); // no → add them
    await note.save(); // also bumps updatedAt → their next /sync pulls the note
    res.status(200).json(await sharingState(note._id, myRole));
  } catch (error) {
    console.error("Share note error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// DELETE /api/notes/:id/share/:userId → sharingState, or { left: true }
// The owner or an admin can remove anyone; a collaborator can remove
// themselves ("leave note"). The owner is never in the list, so can't be removed.
export const unshareNote = async (req, res) => {
  const { id, userId } = req.params; // note id and the user being removed
  try {
    if (!isValidNoteId(id) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const note = await Note.findById(id).select("user_id collaborators is_encrypted").lean();
    const myRole = getNoteRole(note, req.user._id);
    const isSelf = String(userId) === String(req.user._id); // caller is removing themselves?
    if (!myRole || (!canManageSharing(myRole) && !isSelf)) {
      return res.status(404).json({ message: "Note not found" });
    }
    await Note.updateOne(
      { _id: id },
      note.is_encrypted
        ? {
            // They may still hold the key, so it gets replaced (needs_rotation).
            $pull: { collaborators: { user: userId }, enc_keys: { user: userId } },
            $set: { needs_rotation: true },
          }
        : { $pull: { collaborators: { user: userId } } }, // remove matching entries from the array
    );
    if (isSelf) return res.status(200).json({ left: true });
    res.status(200).json(await sharingState(id, myRole));
  } catch (error) {
    console.error("Unshare note error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// PATCH /api/notes/:id/link  body: { access, role } → sharingState (owner/admin)
export const updateLinkSharing = async (req, res) => {
  const { access, role } = req.body ?? {};
  try {
    if (!isValidNoteId(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }
    if (!LINK_ACCESS.includes(access) || !LINK_ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid link settings" });
    }
    const note = await Note.findById(req.params.id)
      .select("user_id collaborators is_encrypted")
      .lean();
    const myRole = getNoteRole(note, req.user._id);
    if (!myRole) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (!canManageSharing(myRole)) {
      return res
        .status(403)
        .json({ message: "Only the owner or an admin can change the link" });
    }
    const linkUsers = note.collaborators.filter((c) => c.via_link).map((c) => c.user);
    if (access === "restricted") {
      // Turning the link off also removes everyone who only had it via the link.
      await Note.updateOne(
        { _id: note._id },
        {
          $set: {
            link_access: access,
            link_role: role,
            // Link joiners of an encrypted note hold the key: replace it.
            ...(note.is_encrypted && linkUsers.length ? { needs_rotation: true } : {}),
          },
          $pull: {
            collaborators: { via_link: true },
            ...(note.is_encrypted ? { enc_keys: { user: { $in: linkUsers } } } : {}),
          },
        },
      );
    } else {
      // People who joined via the link follow its role.
      await Note.updateOne(
        { _id: note._id },
        {
          $set: {
            link_access: access,
            link_role: role,
            "collaborators.$[v].role": role,
          },
        },
        { arrayFilters: [{ "v.via_link": true }] },
      );
    }
    res.status(200).json(await sharingState(note._id, myRole));
  } catch (error) {
    console.error("Update link sharing error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
