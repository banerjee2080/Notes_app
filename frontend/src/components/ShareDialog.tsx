import { useEffect, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { CheckIcon, GlobeIcon, LinkIcon, LockIcon, UsersIcon, XIcon } from "lucide-react";
import Dialog from "./ui/Dialog";
import api from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { useAuthStore } from "../stores/useAuthStore";
import { userIdOf } from "../types/user";
import type { NoteRole } from "../types/notes";

type InviteRole = Exclude<NoteRole, "owner">;
type LinkRole = "editor" | "viewer";
type LinkAccess = "restricted" | "anyone";

interface Person {
  _id: string;
  fullName: string;
  email: string;
  profilePic: string;
}

interface Collaborator extends Person {
  role: InviteRole;
  /** Got access by opening the link rather than by invite. */
  viaLink: boolean;
}

/** GET /notes/:id/sharing. owner + collaborators only come back for owner/admin. */
interface SharingState {
  role: NoteRole;
  canManage: boolean;
  link: { access: LinkAccess; role: LinkRole };
  owner?: Person | null;
  collaborators?: Collaborator[];
}

interface ShareDialogProps {
  noteId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<InviteRole, string> = {
  admin: "admin",
  editor: "can edit",
  viewer: "can view",
};

const Avatar = ({ person }: { person: Person }) => (
  <img
    src={person.profilePic || "/avatar.png"}
    alt=""
    referrerPolicy="no-referrer"
    className="size-8 rounded-full object-cover shrink-0 border ide-divider"
  />
);

export default function ShareDialog({ noteId, onClose }: ShareDialogProps) {
  const { authUser } = useAuthStore();
  const myId = userIdOf(authUser);
  const [state, setState] = useState<SharingState | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const link = `${location.origin}/note/${noteId}`;
  const canManage = state?.canManage ?? false;

  useEffect(() => {
    api
      .get<SharingState>(`/notes/${noteId}/sharing`)
      .then((res) => setState(res.data))
      .catch((e) => toast.error(errorMessage(e, "Could not load sharing settings")));
  }, [noteId]);

  // Every mutating endpoint answers with the fresh sharing state.
  const run = async (request: () => Promise<{ data: SharingState }>, fallback: string) => {
    setBusy(true);
    try {
      const res = await request();
      setState(res.data);
      return true;
    } catch (err) {
      toast.error(errorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () => api.post(`/notes/${noteId}/share`, { email, role }),
      "Could not share note",
    );
    if (ok) {
      setEmail("");
      toast.success("Note shared");
    }
  };

  const changeRole = (c: Collaborator, next: InviteRole) =>
    run(
      () => api.post(`/notes/${noteId}/share`, { email: c.email, role: next }),
      "Could not change access",
    );

  const remove = (c: Collaborator) =>
    run(() => api.delete(`/notes/${noteId}/share/${c._id}`), "Could not remove access");

  const setLink = (access: LinkAccess, linkRole: LinkRole) =>
    run(
      () => api.patch(`/notes/${noteId}/link`, { access, role: linkRole }),
      "Could not update link",
    );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const linkIsOpen = state?.link.access === "anyone";

  return (
    <Dialog
      title="share(note)"
      icon={<UsersIcon className="size-4" />}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      {!state ? (
        <p className="text-xs tok-com">{"// loading…"}</p>
      ) : (
        <div className="space-y-5">
          {canManage && (
            <form onSubmit={invite} className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={email}
                placeholder="friend@example.com"
                aria-label="Email to share with"
                onChange={(e) => setEmail(e.target.value)}
                className="ide-input flex-1 min-w-[12rem]"
              />
              <select
                value={role}
                aria-label="Permission"
                onChange={(e) => setRole(e.target.value as InviteRole)}
                className="ide-input !w-auto"
              >
                <option value="admin">admin</option>
                <option value="editor">can edit</option>
                <option value="viewer">can view</option>
              </select>
              <button type="submit" disabled={busy} className="ide-btn ide-btn-primary">
                invite
              </button>
            </form>
          )}

          {canManage && (
            <section>
              <h3 className="text-xs tok-com mb-2">{"// people with access"}</h3>
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {state.owner && (
                  <li className="flex items-center gap-3 text-sm">
                    <Avatar person={state.owner} />
                    <PersonLabel person={state.owner} isMe={state.owner._id === myId} />
                    <span className="ide-chip">owner</span>
                  </li>
                )}
                {state.collaborators?.map((c) => {
                  const isMe = c._id === myId;
                  return (
                    <li key={c._id} className="flex items-center gap-3 text-sm">
                      <Avatar person={c} />
                      <PersonLabel person={c} isMe={isMe} viaLink={c.viaLink} />
                      {isMe ? (
                        // Your own access: use "leave note" to drop it.
                        <span className="ide-chip">{ROLE_LABELS[c.role]}</span>
                      ) : (
                        <>
                          <select
                            value={c.role}
                            disabled={busy}
                            aria-label={`Access for ${c.fullName}`}
                            onChange={(e) => changeRole(c, e.target.value as InviteRole)}
                            className="ide-input !w-auto !py-1 !px-2 text-xs"
                          >
                            <option value="admin">admin</option>
                            <option value="editor">can edit</option>
                            <option value="viewer">can view</option>
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remove(c)}
                            className="ide-icon-btn is-danger shrink-0"
                            title={`Remove ${c.fullName}`}
                            aria-label={`Remove ${c.fullName}`}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
                {!state.collaborators?.length && (
                  <li className="text-xs tok-com">{"// not shared with anyone yet"}</li>
                )}
              </ul>
            </section>
          )}

          <section>
            <h3 className="text-xs tok-com mb-2">{"// general access"}</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="size-8 rounded-full grid place-items-center shrink-0 border ide-divider">
                {linkIsOpen ? <GlobeIcon className="size-4" /> : <LockIcon className="size-4" />}
              </span>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <select
                    value={state.link.access}
                    disabled={busy}
                    aria-label="Who can open the link"
                    onChange={(e) => setLink(e.target.value as LinkAccess, state.link.role)}
                    className="ide-input !w-auto !py-1 !px-2 text-xs"
                  >
                    <option value="restricted">restricted</option>
                    <option value="anyone">anyone with the link</option>
                  </select>
                  {linkIsOpen && (
                    <select
                      value={state.link.role}
                      disabled={busy}
                      aria-label="What the link allows"
                      onChange={(e) => setLink("anyone", e.target.value as LinkRole)}
                      className="ide-input !w-auto !py-1 !px-2 text-xs"
                    >
                      <option value="editor">can edit</option>
                      <option value="viewer">can view</option>
                    </select>
                  )}
                </div>
              ) : (
                <span className="flex-1 min-w-0">
                  {linkIsOpen
                    ? `Anyone with the link ${ROLE_LABELS[state.link.role]}`
                    : "Restricted"}
                </span>
              )}
            </div>
            <p className="text-xs tok-com mt-2">
              {linkIsOpen
                ? "// anyone signed in who opens the link gets access"
                : "// only people added above can open the link"}
            </p>
            {!canManage && (
              <p className="text-xs tok-com mt-1">
                {"// only the owner or an admin can change who has access"}
              </p>
            )}
          </section>

          <div className="flex justify-end">
            <button type="button" onClick={copyLink} className="ide-btn ide-btn-primary">
              {copied ? <CheckIcon className="size-3.5" /> : <LinkIcon className="size-3.5" />}
              {copied ? "copied" : "copy link"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function PersonLabel({
  person,
  isMe,
  viaLink,
}: {
  person: Person;
  isMe: boolean;
  viaLink?: boolean;
}) {
  return (
    <span className="flex-1 min-w-0">
      <span className="block truncate">
        {person.fullName}
        {isMe && <span className="tok-com"> (you)</span>}
        {viaLink && <span className="tok-com"> · via link</span>}
      </span>
      <span className="block truncate text-xs tok-com">{person.email}</span>
    </span>
  );
}
