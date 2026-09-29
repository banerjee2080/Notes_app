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

// Recycle-bin auto-purge: MongoDB permanently deletes a note 30 days after
// it was last written *while in the trash*. This replaces the old node-cron
// job, which could never run on Vercel (serverless functions are torn down
// after each request, so nothing is alive at midnight to fire a schedule).
//
// - partialFilterExpression: only documents with is_deleted === true are in
//   this index, so live notes are never touched by the TTL monitor.
// - updatedAt (from `timestamps: true`) is set by the server on every write.
//   updated_at is deliberately NOT used: it comes from the client for offline
//   sync, so a device with a wrong clock could get a note purged early.
// - Restoring a note (is_deleted -> false) removes it from the index, and
//   trashing it again restarts the 30-day clock.
// - MongoDB's TTL monitor runs roughly every 60 seconds, so deletion happens
//   shortly after the 30 days are up, not at an exact time.
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
