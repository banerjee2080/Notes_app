import mongoose from "mongoose";

// One encrypted Yjs update for an encrypted note. The server can't read or
// merge them, so it keeps them in order; clients replay snapshot + updates.
// A client folds them into a new snapshot every ~100 updates (compaction).
const noteUpdateSchema = new mongoose.Schema({
  note: { type: String, required: true },
  seq: { type: Number, required: true },
  v: { type: Number, required: true }, // key_version
  iv: { type: String, required: true },
  ct: { type: String, required: true },
});

noteUpdateSchema.index({ note: 1, seq: 1 }, { unique: true });

export default mongoose.model("NoteUpdate", noteUpdateSchema);
