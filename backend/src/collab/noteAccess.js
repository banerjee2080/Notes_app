export const getNoteRole = (note, userId) => {
  if (!note || !userId) return null;
  if (String(note.user_id) === String(userId)) return "owner";
  const entry = note.collaborators?.find(
    (c) => String(c.user) === String(userId),
  );
  return entry ? entry.role : null;
};

// Admins can do everything the owner can except delete the note.
export const canManageSharing = (role) => role === "owner" || role === "admin";
