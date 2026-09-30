import { FileCode2, X } from "lucide-react";
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

// A floating editor window: tab strip with a file name, optional status
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
      <div className="flex items-stretch justify-between border-b ide-divider bg-[var(--panel)] rounded-t-lg">
        <div className="flex items-stretch min-w-0">
          <div className="flex items-center gap-2 px-4 py-2.5 text-[13px] bg-[var(--win)] border-r ide-divider relative min-w-0">
            <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--kw)]" />
            {icon || <FileCode2 className="size-4 tok-js shrink-0" />}
            <span className="truncate text-[var(--fg)]">{fileName}</span>
            {status}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title={`Close (${CLOSE_SHORTCUT_LABEL})`}
                className="ml-1 rounded p-0.5 text-[var(--fg-dim)] hover:text-[var(--fg)] hover:bg-[var(--panel-2)]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 px-3">{actions}</div>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
};

export default CodeWindow;
