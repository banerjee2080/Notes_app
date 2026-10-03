// REST side of end-to-end encrypted notes. Everything here moves ciphertext
// and wrapped keys around; nothing here can read a note. The live part
// (pushing/relaying encrypted Yjs updates) is in backend/collab.js.
import mongoose from "mongoose";
import Note from "../models/note.model.js";
import NoteUpdate from "../models/noteUpdate.model.js";
import User from "../models/user.model.js";
import { getNoteRole, canManageSharing } from "../collab/noteAccess.js";
import { isB64 } from "../lib/vaultSecrets.js";

const SNAPSHOT_MAX = 12_000_000; // base64 chars; stays under MongoDB's 16 MB document cap
const PREVIEW_MAX = 20_000;

const isValidNoteId = (id) => typeof id === "string" && id.length > 0 && id.length <= 64;

const validBlob = (b, max) => !!b && isB64(b.iv, 16, 16) && isB64(b.ct, 16, max);

const validWrappedKey = (k) =>
  !!k &&
  mongoose.isValidObjectId(k.user) &&
  isB64(k.epk, 80, 100) &&
  isB64(k.iv, 16, 16) &&
  isB64(k.ct, 40, 100);

const memberIds = (note) => [
  String(note.user_id),
  ...note.collaborators.map((c) => String(c.user)),
];

// keys: at most one valid entry per member, nobody else, and one for every
// member who has a PIN (a member who reset theirs gets one later, see putMemberKeys).
const keysCoverMembers = async (keys, note) => {
  if (!Array.isArray(keys) || !keys.every(validWrappedKey)) return false;
  const given = new Set(keys.map((k) => String(k.user)));
  const members = memberIds(note);
  if (given.size !== keys.length || ![...given].every((u) => members.includes(u))) return false;
  const keyable = await User.find({
    _id: { $in: members },
    "vault.publicKey": { $exists: true },
  }).distinct("_id");
  return keyable.every((id) => given.has(String(id)));
};

const toKeyEntries = (keys, v) =>
  keys.map((k) => ({ user: k.user, v, epk: k.epk, iv: k.iv, ct: k.ct }));

// Loads the note and the caller's role, or answers 400/404 and returns null.
const loadForMember = async (req, res, fields) => {
  if (!isValidNoteId(req.params.id)) {
    res.status(400).json({ message: "Invalid note id" });
    return null;
  }
  const note = await Note.findById(req.params.id).select(`user_id collaborators is_deleted ${fields}`).lean();
  const role = getNoteRole(note, req.user._id);
  if (!role || note.is_deleted) {
    res.status(404).json({ message: "Note not found" });
    return null;
  }
  return { note, role };
};

const denyUnless = (res, ok, message) => {
  if (!ok) res.status(403).json({ message });
  return !ok;
};

// GET /api/notes/:id/enc?since=N
// Everything a member needs to rebuild the note: their wrapped key, the
// snapshot (if they're behind it) and the updates after it.
export const getEncState = async (req, res) => {
  try {
    const loaded = await loadForMember(
      req,
      res,
      "is_encrypted key_version enc_seq enc_keys needs_rotation +enc_snapshot",
    );
    if (!loaded) return;
    const { note, role } = loaded;
    if (!note.is_encrypted) return res.status(400).json({ message: "Note is not encrypted" });

    const since = Math.max(0, Number.parseInt(req.query.since, 10) || 0);
    const snap = note.enc_snapshot;
    const sendSnapshot = !!snap && (since === 0 || since < snap.upto);
    const from = sendSnapshot ? snap.upto : since;
    const updates = await NoteUpdate.find({
      note: note._id,
      seq: { $gt: from },
      v: note.key_version,
    })
      .sort({ seq: 1 })
      .select("-_id seq v iv ct")
      .lean();

    const me = String(req.user._id);
    const current = note.enc_keys.filter((k) => k.v === note.key_version);
    const mine = current.find((k) => String(k.user) === me);
    const manager = canManageSharing(role);
    const keyed = new Set(current.map((k) => String(k.user)));

    res.status(200).json({
      role,
      keyVersion: note.key_version,
      seq: note.enc_seq,
      snapshot: sendSnapshot ? { v: snap.v, iv: snap.iv, ct: snap.ct, upto: snap.upto } : null,
      snapshotUpto: snap?.upto ?? 0,
      updates,
      myKey: mine ? { v: mine.v, epk: mine.epk, iv: mine.iv, ct: mine.ct } : null,
      // Housekeeping only an owner/admin can do (see frontend lib/noteKeys.ts).
      needsRotation: manager ? !!note.needs_rotation : false,
      missingKeys: manager ? memberIds(note).filter((m) => !keyed.has(m)).length : 0,
    });
  } catch (error) {
    console.error("Get encrypted state error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/notes/:id/enc/members → { members: [{ _id, fullName, publicKey|null, hasKey }] }
// Public keys to wrap a note key for. Owner/admin only.
export const getMemberKeys = async (req, res) => {
  try {
    const loaded = await loadForMember(req, res, "enc_keys key_version");
    if (!loaded) return;
    const { note, role } = loaded;
    if (denyUnless(res, canManageSharing(role), "Only the owner or an admin can do this")) return;
    const users = await User.find({ _id: { $in: memberIds(note) } })
      .select("fullName +vault")
      .lean();
    const keyed = new Set(
      (note.enc_keys ?? []).filter((k) => k.v === note.key_version).map((k) => String(k.user)),
    );
    res.status(200).json({
      members: users.map((u) => ({
        _id: String(u._id),
        fullName: u.fullName,
        publicKey: u.vault?.publicKey ?? null,
        hasKey: keyed.has(String(u._id)), // holds the current note key
      })),
    });
  } catch (error) {
    console.error("Get member keys error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/notes/:id/enc/enable  body: { snapshot, preview, keys }
// Turns a normal note into an encrypted one. The browser already encrypted
// the current content; the server drops every plaintext copy it holds.
export const enableEncryption = async (req, res) => {
  const { snapshot, preview, keys } = req.body ?? {};
  try {
    const loaded = await loadForMember(req, res, "is_encrypted");
    if (!loaded) return;
    const { note, role } = loaded;
    if (denyUnless(res, canManageSharing(role), "Only the owner or an admin can encrypt this note")) return;
    if (note.is_encrypted) return res.status(409).json({ message: "Already encrypted" });
    if (!validBlob(snapshot, SNAPSHOT_MAX) || !validBlob(preview, PREVIEW_MAX)) {
      return res.status(400).json({ message: "Invalid encrypted data" });
    }
    if (!(await keysCoverMembers(keys, note))) {
      return res.status(400).json({ message: "Every member needs a key - reload and try again" });
    }
    const updated = await Note.findOneAndUpdate(
      { _id: note._id, is_encrypted: { $ne: true } },
      {
        $set: {
          is_encrypted: true,
          is_collaborative: true, // /sync and /upsert then only accept delete/restore
          key_version: 1,
          enc_seq: 0,
          enc_snapshot: { v: 1, iv: snapshot.iv, ct: snapshot.ct, upto: 0 },
          enc_preview: { v: 1, iv: preview.iv, ct: preview.ct },
          enc_keys: toKeyEntries(keys, 1),
          needs_rotation: false,
          title: "",
          content: "",
          updated_at: new Date(),
        },
        $unset: { ydoc: 1 },
      },
      { new: true },
    );
    if (!updated) return res.status(409).json({ message: "Already encrypted" });
    await NoteUpdate.deleteMany({ note: note._id });
    res.status(200).json({ keyVersion: 1 });
  } catch (error) {
    console.error("Enable encryption error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// POST /api/notes/:id/enc/rotate  body: { fromVersion, snapshot, preview, keys }
// Replaces the note key after someone lost access: new key, content
// re-encrypted under it, wrapped only for the people still on the note.
export const rotateNoteKey = async (req, res) => {
  const { fromVersion, snapshot, preview, keys } = req.body ?? {};
  try {
    const loaded = await loadForMember(req, res, "is_encrypted key_version enc_seq");
    if (!loaded) return;
    const { note, role } = loaded;
    if (denyUnless(res, canManageSharing(role), "Only the owner or an admin can do this")) return;
    if (!note.is_encrypted) return res.status(400).json({ message: "Note is not encrypted" });
    if (fromVersion !== note.key_version) {
      return res.status(409).json({ message: "The key changed meanwhile - reload" });
    }
    if (!validBlob(snapshot, SNAPSHOT_MAX) || (preview && !validBlob(preview, PREVIEW_MAX))) {
      return res.status(400).json({ message: "Invalid encrypted data" });
    }
    if (!(await keysCoverMembers(keys, note))) {
      return res.status(400).json({ message: "Members changed meanwhile - try again" });
    }
    const v = fromVersion + 1;
    const set = {
      key_version: v,
      enc_snapshot: { v, iv: snapshot.iv, ct: snapshot.ct, upto: note.enc_seq },
      enc_keys: toKeyEntries(keys, v),
      needs_rotation: false,
      updated_at: new Date(),
    };
    if (preview) set.enc_preview = { v, iv: preview.iv, ct: preview.ct };
    const result = await Note.updateOne(
      { _id: note._id, is_encrypted: true, key_version: fromVersion },
      { $set: set },
    );
    if (result.modifiedCount === 0) {
      return res.status(409).json({ message: "The key changed meanwhile - reload" });
    }
    // Old-key updates are inside the new snapshot (or get re-sent by their
    // authors, whose clients notice the key change).
    await NoteUpdate.deleteMany({ note: note._id, v: { $lt: v } });
    res.status(200).json({ keyVersion: v });
  } catch (error) {
    console.error("Rotate note key error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// PUT /api/notes/:id/enc/snapshot  body: { v, iv, ct, upto }
// Compaction: a client folds snapshot + updates (<= upto) into one blob.
export const saveSnapshot = async (req, res) => {
  const { v, iv, ct, upto } = req.body ?? {};
  try {
    const loaded = await loadForMember(req, res, "is_encrypted");
    if (!loaded) return;
    if (denyUnless(res, loaded.role !== "viewer", "Viewers can't change this note")) return;
    if (!Number.isInteger(v) || !Number.isInteger(upto) || upto < 1 || !validBlob({ iv, ct }, SNAPSHOT_MAX)) {
      return res.status(400).json({ message: "Invalid snapshot" });
    }
    const result = await Note.updateOne(
      {
        _id: loaded.note._id,
        is_encrypted: true,
        key_version: v,
        enc_seq: { $gte: upto },
        $or: [{ enc_snapshot: null }, { "enc_snapshot.upto": { $lt: upto } }],
      },
      { $set: { enc_snapshot: { v, iv, ct, upto } } },
    );
    if (result.modifiedCount === 0) return res.status(200).json({ saved: false });
    await NoteUpdate.deleteMany({ note: loaded.note._id, seq: { $lte: upto } });
    res.status(200).json({ saved: true });
  } catch (error) {
    console.error("Save snapshot error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// PUT /api/notes/:id/enc/preview  body: { v, iv, ct }
export const savePreview = async (req, res) => {
  const { v, iv, ct } = req.body ?? {};
  try {
    const loaded = await loadForMember(req, res, "is_encrypted");
    if (!loaded) return;
    if (denyUnless(res, loaded.role !== "viewer", "Viewers can't change this note")) return;
    if (!Number.isInteger(v) || !validBlob({ iv, ct }, PREVIEW_MAX)) {
      return res.status(400).json({ message: "Invalid preview" });
    }
    // updated_at moves so other members' /sync picks up the new title.
    await Note.updateOne(
      { _id: loaded.note._id, is_encrypted: true, key_version: v },
      { $set: { enc_preview: { v, iv, ct }, updated_at: new Date() } },
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Save preview error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// PUT /api/notes/:id/enc/keys  body: { v, keys: [{ user, epk, iv, ct }] }
// Adds wrapped keys for the current version. Owner/admin: for any member
// (e.g. someone who reset their PIN). Anyone else: only for themselves
// (someone who joined through a link that carried the key).
export const putMemberKeys = async (req, res) => {
  const { v, keys } = req.body ?? {};
  try {
    if (!isValidNoteId(req.params.id)) return res.status(400).json({ message: "Invalid note id" });
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > 200 || !keys.every(validWrappedKey)) {
      return res.status(400).json({ message: "Invalid keys" });
    }
    const note = await Note.findById(req.params.id).select("user_id collaborators is_deleted is_encrypted key_version enc_keys");
    const role = getNoteRole(note, req.user._id);
    if (!role || note.is_deleted) return res.status(404).json({ message: "Note not found" });
    if (!note.is_encrypted) return res.status(400).json({ message: "Note is not encrypted" });
    if (v !== note.key_version) return res.status(409).json({ message: "The key changed meanwhile - reload" });

    const me = String(req.user._id);
    const members = new Set(memberIds(note));
    const manager = canManageSharing(role);
    for (const k of keys) {
      const user = String(k.user);
      if (!members.has(user)) return res.status(400).json({ message: "Not a member of this note" });
      if (!manager && user !== me) return res.status(403).json({ message: "You can only add your own key" });
    }
    const replacing = new Set(keys.map((k) => String(k.user)));
    note.enc_keys = [
      ...note.enc_keys.filter((k) => !replacing.has(String(k.user))),
      ...toKeyEntries(keys, v),
    ];
    await note.save();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Put member keys error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
