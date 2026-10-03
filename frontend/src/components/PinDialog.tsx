import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { KeyRoundIcon } from "lucide-react";
import Dialog from "./ui/Dialog";
import api from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { useAuthStore } from "../stores/useAuthStore";
import { useVaultStore } from "../stores/useVaultStore";

interface PinDialogProps {
  onClose: () => void;
  /** Called once the vault is unlocked (or set up). */
  onUnlocked?: () => void;
}

const PIN_RE = /^\d{6}$/;

const PinInput = ({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}) => (
  <input
    type="password"
    inputMode="numeric"
    autoComplete="off"
    maxLength={6}
    required
    autoFocus={autoFocus}
    value={value}
    aria-label={label}
    placeholder="••••••"
    onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    className="ide-input text-center tracking-[0.5em] text-lg"
  />
);

const untilText = (iso?: string | null) =>
  iso ? `Locked until ${new Date(iso).toLocaleTimeString()}` : null;

// Set up, unlock, or reset the notes PIN.
export default function PinDialog({ onClose, onUnlocked }: PinDialogProps) {
  const { status, setup, unlock, reset } = useVaultStore();
  const email = useAuthStore((s) => s.authUser?.email ?? "");
  const [mode, setMode] = useState<"pin" | "reset">("pin");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const isSetup = status === "none";

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!PIN_RE.test(pin)) return setError("The PIN is 6 digits");
    if (isSetup && pin !== confirm) return setError("The PINs don't match");
    setBusy(true);
    setError(null);
    const result = isSetup ? await setup(pin, keep) : await unlock(pin, keep);
    setBusy(false);
    if (result.ok) {
      toast.success(isSetup ? "PIN set. Your encrypted notes are ready." : "Unlocked");
      onUnlocked?.();
      onClose();
    } else {
      setPin("");
      setError(untilText(result.lockedUntil) ?? result.message);
    }
  };

  const sendCode = async () => {
    setBusy(true);
    try {
      await api.post("/otp", { email, purpose: "vault_reset" });
      setOtpSent(true);
      toast.success(`Code sent to ${email}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not send the code"));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post<{ verificationToken: string }>("/otp/verify", {
        email,
        purpose: "vault_reset",
        otp,
      });
      const result = await reset(data.verificationToken);
      if (!result.ok) throw new Error(result.message);
      toast.success("PIN removed. Set a new one.");
      setMode("pin");
      setPin("");
      setOtp("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not reset the PIN"));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "reset" ? "vault.reset()" : isSetup ? "vault.setup(pin)" : "vault.unlock(pin)";

  return (
    <Dialog title={title} icon={<KeyRoundIcon className="size-4" />} onClose={onClose} maxWidth="max-w-sm">
      {mode === "pin" ? (
        <form onSubmit={submitPin} className="space-y-3">
          <p className="text-xs tok-com">
            {isSetup
              ? "// choose a 6-digit PIN. It encrypts your notes on this device; the server never sees it."
              : "// enter your notes PIN to decrypt"}
          </p>
          <PinInput value={pin} onChange={setPin} label="PIN" autoFocus />
          {isSetup && <PinInput value={confirm} onChange={setConfirm} label="Confirm PIN" />}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span>
              keepUnlocked<span className="tok-punc">: </span>
              <span className="tok-kw">true</span> <span className="tok-com">{"// 7 days on this device"}</span>
            </span>
          </label>
          {error && <p className="text-xs text-[var(--err)]">{error}</p>}
          {isSetup && (
            <p className="text-[11px] tok-com">
              {"// forget it and notes only you can read are gone for good - nobody can recover them"}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {!isSetup ? (
              <button type="button" className="ide-btn ide-btn-ghost text-xs" onClick={() => setMode("reset")}>
                forgot PIN?
              </button>
            ) : (
              <span />
            )}
            <button type="submit" disabled={busy} className="ide-btn ide-btn-primary">
              {busy ? "deriving key…" : isSetup ? "set PIN" : "unlock"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitReset} className="space-y-3">
          <p className="text-xs tok-com">
            {"// resetting deletes your keys. Notes shared with others come back when an owner/admin opens them; notes only you could read stay encrypted forever."}
          </p>
          {!otpSent ? (
            <button type="button" disabled={busy || !email} onClick={sendCode} className="ide-btn ide-btn-primary w-full">
              email a code to {email}
            </button>
          ) : (
            <>
              <PinInput value={otp} onChange={setOtp} label="Code from the email" autoFocus />
              <button type="submit" disabled={busy || otp.length !== 6} className="ide-btn ide-btn-danger w-full">
                reset PIN
              </button>
            </>
          )}
          <button type="button" className="ide-btn ide-btn-ghost text-xs" onClick={() => setMode("pin")}>
            back
          </button>
        </form>
      )}
    </Dialog>
  );
}
