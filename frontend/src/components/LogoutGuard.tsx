import { TriangleAlert } from "lucide-react";
import Dialog from "./ui/Dialog";
import { Remark } from "./ui/Themed";
import { useAuthStore } from "../stores/useAuthStore";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useCopy } from "../lib/voice";

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
  const { t } = useCopy();

  if (!logoutWarning) return null;

  const { count } = logoutWarning;
  const label = count === 1 ? "1 note hasn't" : `${count} notes haven't`;

  return (
    <Dialog
      onClose={isLoggingOut ? undefined : cancelLogout}
      tone="error"
      maxWidth="max-w-md"
      icon={<TriangleAlert className="size-4 shrink-0" />}
      title={t({
        js: "Uncaught Warning: unsynced notes",
        common: "Some notes haven't synced yet",
        pythagoras: "Unproven: notes not yet synced",
      })}
      footer={
        <>
          <button
            type="button"
            autoFocus
            onClick={cancelLogout}
            disabled={isLoggingOut}
            className="ide-btn ide-btn-primary justify-center disabled:opacity-50"
          >
            {t({ js: "stayLoggedIn()", common: "Stay signed in", pythagoras: "Remain" })}
          </button>
          {isOnline && (
            <button
              type="button"
              onClick={logout}
              disabled={isLoggingOut}
              className="ide-btn justify-center disabled:opacity-50"
            >
              {isLoggingOut
                ? t({ js: "syncing…", common: "Syncing…" })
                : t({ js: "retrySync()", common: "Try again" })}
            </button>
          )}
          <button
            type="button"
            onClick={confirmLogoutDiscard}
            disabled={isLoggingOut || !isOnline}
            className="ide-btn ide-btn-danger justify-center disabled:opacity-50"
          >
            {t({ js: "discardAndLogout()", common: "Discard and sign out", pythagoras: "Erase and depart" })}
          </button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-[var(--fg)]">
        {label} been saved to the server yet. Signing out now will
        permanently delete {count === 1 ? "it" : "them"} from this device.
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed tok-com">
        <Remark>
          {isOnline
            ? "The last sync attempt failed. Try again, or stay signed in and it will retry automatically."
            : "You're offline. Stay signed in and your notes will sync as soon as you reconnect."}
        </Remark>
      </p>
    </Dialog>
  );
};

export default LogoutGuard;
