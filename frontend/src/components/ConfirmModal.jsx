import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  isDestructive = false,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-sm theme-bg-glass backdrop-blur-xl border rounded-2xl p-6 shadow-2xl z-10 transform transition-all animate-in fade-in zoom-in duration-200">
        {/* Glow effects */}
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: "var(--theme-main)" }}
        ></div>
        <div
          className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: "var(--theme-accent)" }}
        ></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div
            className={`p-4 rounded-full mb-4 ${
              isDestructive ? "bg-red-500/10 text-red-400" : "bg-white/10 text-white/80"
            }`}
          >
            <AlertTriangle className="size-8" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2">{title}</h3>

          <p className="text-sm text-white/60 mb-6">{message}</p>

          <div className="flex items-center gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl theme-button-outline font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                isDestructive
                  ? "bg-red-500 hover:bg-red-600 text-white border border-red-500"
                  : "theme-button"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
