import Note from "../models/note.model.js";
import cloudinary from "../lib/cloudinary.js";
import { processHtmlImages } from "../lib/cloudinary.js";

export const syncNotes = async (req, res) => {
  const userId = req.user._id;
  const { lastSyncedAt, localChanges } = req.body;

  try {
    if (localChanges && localChanges.length > 0) {
      for (const localNote of localChanges) {
        const cleanContent = await processHtmlImages(localNote.content);
        const serverNote = await Note.findById(localNote.id);

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

          if (localTime > serverTime) {
            await Note.findByIdAndUpdate(localNote.id, {
              title: localNote.title,
              content: cleanContent,
              updated_at: new Date(localNote.updated_at),
              is_deleted: localNote.is_deleted,
            });
          }
        }
      }
    }

    const query = { user_id: userId };

    if (lastSyncedAt) {
      query.updated_at = { $gt: new Date(lastSyncedAt) };
    }

    const serverChangesRaw = await Note.find(query);

    const serverChanges = serverChangesRaw.map((note) => ({
      id: note._id,
      user_id: note.user_id,
      title: note.title,
      content: note.content,
      updated_at: note.updated_at.toISOString(),
      is_deleted: note.is_deleted,
    }));

    res.status(200).json({
      serverChanges,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync Error:", error);
    res.status(500).json({ message: "Server sync failed" });
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
    const cleanContent = await processHtmlImages(content);
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
    console.error("Error in background sync upsert:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
