import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router";
import {
  X,
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

const EMPTY_PIN = ["", "", "", "", "", ""];

const PinPage = ({ isModal }) => {
  const { authUser, themeMode } = useAuthStore();
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
  const isDark = themeMode === "dark";

  useEffect(() => {
    if (step !== "otp" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

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

  const titleText =
    step === "otp"
      ? "Verify Your Email"
      : vaultMode === "loading"
        ? "Checking Your Vault"
        : vaultMode === "offline"
          ? "Vault Unavailable Offline"
          : isSetup
            ? step === "confirm"
              ? "Confirm New PIN"
              : "Set New PIN"
            : "Unlock Vault";

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
              : "Create a 6-digit secure PIN for your vault"
            : "Enter your 6-digit secure PIN to access your encrypted notes";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${isDark ? "bg-slate-900/60" : "bg-white/40"}`}
    >
      <div
        className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl overflow-hidden border ${isDark ? "bg-slate-800 border-slate-700/50" : "bg-white border-gray-200"}`}
      >
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
          <div
            className={`absolute -top-1/2 -left-1/2 w-full h-full rounded-full blur-3xl opacity-20 ${isDark ? "bg-[var(--theme-main)]" : "bg-[var(--theme-main)]"}`}
          />
          <div
            className={`absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-20 ${isDark ? "bg-[var(--theme-accent)]" : "bg-[var(--theme-accent)]"}`}
          />
        </div>

        {isModal && (
          <button
            onClick={handleClose}
            className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <X size={20} />
          </button>
        )}

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full theme-bg-glass flex items-center justify-center mb-4 shadow-lg border border-white/10">
            {step === "otp" ? (
              <ShieldCheck className="w-8 h-8 text-white" />
            ) : (
              <Lock className="w-8 h-8 text-white" />
            )}
          </div>
          <h2
            className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {titleText}
          </h2>
          <p
            className={`text-sm text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {subtitleText}
          </p>
        </div>

        {isSetup && step !== "otp" && (
          <div
            className={`flex items-start gap-3 mb-6 p-4 rounded-xl border ${
              isDark
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-amber-50 border-amber-300 text-amber-700"
            }`}
          >
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm leading-snug">
              <span className="font-semibold">Warning:</span> once set, this PIN
              cannot be reset or recovered. Losing it means losing access to
              your encrypted notes. Please remember it carefully.
            </p>
          </div>
        )}

        {vaultMode === "offline" && step !== "otp" && (
          <div
            className={`flex items-start gap-3 mb-6 p-4 rounded-xl border ${
              isDark
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-rose-50 border-rose-300 text-rose-700"
            }`}
          >
            <WifiOff size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm leading-snug">
              We need the internet once to check whether this account already
              has a PIN - guessing could lock you out of your notes. This screen
              recovers on its own as soon as you're back online.
            </p>
          </div>
        )}

        {step === "otp" ? (
          <form
            onSubmit={handleVerifyOtp}
            className="flex flex-col items-center"
          >
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
              placeholder="6-digit code"
              className={`w-full mb-6 text-center text-2xl tracking-widest font-bold rounded-xl py-4 outline-none border-2 transition-all
                ${isDark ? "bg-slate-900/50 text-white focus:border-[var(--theme-main)] border-slate-700 shadow-inner" : "bg-gray-50 text-gray-900 focus:border-[var(--theme-main)] border-gray-200 shadow-inner"}
              `}
            />

            <button
              type="submit"
              disabled={isVerifyingOtp || otp.length !== 6}
              className="w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 theme-button disabled:opacity-60 disabled:pointer-events-none"
            >
              <ShieldCheck size={20} />
              {isVerifyingOtp ? "Verifying..." : "Verify & Secure Vault"}
            </button>

            <div className="text-center mt-4 text-sm">
              {resendTimer > 0 ? (
                <p className={isDark ? "text-slate-400" : "text-gray-500"}>
                  Resend OTP in{" "}
                  <span className="font-medium theme-text">
                    {Math.floor(resendTimer / 60)}:
                    {(resendTimer % 60).toString().padStart(2, "0")}
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isSendingOtp}
                  className="theme-text font-medium disabled:opacity-50"
                >
                  {isSendingOtp ? "Sending..." : "Resend OTP"}
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col items-center">
            <div className="flex gap-2 sm:gap-3 mb-8 w-full justify-center">
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleChange(index, e)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={vaultMode === "loading" || isVerifying}
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl transition-all outline-none border-2
                    ${isDark ? "bg-slate-900/50 text-white focus:border-[var(--theme-main)] border-slate-700 shadow-inner" : "bg-gray-50 text-gray-900 focus:border-[var(--theme-main)] border-gray-200 shadow-inner"}
                    ${digit ? "border-[var(--theme-main)] ring-2 ring-[var(--theme-main)]/20" : ""}
                  `}
                />
              ))}
            </div>

            <div className="flex items-center justify-between w-full mb-8">
              <label
                className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={rememberMe}
                    onChange={() => setRememberMe(!rememberMe)}
                  />
                  <div
                    className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center
                    ${rememberMe ? "border-[var(--theme-main)] bg-[var(--theme-main)]" : isDark ? "border-slate-600 bg-slate-900" : "border-gray-300 bg-white"}
                  `}
                  >
                    {rememberMe && (
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                </div>
                Keep me unlocked for 7 days
              </label>
            </div>

            <button
              type="submit"
              disabled={
                isSendingOtp ||
                isVerifying ||
                vaultMode === "loading" ||
                vaultMode === "offline"
              }
              className="w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 theme-button disabled:opacity-60 disabled:pointer-events-none"
            >
              <KeyRound size={20} />
              {vaultMode === "loading"
                ? "Checking vault..."
                : vaultMode === "offline"
                  ? "Waiting for connection..."
                  : isVerifying
                    ? "Verifying..."
                    : isSendingOtp
                      ? "Sending code..."
                      : isSetup
                        ? step === "confirm"
                          ? "Confirm & Secure"
                          : "Continue"
                        : "Unlock Now"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PinPage;

