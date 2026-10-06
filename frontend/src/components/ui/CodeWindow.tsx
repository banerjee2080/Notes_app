import { X } from "lucide-react";
import { NoteIcon } from "./Themed";
import type { ReactNode } from "react";
import { CLOSE_SHORTCUT_LABEL } from "../../hooks/useCloseShortcut";

interface CodeWindowProps {
  fileName: string;
  icon?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

// A floating editor window: tab strip with a file name (a plain title in
// the non-JS themes), optional status
// (unsaved dot / saved tick), actions on the right, content below.
const CodeWindow = ({
  fileName,
  icon,
  status = null,
  actions = null,
  onClose,
  children,
  className = "",
  bodyClassName = "p-5 md:p-7",
}: CodeWindowProps) => {
  return (
    <div className={`ide-dialog w-full overflow-hidden ${className}`}>
      <div className="cw-head shrink-0 flex items-stretch justify-between border-b ide-divider bg-[var(--panel)] rounded-t-lg">
        <div className="flex items-stretch min-w-0 flex-1 sm:flex-initial">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[13px] bg-[var(--win)] border-r ide-divider relative min-w-0 flex-1 sm:flex-initial">
            <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--kw)]" />
            {icon || <NoteIcon className="size-4 tok-js shrink-0" />}
            <span className="truncate text-[var(--fg)]">{fileName}</span>
            {status}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title={`Close (${CLOSE_SHORTCUT_LABEL})`}
                className="ml-auto sm:ml-1 shrink-0 rounded p-1 sm:p-0.5 text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--panel-2)]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {actions && (
          <div className="cw-actions flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 shrink-0">{actions}</div>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};

export default CodeWindow;
