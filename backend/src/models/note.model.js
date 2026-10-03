import mongoose from "mongoose";

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
