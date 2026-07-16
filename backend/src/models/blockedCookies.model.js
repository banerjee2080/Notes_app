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
      expires: "7d",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("BlockedCookie", blockedCookieSchema);
