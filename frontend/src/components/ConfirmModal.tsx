import { TriangleAlert, CircleHelp } from "lucide-react";
import Dialog from "./ui/Dialog";
import { useCopy } from "../lib/voice";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  isDestructive?: boolean;
}

// Every confirmation (delete / restore / empty bin / encrypt). The JS theme
// dresses it as an exception with try/catch buttons; the others say it plainly.
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isDestructive = false,
}: ConfirmModalProps) => {
  const { isJs, t } = useCopy();
  if (!isOpen) return null;

  // "Empty Bin" -> emptyBin()
  const fnName =
    String(confirmText || "confirm")
      .split(/\s+/)
      .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
      .join("") + "()";

  const confirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog
      onClose={onClose}
      tone={isDestructive ? "error" : "default"}
      maxWidth="max-w-sm"
      icon={
        isDestructive ? (
          <TriangleAlert className="size-4 shrink-0" />
        ) : (
          <CircleHelp className="size-4 shrink-0 tok-fn" />
        )
      }
      title={isJs ? (isDestructive ? `Uncaught Warning: ${title}` : `confirm("${title}")`) : title}
      footer={
        isJs ? (
          <>
            <button type="button" onClick={onClose} className="ide-btn min-w-[120px] justify-center">
              <span>
                <span className="tok-kw">catch</span>
                <span className="tok-punc"> (e) {"{}"}</span>
              </span>
            </button>
            <button
              type="button"
              autoFocus
              onClick={confirm}
              className={`ide-btn min-w-[120px] justify-center ${isDestructive ? "ide-btn-danger" : "ide-btn-primary"}`}
            >
              <span>
                <span className="tok-kw">try</span>
                <span className="tok-punc"> {"{ "}</span>
                {fnName}
                <span className="tok-punc">{" }"}</span>
              </span>
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className="ide-btn min-w-[110px] justify-center">
              {t({ js: "", common: "Cancel", pythagoras: "Let it stand" })}
            </button>
            <button
              type="button"
              autoFocus
              onClick={confirm}
              className={`ide-btn min-w-[110px] justify-center ${isDestructive ? "ide-btn-danger" : "ide-btn-primary"}`}
            >
              {confirmText}
            </button>
          </>
        )
      }
    >
      <p className="text-[13.5px] leading-relaxed text-[var(--fg)]">{message}</p>
    </Dialog>
  );
};

export default ConfirmModal;
