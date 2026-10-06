import { useCopy } from "../../lib/voice";

/**
 * Autosave state, as the editor pages track it:
 *   false            - idle
 *   true             - a save is in flight
 *   "saved"          - saved, shown briefly
 *   "Saving failed.." - the local write threw
 *   ""               - cleared after the "saved" tick fades
 */
export type SavingState = boolean | "saved" | "Saving failed.." | "";

// Tab status for autosave: ● while saving, ✓ when saved.
const SaveStatus = ({ saving }: { saving: SavingState }) => {
  const { t } = useCopy();
  if (saving === true)
    return (
      <span className="ml-1 flex items-center gap-1.5 text-[11px] tok-dim" title="Autosaving…">
        <span className="size-2 rounded-full bg-[var(--warn)] animate-pulse" />
        <span className="hidden sm:inline">{t({ js: "saving…", common: "Saving…", pythagoras: "Drafting…" })}</span>
      </span>
    );
  if (saving === "saved")
    return (
      <span className="ml-1 text-[11px] tok-ok animate-fade-in" title="Saved">
        {t({ js: "✓", common: "✓", pythagoras: "∴" })}{" "}
        <span className="hidden sm:inline">{t({ js: "saved", common: "Saved", pythagoras: "Q.E.D." })}</span>
      </span>
    );
  if (saving === "Saving failed..")
    return (
      <span className="ml-1 text-[11px] tok-err animate-fade-in" title="Save failed">
        ✕ <span className="hidden sm:inline">{t({ js: "save failed", common: "Couldn't save" })}</span>
      </span>
    );
  return null;
};

export default SaveStatus;
