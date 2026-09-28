import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router";
import {
  Plus,
  FolderOpen,
  Folder,
  FileCode2,
  ArrowUpToLine,
  Lock,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore.js";
import { useUiStore } from "../../stores/useUiStore.js";
import { useDecryptedNotes } from "../../hooks/useDecryptedNotes.js";
import { toFileName } from "../../lib/utils.js";

const TREE = [
  { to: "/", end: true, kw: "class", name: "Notes", tail: " {}" },
  { to: "/recycleBin", kw: "function", name: "RecycleBin", tail: "() {}" },
  { to: "/profile", kw: "const", name: "profile", tail: " = {}" },
  { to: "/history", kw: "import", name: "history", tail: " from '95'" },
];

const Sidebar = () => {
  const location = useLocation();
  const { authUser, logout, checkPin } = useAuthStore();

  // Quietly load a remembered vault key (if "keepUnlocked" was ticked) so
  // pages that don't ask for the PIN (profile, history) still show titles.
  useEffect(() => {
    checkPin();
  }, [checkPin]);
  const { sidebarOpen, drawerOpen, closeDrawer } = useUiStore();
  const { notes, decryptedNotes, isUnlocked } = useDecryptedNotes();

  const hoisted = decryptedNotes.slice(0, 5);
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
            <span>
              <span className="tok-punc">{"{ "}</span>New Note<span className="tok-punc">{" }"}</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto ide-scroll px-2 pb-3 text-[13px]">
          <div className="flex items-center gap-2 px-2 py-1.5 text-[var(--fg-muted)]">
            <FolderOpen className="size-4 text-[var(--fn)]" />
            <span>~/root</span>
          </div>

          <ul className="pl-3 space-y-0.5">
            {TREE.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={closeOnMobile}
                  className={({ isActive }) => `tree-item ${isActive ? "is-active" : ""}`}
                >
                  <Folder className="size-4 shrink-0 text-[var(--fn)]" />
                  <span className="truncate">
                    <span className="tok-kw">{item.kw} </span>
                    <span className="text-[var(--fg)]">{item.name}</span>
                    <span className="tok-punc">{item.tail}</span>
                  </span>
                  {item.to === "/" && notes && (
                    <span className="ml-auto text-[11px] tok-dim tabular-nums">{notes.length}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between px-2 py-1.5 text-[11px] uppercase tracking-wider text-[var(--fg-dim)]">
            <span>Hoisted Notes</span>
            <ArrowUpToLine className="size-3.5 tok-js" />
          </div>

          {!isUnlocked ? (
            <Link
              to="/pin"
              state={{ backgroundLocation: location }}
              className="tree-item"
            >
              <Lock className="size-4 tok-warn" />
              <span className="tok-com">// vault locked</span>
            </Link>
          ) : hoisted.length === 0 ? (
            <p className="px-3 py-1 text-xs tok-com">// nothing hoisted yet</p>
          ) : (
            <ul className="pl-1 space-y-0.5">
              {hoisted.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/note/${n.id}`}
                    state={{ backgroundLocation: location }}
                    onClick={closeOnMobile}
                    className="tree-item"
                    title={n.title}
                  >
                    <FileCode2 className="size-4 shrink-0 tok-js" />
                    <span className="truncate">{toFileName(n.title)}</span>
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
                <div className="text-[11px] tok-com truncate">// signed in</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={logout}
              className="ide-icon-btn is-danger"
              title="logout()"
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
