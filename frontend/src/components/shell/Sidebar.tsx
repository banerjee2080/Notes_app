import { Link, NavLink, useLocation } from "react-router";
import {
  Plus,
  FolderOpen,
  Folder,
  FileCode2,
  FileText,
  ArrowUpToLine,
  LogOut,
  Clock3,
  Triangle,
} from "lucide-react";
import { useVoice, type Voice } from "../../lib/voice";
import { useAuthStore } from "../../stores/useAuthStore";
import { useUiStore } from "../../stores/useUiStore";
import { useNotes } from "../../hooks/useNotes";
import { toFileName } from "../../lib/utils";

/** One row of the file-tree navigation, rendered as a line of code. */
interface TreeItem {
  to: string;
  end?: boolean;
  kw: string;
  name: string;
  tail: string;
  /** Key into Voice["nav"] for the plain-language themes. */
  label: keyof Voice["nav"];
}

const TREE: TreeItem[] = [
  { to: "/", end: true, kw: "class", name: "Notes", tail: " {}", label: "notes" },
  { to: "/recycleBin", kw: "function", name: "RecycleBin", tail: "() {}", label: "bin" },
  { to: "/profile", kw: "const", name: "profile", tail: " = {}", label: "profile" },
  { to: "/history", kw: "import", name: "history", tail: " from '95'", label: "history" },
];

const ROMAN = ["I", "II", "III", "IV", "V"];

const Sidebar = () => {
  const location = useLocation();
  const { authUser, logout } = useAuthStore();
  const { sidebarOpen, drawerOpen, closeDrawer } = useUiStore();
  const { notes } = useNotes();
  const { theme, voice } = useVoice();
  const NoteIcon = theme === "pythagoras" ? Triangle : voice ? FileText : FileCode2;

  const hoisted = (notes ?? []).slice(0, 5);
  const closeOnMobile = closeDrawer;

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={`md:hidden fixed inset-0 z-30 ide-backdrop ${drawerOpen ? "" : "hidden"}`}
        onClick={closeDrawer}
      />

      <aside
        className={`z-40 flex flex-col shrink-0 border-r ide-divider bg-[var(--panel)] md:bg-[color-mix(in_srgb,var(--panel)_70%,transparent)]
          fixed md:static inset-y-0 left-0 w-[260px] transition-[transform,width,margin] duration-300
          ${drawerOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          ${sidebarOpen ? "" : "md:w-0 md:border-r-0 md:overflow-hidden"}`}
        aria-label="Navigation"
      >
        <div className="p-3">
          <Link
            to="/createNote"
            state={{ backgroundLocation: location }}
            onClick={closeOnMobile}
            className="ide-btn ide-btn-ok w-full justify-center !py-2"
          >
            <Plus className="size-4" />
            {voice ? (
              <span>{voice.newNote}</span>
            ) : (
              <span>
                <span className="tok-punc">{"{ "}</span>New Note<span className="tok-punc">{" }"}</span>
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto ide-scroll px-2 pb-3 text-[13px]">
          {!voice && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-[var(--fg-muted)]">
              <FolderOpen className="size-4 text-[var(--fn)]" />
              <span>~/root</span>
            </div>
          )}

          <ul className={voice ? "space-y-0.5" : "pl-3 space-y-0.5"}>
            {TREE.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeOnMobile}
                  className={({ isActive }) => `tree-item ${isActive ? "is-active" : ""}`}
                >
                  <Folder className="size-4 shrink-0 text-[var(--fn)]" />
                  {voice ? (
                    <span className="truncate text-[var(--fg)]">{voice.nav[item.label]}</span>
                  ) : (
                    <span className="truncate">
                      <span className="tok-kw">{item.kw} </span>
                      <span className="text-[var(--fg)]">{item.name}</span>
                      <span className="tok-punc">{item.tail}</span>
                    </span>
                  )}
                  {item.to === "/" && notes && (
                    <span className="ml-auto text-[11px] tok-dim tabular-nums">{notes.length}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between px-2 py-1.5 text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">
            <span>{voice ? voice.recent : "Hoisted Notes"}</span>
            {voice ? <Clock3 className="size-3.5 tok-js" /> : <ArrowUpToLine className="size-3.5 tok-js" />}
          </div>

          {hoisted.length === 0 ? (
            <p className="px-3 py-1 text-xs tok-com">{voice ? voice.recentEmpty : "// nothing hoisted yet"}</p>
          ) : (
            <ul className="pl-1 space-y-0.5">
              {hoisted.map((n, i) => (
                <li key={n.id}>
                  <Link
                    to={`/note/${n.id}`}
                    state={{ backgroundLocation: location }}
                    onClick={closeOnMobile}
                    className="tree-item"
                    title={n.title}
                  >
                    {theme === "pythagoras" ? (
                      <span className="w-6 shrink-0 text-right tok-js tabular-nums text-[12px]">{ROMAN[i]}.</span>
                    ) : (
                      <NoteIcon className="size-4 shrink-0 tok-js" />
                    )}
                    <span className="truncate">{voice ? n.title || "Untitled" : toFileName(n.title)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {authUser && (
          <div className="border-t ide-divider p-3 flex items-center gap-3">
            <Link to="/profile" onClick={closeOnMobile} className="flex items-center gap-2.5 min-w-0 flex-1 group">
              <img
                src={authUser.profilePic || "/avatar.png"}
                alt=""
                referrerPolicy="no-referrer"
                className="size-8 rounded-md object-cover border ide-divider group-hover:border-[var(--kw)] transition-colors"
              />
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] text-[var(--fg)] truncate">
                  {authUser.fullName?.split(" ")[0] || "user"}
                </div>
                <div className="text-[11px] tok-com truncate">{voice ? voice.signedIn : "// signed in"}</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="ide-icon-btn is-danger"
              title={voice ? "Sign out" : "logout()"}
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
