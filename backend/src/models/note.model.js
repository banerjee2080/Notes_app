import mongoose from "mongoose";

// AES-GCM ciphertext. v = the key_version it was encrypted under.
const encBlobSchema = new mongoose.Schema(
  {
    v: { type: Number, required: true },
    iv: { type: String, required: true },
    ct: { type: String, required: true },
    upto: { type: Number, default: 0 }, // snapshots only
  },
  { _id: false },
);

const wrappedKeySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    v: { type: Number, required: true },
    epk: { type: String, required: true }, // ephemeral public key (raw, base64)
    iv: { type: String, required: true },
    ct: { type: String, required: true },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    updated_at: {
      type: Date,
      required: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    collaborators: {
      type: [
        {
          _id: false,
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          role: {
            type: String,
            enum: ["admin", "editor", "viewer"],
            default: "editor",
          },
          // Joined by opening the share link rather than by invite. These
          // entries follow link_role and are dropped when the link is
          // switched back to "restricted".
          via_link: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    // Google-Docs style link: "restricted" = only people on the list,
    // "anyone" = any signed-in user who opens /note/:id gets link_role.
    link_access: {
      type: String,
      enum: ["restricted", "anyone"],
      default: "restricted",
    },
    link_role: {
      type: String,
      enum: ["editor", "viewer"],
      default: "viewer",
    },
    // ---- End-to-end encryption (see controllers/encryption.controller.js) ----
    // When set, title/content/ydoc are empty: the text only exists as
    // ciphertext under a per-note key (NK) the server never sees.
    is_encrypted: {
      type: Boolean,
      default: false,
    },
    // Bumped every time the note key is replaced (someone lost access).
    key_version: {
      type: Number,
      default: 0,
    },
    // Last sequence number handed to an encrypted update (NoteUpdate.seq).
    enc_seq: {
      type: Number,
      default: 0,
    },
    // Encrypted full Yjs state, covering every update with seq <= upto.
    enc_snapshot: {
      type: encBlobSchema,
      default: null,
      select: false, // can be large; only the encryption endpoints load it
    },
    // Encrypted { title, text } so note lists can show something once unlocked.
    enc_preview: {
      type: encBlobSchema,
      default: null,
    },
    // NK wrapped (ECIES, P-256) for each member's public key.
    enc_keys: {
      type: [wrappedKeySchema],
      default: [],
    },
    // Someone lost access since the key was last replaced; the next owner or
    // admin to open the note replaces it.
    needs_rotation: {
      type: Boolean,
      default: false,
    },
    ydoc: {
      type: Buffer,
      select: false,
    },
    is_collaborative: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const TRASH_RETENTION_SECONDS = 30 * 24 * 60 * 60;

noteSchema.index(
  { updatedAt: 1 },
  {
    name: "trash_auto_purge_30d",
    expireAfterSeconds: TRASH_RETENTION_SECONDS,
    partialFilterExpression: { is_deleted: true },
  },
);

export default mongoose.model("Note", noteSchema);
