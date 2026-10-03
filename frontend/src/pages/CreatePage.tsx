import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import CodeSpinner from "../components/ui/CodeSpinner";
import api from "../lib/axios";
import { localDB } from "../lib/db";
import { registerBackgroundSync } from "../lib/syncEngine";
import { useAuthStore } from "../stores/useAuthStore";
import { userIdOf } from "../types/user";
import type { Note } from "../types/notes";

// "New note" creates an empty note straight away and opens it in the
// collaborative editor (NotePage), so it can be shared from the first second.
// NotePage moves it to the recycle bin if it is closed while still empty.
const CreatePage = ({ isModal }: { isModal?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser } = useAuthStore();
  // Kept in state so StrictMode's second effect run reuses the same id
  // instead of creating a second note.
  const [noteId] = useState(() => uuidv4());

  useEffect(() => {
    const userId = userIdOf(authUser);
    if (!userId) return;
    let cancelled = false;

    const createNote = async () => {
      const newNote: Note = {
        id: noteId,
        user_id: userId,
        title: "",
        content: "",
        updated_at: new Date().toISOString(),
        is_deleted: false,
        sync_status: "pending_update",
      };

      try {
        await localDB.notes.put(newNote);
      } catch (error) {
        console.error("Error creating note locally: ", error);
        toast.error("Could not create the note");
        navigate("/");
        return;
      }

      // The collab server only opens notes it already knows about, so wait
      // for the server copy before opening the editor.
      try {
        await api.post("/notes/upsert", newNote, { adapter: "fetch" });
        await localDB.notes.update(noteId, { sync_status: "synced" });
      } catch {
        console.log("Offline: Note queued for background sync");
        registerBackgroundSync(userId);
      }

      if (cancelled) return;
      // replace: Back shouldn't land here again and create another note.
      // state: keeps the modal-over-home layout when opened as a modal.
      navigate(`/note/${noteId}`, { replace: true, state: location.state });
    };

    createNote();
    return () => {
      cancelled = true;
    };
  }, [authUser, noteId, navigate, location.state]);

  return (
    <div
      className={
        isModal
          ? "fixed inset-0 z-50 flex justify-center items-center ide-backdrop"
          : "min-h-screen flex justify-center items-center"
      }
    >
      <CodeSpinner label="new Note()…" />
    </div>
  );
};

export default CreatePage;
