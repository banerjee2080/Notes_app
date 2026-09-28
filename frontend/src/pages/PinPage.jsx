import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router";
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { markPinConfigured, saveVaultKey } from "../lib/db.js";
import { deriveKeyFromPin } from "../lib/crypto.js";
import {
  getVaultMode,
  verifyPinKey,
  establishVaultCheck,
  VaultAlreadySetError,
} from "../lib/vault.js";
import { triggerSync } from "../lib/syncEngine.js";
import { useOnlineStatus } from "../hooks/useOnlineStatus.js";
import api from "../lib/axios.js";
import Dialog from "../components/ui/Dialog.jsx";
import RememberToggle from "../components/ui/RememberToggle.jsx";

const EMPTY_PIN = ["", "", "", "", "", ""];

const PinPage = ({ isModal }) => {
  const { authUser } = useAuthStore();
  const userId = authUser?._id || authUser?.id;
  const isOnline = useOnlineStatus();

  const [pinDigits, setPinDigits] = useState(EMPTY_PIN);
  const [rememberMe, setRememberMe] = useState(false);

  // "loading" | "setup" | "unlock" | "offline"
  const [vaultMode, setVaultMode] = useState("loading");
  const isSetup = vaultMode === "setup";
  const [isVerifying, setIsVerifying] = useState(false);

  const [step, setStep] = useState("enter"); // enter -> confirm -> otp (setup only)
  const [firstPin, setFirstPin] = useState("");

  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);
  const otpInputRef = useRef(null);

  useEffect(() => {
    // vaultMode is a dependency so focus lands once the inputs stop being
    // disabled (they're disabled while the vault state is "loading").
    if (step !== "otp" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step, vaultMode]);

  useEffect(() => {
    if (step === "otp" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Decide setup vs unlock from positive evidence only (see lib/vault.js).
  // Re-runs when connectivity changes, so an "offline" screen recovers by itself.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    setVaultMode("loading");
    getVaultMode(userId)
      .then((mode) => {
        if (!cancelled) setVaultMode(mode);
      })
      .catch((err) => {
        console.error("Could not determine vault state", err);
        if (!cancelled) setVaultMode("offline");
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isOnline]);

  const resetPinEntry = () => {
    setPinDigits(EMPTY_PIN);
    inputRefs.current[0]?.focus();
  };

  const goBack = () => {
    const bgLocation = isModal ? location.state?.backgroundLocation : null;
    if (bgLocation) {
      navigate(bgLocation.pathname + (bgLocation.search || ""), {
        replace: true,
      });
    } else {
      navigate("/");
    }
  };

  const handleChange = (index, e) => {
    const value = e.target.value;
    if (isNaN(value)) return;
    const newPinDigits = [...pinDigits];

    // Allow pasting
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("");
      for (let i = 0; i < pasted.length; i++) {
        if (!isNaN(pasted[i])) {
          newPinDigits[i] = pasted[i];
        }
      }
      setPinDigits(newPinDigits);
      const nextIndex = Math.min(pasted.length, 5);
      if (inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex].focus();
      } else if (inputRefs.current[5]) {
        inputRefs.current[5].focus();
      }
      return;
    }

    newPinDigits[index] = value.slice(-1);
    setPinDigits(newPinDigits);

    // Move to next input
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && pinDigits[index] === "" && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const finalizePin = async (pinToUse, uid) => {
    try {
      const key = await deriveKeyFromPin(pinToUse, uid);
      await establishVaultCheck(uid, key);

      useAuthStore.setState({ cryptoKey: key });
      await markPinConfigured(uid);
      if (rememberMe) {
        await saveVaultKey(uid, key);
      }

      toast.success("PIN Set Successfully!");
      goBack();
    } catch (err) {
      if (err instanceof VaultAlreadySetError) {
        toast.error(
          "A PIN was already set for this account. Enter that PIN to unlock.",
        );
        setVaultMode("unlock");
      } else {
        console.error("Error finalizing PIN setup", err);
        toast.error(
          "Couldn't save your PIN. Check your connection and try again.",
        );
      }
      setStep("enter");
      setFirstPin("");
      resetPinEntry();
    }
  };

  const sendSetupOtp = async () => {
    if (!authUser?.email) {
      toast.error("No account email found for verification");
      return;
    }
    setIsSendingOtp(true);
    try {
      await api.post("/otp", { email: authUser.email, purpose: "pin_setup" });
      setStep("otp");
      setOtp("");
      setResendTimer(60);
      setResendCount(0);
      toast.success("OTP sent to your email");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!authUser?.email) return;
    setIsSendingOtp(true);
    try {
      await api.post("/otp", { email: authUser.email, purpose: "pin_setup" });
      const nextCount = resendCount + 1;
      setResendTimer(60 + nextCount * 120);
      setResendCount(nextCount);
      toast.success("OTP resent to your email");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!userId) return toast.error("Please login first");
    if (otp.length !== 6 || isNaN(otp)) {
      return toast.error("Please enter a valid 6-digit OTP");
    }

    setIsVerifyingOtp(true);
    try {
      await api.post("/otp/verify", {
        email: authUser.email,
        otp,
        purpose: "pin_setup",
      });
      await finalizePin(firstPin, userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (vaultMode === "loading" || isVerifying) return;
    if (vaultMode === "offline") {
      return toast.error(
        "Connect to the internet once so we can verify your vault.",
      );
    }

    const enteredPin = pinDigits.join("");
    if (enteredPin.length !== 6 || isNaN(enteredPin)) {
      return toast.error("Please enter a valid 6-digit numerical PIN");
    }
    if (!userId) {
      return toast.error("Please login first");
    }

    // Handle First-Time PIN Setup
    if (isSetup) {
      if (step === "enter") {
        setFirstPin(enteredPin);
        setStep("confirm");
        resetPinEntry();
        return;
      } else if (step === "confirm") {
        if (enteredPin !== firstPin) {
          toast.error("PINs do not match. Please try again.");
          setStep("enter");
          setFirstPin("");
          resetPinEntry();
          return;
        }
        // PINs match - verify email ownership via OTP before securing the vault.
        await sendSetupOtp();
        return;
      }
    }

    // Unlock: derive, PROVE, and only then install the key.
    setIsVerifying(true);
    try {
      const key = await deriveKeyFromPin(enteredPin, userId);
      const result = await verifyPinKey(userId, key);

      if (!result.ok) {
        if (result.reason === "wrong_pin") {
          toast.error("Incorrect PIN");
        } else if (navigator.onLine) {
          toast.error("Your notes are still syncing. Try again in a moment.");
          triggerSync(userId);
        } else {
          toast.error(
            "Connect to the internet once so we can verify your PIN.",
          );
        }
        resetPinEntry();
        return;
      }

      useAuthStore.setState({ cryptoKey: key });
      await markPinConfigured(userId);
      if (rememberMe) {
        await saveVaultKey(userId, key);
      }

      toast.success("Vault Unlocked!");
      goBack();
    } catch (err) {
      console.error("Error in handleSubmit", err);
      toast.error("Something went wrong");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = goBack;

  // Dialog title bar reads like a call; the heading underneath says it plainly.
  const callText =
    step === "otp"
      ? "await verify(otp)"
      : vaultMode === "loading"
        ? "await vault.status()"
        : vaultMode === "offline"
          ? "NetworkError: vault unreachable"
          : isSetup
            ? step === "confirm"
              ? "vault.setup(pin) // confirm"
              : "vault.setup(pin)"
            : "vault.unlock(pin)";

  const titleText =
    step === "otp"
      ? "Verify your email"
      : vaultMode === "loading"
        ? "Checking your vault"
        : vaultMode === "offline"
          ? "Vault unavailable offline"
          : isSetup
            ? step === "confirm"
              ? "Confirm new PIN"
              : "Set a new PIN"
            : "Unlock your vault";

  const subtitleText =
    step === "otp"
      ? `Enter the 6-digit code sent to ${authUser?.email || "your email"}`
      : vaultMode === "loading"
        ? "One moment while we check this account for an existing vault"
        : vaultMode === "offline"
          ? "We can't confirm your vault state while you're offline"
          : isSetup
            ? step === "confirm"
              ? "Re-enter your PIN to confirm"
              : "Create a 6-digit PIN. It derives the key that encrypts your notes."
            : "Enter your 6-digit PIN to decrypt your notes";

  return (
    <Dialog
      onClose={isModal ? handleClose : undefined}
      closeOnBackdrop={false}
      tone={vaultMode === "offline" && step !== "otp" ? "error" : "default"}
      title={callText}
      icon={
        vaultMode === "offline" && step !== "otp" ? (
          <WifiOff className="size-4 shrink-0" />
        ) : step === "otp" ? (
          <ShieldCheck className="size-4 shrink-0 tok-ok" />
        ) : (
          <Lock className="size-4 shrink-0 tok-kw" />
        )
      }
    >
      <div className="flex flex-col items-center text-center mb-6">
        <div className="relative mb-4">
          <div className="size-14 rounded-xl border ide-divider bg-[var(--panel)] flex items-center justify-center">
            {step === "otp" ? (
              <ShieldCheck className="size-7 tok-ok" />
            ) : (
              <KeyRound className="size-7 tok-kw" />
            )}
          </div>
          <span className="js-badge absolute -bottom-1.5 -right-1.5 w-6 h-6 text-[10px]">JS</span>
        </div>
        <h2 className="text-lg font-semibold text-[var(--fg)] mb-1">{titleText}</h2>
        <p className="text-[12.5px] tok-com">{"// "}{subtitleText}</p>
      </div>

      {isSetup && step !== "otp" && (
        <div className="ide-note is-warn mb-5 flex items-start gap-2 text-left">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 tok-warn" />
          <p>
            <span className="tok-warn font-semibold">WARNING:</span>{" "}
            <span className="text-[var(--fg)]">
              once set, this PIN can't be reset or recovered. Losing it means losing access to your
              encrypted notes.
            </span>
          </p>
        </div>
      )}

      {vaultMode === "offline" && step !== "otp" && (
        <div className="ide-note is-err mb-5 flex items-start gap-2 text-left">
          <WifiOff size={16} className="shrink-0 mt-0.5 tok-err" />
          <p className="text-[var(--fg)]">
            We need the internet once to check whether this account already has a PIN — guessing
            could lock you out of your notes. This screen recovers on its own as soon as you're
            back online.
          </p>
        </div>
      )}

      {step === "otp" ? (
        <form onSubmit={handleVerifyOtp} className="flex flex-col items-center">
          <input
            ref={otpInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              if (!isNaN(e.target.value)) setOtp(e.target.value.slice(0, 6));
            }}
            placeholder="000000"
            aria-label="One-time code"
            className="ide-input mb-5 text-center !text-2xl tracking-[0.5em] font-bold tok-str !py-3"
          />

          <button
            type="submit"
            disabled={isVerifyingOtp || otp.length !== 6}
            className="ide-btn ide-btn-ok w-full justify-center !py-2.5"
          >
            <ShieldCheck size={16} />
            {isVerifyingOtp ? "verifying…" : "verify(otp) && vault.lock();"}
          </button>

          <div className="text-center mt-4 text-[12.5px]">
            {resendTimer > 0 ? (
              <p className="tok-dim">
                <span className="tok-fn">setTimeout</span>
                <span className="tok-punc">(</span>resend<span className="tok-punc">, </span>
                <span className="tok-num">
                  {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, "0")}
                </span>
                <span className="tok-punc">)</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSendingOtp}
                className="tok-fn hover:underline disabled:opacity-50"
              >
                {isSendingOtp ? "sending…" : "resendOtp()"}
              </button>
            )}
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <div className="flex gap-1.5 sm:gap-2 mb-6 w-full justify-center">
            {pinDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={digit}
                aria-label={`PIN digit ${index + 1}`}
                onChange={(e) => handleChange(index, e)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={vaultMode === "loading" || isVerifying}
                className={`ide-digit ${digit ? "is-filled" : ""} disabled:opacity-50`}
              />
            ))}
          </div>

          <div className="w-full mb-6 text-left">
            <RememberToggle checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
          </div>

          <button
            type="submit"
            disabled={
              isSendingOtp ||
              isVerifying ||
              vaultMode === "loading" ||
              vaultMode === "offline"
            }
            className="ide-btn ide-btn-solid w-full justify-center !py-2.5"
          >
            <KeyRound size={16} />
            {vaultMode === "loading"
              ? "checking vault…"
              : vaultMode === "offline"
                ? "await navigator.onLine…"
                : isVerifying
                  ? "deriving key…"
                  : isSendingOtp
                    ? "sending code…"
                    : isSetup
                      ? step === "confirm"
                        ? "confirm & secure"
                        : "continue()"
                      : "vault.unlock(pin);"}
          </button>
        </form>
      )}
    </Dialog>
  );
};

export default PinPage;
