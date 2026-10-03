import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { UsersIcon, XIcon } from "lucide-react";
import Dialog from "./ui/Dialog";
import api from "../lib/axios";
import { errorMessage } from "../lib/errors";

type ShareRole = "editor" | "viewer";

interface Collaborator {
  _id: string;
  fullName: string;
  email: string;
  role: ShareRole;
}

interface ShareDialogProps {
  noteId: string;
  /** Only the owner can invite or remove people; others just see the list. */
  isOwner: boolean;
  onClose: () => void;
}

export default function ShareDialog({ noteId, isOwner, onClose }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ collaborators: Collaborator[] }>(`/notes/${noteId}/collaborators`)
      .then((res) => setCollaborators(res.data.collaborators))
      .catch((e) => toast.error(errorMessage(e, "Could not load collaborators")));
  }, [noteId]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ collaborators: Collaborator[] }>(
        `/notes/${noteId}/share`,
        { email, role },
      );
      setCollaborators(res.data.collaborators);
      setEmail("");
      toast.success("Note shared");
    } catch (err) {
      toast.error(errorMessage(err, "Could not share note"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    try {
      const res = await api.delete<{ collaborators: Collaborator[] }>(
        `/notes/${noteId}/share/${userId}`,
      );
      setCollaborators(res.data.collaborators);
    } catch (err) {
      toast.error(errorMessage(err, "Could not remove collaborator"));
    }
  };

  return (
    <Dialog title="share(note)" icon={<UsersIcon className="size-4" />} onClose={onClose}>
      {isOwner && (
        <form onSubmit={invite} className="flex flex-wrap gap-2 mb-4">
          <input
            type="email"
            required
            value={email}
            placeholder="friend@example.com"
            aria-label="Email to share with"
            onChange={(e) => setEmail(e.target.value)}
            className="ide-input flex-1 min-w-0"
          />
          <select
            value={role}
            aria-label="Permission"
            onChange={(e) => setRole(e.target.value as ShareRole)}
            className="ide-input"
          >
            <option value="editor">can edit</option>
            <option value="viewer">can view</option>
          </select>
          <button type="submit" disabled={busy} className="ide-btn ide-btn-primary">
            invite
          </button>
        </form>
      )}
      {collaborators.length === 0 ? (
        <p className="text-xs tok-com">{"// not shared with anyone yet"}</p>
      ) : (
        <ul className="space-y-2">
          {collaborators.map((c) => (
            <li key={c._id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate">
                {c.fullName} <span className="tok-com">&lt;{c.email}&gt;</span>
              </span>
              <span className="ide-chip text-xs">{c.role}</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => remove(c._id)}
                  className="ide-icon-btn"
                  title={`Remove ${c.fullName}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
