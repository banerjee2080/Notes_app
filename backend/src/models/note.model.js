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
    iv_title: {
      type: String,
      default: "",
    },
    iv_content: {
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
