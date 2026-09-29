// DEPRECATED: revoked JWTs now live in Redis (see src/lib/tokenBlacklist.js).
// Nothing imports this model any more; it is safe to delete this file and drop
// the `blockedcookies` collection.
import mongoose from "mongoose";

const blockedCookieSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: "7d", // TTL index - owned here, so no `timestamps: true`
    },
  },
);

export default mongoose.model("BlockedCookie", blockedCookieSchema);
