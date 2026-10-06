import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DialogProps {
  onClose?: () => void;
  title: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "error";
  maxWidth?: string;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

// Every modal in the app (confirmations, etc.) renders through this. The
// callers pick the wording; the JS theme styles them as console errors.
const Dialog = ({
  onClose,
  title,
  icon = null,
  tone = "default",
  maxWidth = "max-w-md",
  closeOnBackdrop = true,
  showClose = true,
  children,
  footer = null,
}: DialogProps) => {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    // stopPropagation: React bubbles portal events through the component
    // tree, so without this a click here would also hit the note modal's
    // "click outside to close" handler underneath.
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 ide-backdrop"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`sheet-sm relative w-full ${maxWidth} ide-dialog ${tone === "error" ? "is-error" : ""}`}
      >
        <div className="ide-dialog-head">
          <div className="flex items-center gap-2 min-w-0 font-medium">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          {showClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ide-icon-btn is-danger !w-7 !h-7"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="px-5 pb-5 -mt-1 flex flex-wrap items-center justify-center gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default Dialog;
