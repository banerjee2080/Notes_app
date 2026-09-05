import Note from "../models/note.model.js";
import cloudinary from "../lib/cloudinary.js";
import { processHtmlImages } from "../lib/cloudinary.js";
import DOMPurify from "isomorphic-dompurify";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "span",
    "div",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "sub",
    "sup",
    "mark",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "hr",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
  ],
  ALLOWED_ATTR: [
    "href",
    "target",
    "rel",
    "src",
    "alt",
    "title",
    "width",
    "height",
    "class",
    "style",
    "colspan",
    "rowspan",
    "align",
  ],
  ALLOWED_URI_REGEXP:
    /^(?:https?:|mailto:|tel:|data:image\/(?:png|jpe?g|gif|webp);base64,)/i,
  KEEP_CONTENT: true,
};

const sanitizeIfPlaintext = (content, ivContent) => {
  if (ivContent) return content;
  return DOMPurify.sanitize(content || "", SANITIZE_CONFIG);
};

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
        .select("_id user_id updated_at")
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
        const safeContent = sanitizeIfPlaintext(
          localNote.content,
          localNote.iv_content,
        );
        const cleanContent = await processHtmlImages(safeContent);
        const serverNote = serverById.get(localNote.id);

        if (!serverNote) {
          await Note.create({
            _id: localNote.id,
            user_id: userId,
            title: localNote.title,
            content: cleanContent,
            iv_title: localNote.iv_title,
            iv_content: localNote.iv_content,
            updated_at: new Date(localNote.updated_at),
            is_deleted: localNote.is_deleted,
          });
        } else {
          const localTime = new Date(localNote.updated_at).getTime();
          const serverTime = new Date(serverNote.updated_at).getTime();

          if (localTime > serverTime) {
            await Note.updateOne(
              { _id: localNote.id, user_id: userId },
              {
                $set: {
                  title: localNote.title,
                  content: cleanContent,
                  iv_title: localNote.iv_title,
                  iv_content: localNote.iv_content,
                  updated_at: new Date(localNote.updated_at),
                  is_deleted: localNote.is_deleted,
                },
              },
            );
          }
        }
      }
    }

    const query = { user_id: userId };

    if (lastSyncedAt) {
      query.updatedAt = { $gt: new Date(lastSyncedAt) };
    }

    const serverChangesRaw = await Note.find(query);

    const serverChanges = serverChangesRaw.map((note) => ({
      id: note._id,
      user_id: note.user_id,
      title: note.title,
      content: note.content,
      iv_title: note.iv_title,
      iv_content: note.iv_content,
      updated_at: note.updated_at.toISOString(),
      is_deleted: note.is_deleted,
    }));

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
    await Note.deleteMany({ user_id: userId, is_deleted: true });
    res.status(200).json({ message: "Recycle bin cleared successfully" });
  } catch (error) {
    console.error("Clear Recycle Bin Error:", error);
    res.status(500).json({ message: "Failed to clear recycle bin" });
  }
};

export const upsertNote = async (req, res) => {
  const { id, title, content, iv_title, iv_content, updated_at, is_deleted } =
    req.body;
  const user_id = req.user._id;
  try {
    const cleanContent = await processHtmlImages(content);
    const note = await Note.findOneAndUpdate(
      { _id: id, user_id: user_id },
      {
        $set: {
          title,
          content: cleanContent,
          iv_title,
          iv_content,
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
