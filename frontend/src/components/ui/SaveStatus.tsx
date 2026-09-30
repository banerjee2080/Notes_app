/**
 * Autosave state, as the editor pages track it:
 *   false            - idle
 *   true             - a save is in flight
 *   "saved"          - saved, shown briefly
 *   "Saving failed.." - the local write threw
 *   ""               - cleared after the "saved" tick fades
 */
export type SavingState = boolean | "saved" | "Saving failed.." | "";

// VS Code-style tab status for autosave: ● while saving, ✓ when saved.
const SaveStatus = ({ saving }: { saving: SavingState }) => {
  if (saving === true)
    return (
      <span className="ml-1 flex items-center gap-1.5 text-[11px] tok-dim" title="Autosaving…">
        <span className="size-2 rounded-full bg-[var(--warn)] animate-pulse" />
        <span className="hidden sm:inline">saving…</span>
      </span>
    );
  if (saving === "saved")
    return (
      <span className="ml-1 text-[11px] tok-ok animate-fade-in" title="Saved">
        ✓ <span className="hidden sm:inline">saved</span>
      </span>
    );
  if (saving === "Saving failed..")
    return (
      <span className="ml-1 text-[11px] tok-err animate-fade-in" title="Save failed">
        ✕ <span className="hidden sm:inline">save failed</span>
      </span>
    );
  return null;
};

export default SaveStatus;
