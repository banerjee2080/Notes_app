import { TriangleAlert } from "lucide-react";
import Dialog from "./ui/Dialog";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

// Shown when logout() finds notes the server hasn't received yet.
// The only path that deletes them is the explicit discardAndLogout() button.
const LogoutGuard = () => {
  const {
    logoutWarning,
    isLoggingOut,
    logout,
    cancelLogout,
    confirmLogoutDiscard,
  } = useAuthStore();
  const isOnline = useOnlineStatus();

  if (!logoutWarning) return null;

  const { count } = logoutWarning;
  const label = count === 1 ? "1 note hasn't" : `${count} notes haven't`;

  return (
    <Dialog
      onClose={isLoggingOut ? undefined : cancelLogout}
      tone="error"
      maxWidth="max-w-md"
      icon={<TriangleAlert className="size-4 shrink-0" />}
      title="Uncaught Warning: unsynced notes"
      footer={
        <>
          <button
            type="button"
            autoFocus
            onClick={cancelLogout}
            disabled={isLoggingOut}
            className="ide-btn ide-btn-primary justify-center disabled:opacity-50"
          >
            stayLoggedIn()
          </button>
          {isOnline && (
            <button
              type="button"
              onClick={logout}
              disabled={isLoggingOut}
              className="ide-btn justify-center disabled:opacity-50"
            >
              {isLoggingOut ? "syncing…" : "retrySync()"}
            </button>
          )}
          <button
            type="button"
            onClick={confirmLogoutDiscard}
            disabled={isLoggingOut || !isOnline}
            className="ide-btn ide-btn-danger justify-center disabled:opacity-50"
          >
            discardAndLogout()
          </button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-[var(--fg)]">
        {label} been saved to the server yet. Logging out now will
        permanently delete {count === 1 ? "it" : "them"} from this device.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed tok-com">
        {isOnline
          ? "// The last sync attempt failed. Try again, or stay logged in and it will retry automatically."
          : "// You're offline. Stay logged in — your notes will sync as soon as you reconnect."}
      </p>
    </Dialog>
  );
};

export default LogoutGuard;
