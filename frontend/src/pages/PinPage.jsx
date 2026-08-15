import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";
import { useNavigate, useLocation } from "react-router";
import { X, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { localDB, isPinConfigured, markPinConfigured } from "../lib/db.js";
import { decryptData } from "../lib/crypto.js";
import api from "../lib/axios.js";

const PinPage = ({ isModal }) => {
  const { authUser, initCryptoKey, themeMode } = useAuthStore();
  const [pinDigits, setPinDigits] = useState(["", "", "", "", "", ""]);
  const [rememberMe, setRememberMe] = useState(false);

  const [isSetup, setIsSetup] = useState(false);
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

  useEffect(() => {
    // Determine whether this user has ever completed PIN setup on this device.
    // We rely on a locally persisted flag rather than the presence of an
    // encrypted note, because that flag survives reloads/tab closes even
    // before any note has been created or synced locally - avoiding a false
    // "first time setup" prompt that would silently derive a new, mismatched
    // encryption key.
    const checkSetup = async () => {
      const userId = authUser?._id || authUser?.id;
      if (!userId) return;

      const configured = await isPinConfigured(userId);
      if (configured) {
        setIsSetup(false);
        return;
      }

      // Fallback for a fresh device/browser: if an encrypted note has already
      // synced down from the server, a PIN was clearly set elsewhere.
      const notes = await localDB.notes.where("user_id").equals(userId).toArray();
      const validNote = notes.find((n) => !!n.iv_content);
      if (validNote) {
        await markPinConfigured(userId);
        setIsSetup(false);
        return;
      }

      setIsSetup(true);
    };
    checkSetup();
  }, [authUser]);

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

  const finalizePin = async (pinToUse, userId) => {
    try {
      const key = await initCryptoKey(pinToUse, userId);

      if (!key) {
        toast.error("Failed to initialize encryption key. Incorrect PIN?");
        setPinDigits(["", "", "", "", "", ""]);
        setStep("enter");
        setFirstPin("");
        if (inputRefs.current[0]) inputRefs.current[0].focus();
        return;
      }

      await markPinConfigured(userId);

      if (rememberMe) {
        const expiry = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem("pin", JSON.stringify({ value: pinToUse, expiry }));
      }

      toast.success("PIN Set Successfully!");

      if (isModal) {
        const bgLocation = location.state?.backgroundLocation;
        if (bgLocation) {
          navigate(bgLocation.pathname + (bgLocation.search || ""), { replace: true });
        } else {
          navigate("/");
        }
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Error finalizing PIN setup", err);
      toast.error("Something went wrong");
    }
  };

  const sendSetupOtp = async () => {
    if (!authUser?.email) {
      toast.error("No account email found for verification");
      return;
    }
    setIsSendingOtp(true);
    try {
      await api.post("/otp", { email: authUser.email });
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
      await api.post("/otp", { email: authUser.email });
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
    const userId = authUser?._id || authUser?.id;
    if (!userId) return toast.error("Please login first");
    if (otp.length !== 6 || isNaN(otp)) {
      return toast.error("Please enter a valid 6-digit OTP");
    }

    setIsVerifyingOtp(true);
    try {
      await api.post("/otp/verify", { email: authUser.email, otp });
      await finalizePin(firstPin, userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const enteredPin = pinDigits.join("");
    if (enteredPin.length !== 6 || isNaN(enteredPin)) {
      return toast.error("Please enter a valid 6-digit numerical PIN");
    }
    const userId = authUser?._id || authUser?.id;
    if (!userId) {
      return toast.error("Please login first");
    }

    // Handle First-Time PIN Setup
    if (isSetup) {
      if (step === "enter") {
        setFirstPin(enteredPin);
        setStep("confirm");
        setPinDigits(["", "", "", "", "", ""]);
        if (inputRefs.current[0]) inputRefs.current[0].focus();
        return;
      } else if (step === "confirm") {
        if (enteredPin !== firstPin) {
          toast.error("PINs do not match. Please try again.");
          setStep("enter");
          setFirstPin("");
          setPinDigits(["", "", "", "", "", ""]);
          if (inputRefs.current[0]) inputRefs.current[0].focus();
          return;
        }
        // PINs match - verify email ownership via OTP before securing the vault.
        await sendSetupOtp();
        return;
      }
    }

    try {
      const key = await initCryptoKey(enteredPin, userId);

      if (key) {
        // Client-side verification against an existing note
        const notes = await localDB.notes.where("user_id").equals(userId).toArray();
        const noteToVerify = notes.find((n) => !!n.iv_content);

        if (noteToVerify) {
          try {
            await decryptData(noteToVerify.content, noteToVerify.iv_content, key);
          } catch (err) {
            console.error("PIN verification failed", err);
            toast.error("Incorrect PIN");
            setPinDigits(["", "", "", "", "", ""]);
            if (inputRefs.current[0]) inputRefs.current[0].focus();
            useAuthStore.setState({ cryptoKey: null, pin: null });
            return;
          }
        }

        if (rememberMe) {
          const expiry = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
          localStorage.setItem("pin", JSON.stringify({ value: enteredPin, expiry }));
        }

        toast.success("Vault Unlocked!");

        if (isModal) {
          const bgLocation = location.state?.backgroundLocation;
          if (bgLocation) {
            navigate(bgLocation.pathname + (bgLocation.search || ""), { replace: true });
          } else {
            navigate("/");
          }
        } else {
          navigate("/");
        }
      } else {
        toast.error("Failed to initialize encryption key. Incorrect PIN?");
        setPinDigits(["", "", "", "", "", ""]);
        if (inputRefs.current[0]) inputRefs.current[0].focus();
      }
    } catch (err) {
      console.error("Error in handleSubmit", err);
      toast.error("Something went wrong");
    }
  };

  const handleClose = () => {
    const bgLocation = location.state?.backgroundLocation;
    if (bgLocation) {
      navigate(bgLocation.pathname + (bgLocation.search || ""), { replace: true });
    } else {
      navigate("/");
    }
  };

  const titleText =
    step === "otp"
      ? "Verify Your Email"
      : isSetup
        ? step === "confirm"
          ? "Confirm New PIN"
          : "Set New PIN"
        : "Unlock Vault";

  const subtitleText =
    step === "otp"
      ? `Enter the 6-digit code sent to ${authUser?.email || "your email"}`
      : isSetup
        ? step === "confirm"
          ? "Re-enter your PIN to confirm"
          : "Create a 6-digit secure PIN for your vault"
        : "Enter your 6-digit secure PIN to access your encrypted notes";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md ${isDark ? "bg-slate-900/60" : "bg-white/40"}`}>
      <div className={`relative w-full max-w-md p-8 rounded-3xl shadow-2xl overflow-hidden border ${isDark ? "bg-slate-800 border-slate-700/50" : "bg-white border-gray-200"}`}>

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
           <div className={`absolute -top-1/2 -left-1/2 w-full h-full rounded-full blur-3xl opacity-20 ${isDark ? 'bg-[var(--theme-main)]' : 'bg-[var(--theme-main)]'}`} />
           <div className={`absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-20 ${isDark ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-accent)]'}`} />
        </div>

        {isModal && (
          <button onClick={handleClose} className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isDark ? "hover:bg-slate-700 text-slate-400" : "hover:bg-gray-100 text-gray-500"}`}>
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
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
            {titleText}
          </h2>
          <p className={`text-sm text-center ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            {subtitleText}
          </p>
        </div>

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
                    {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, "0")}
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
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold rounded-xl transition-all outline-none border-2
                    ${isDark ? "bg-slate-900/50 text-white focus:border-[var(--theme-main)] border-slate-700 shadow-inner" : "bg-gray-50 text-gray-900 focus:border-[var(--theme-main)] border-gray-200 shadow-inner"}
                    ${digit ? "border-[var(--theme-main)] ring-2 ring-[var(--theme-main)]/20" : ""}
                  `}
                />
              ))}
            </div>

            <div className="flex items-center justify-between w-full mb-8">
              <label className={`flex items-center gap-2 cursor-pointer select-none text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                <div className="relative flex items-center">
                  <input type="checkbox" className="peer sr-only" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} />
                  <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center
                    ${rememberMe ? "border-[var(--theme-main)] bg-[var(--theme-main)]" : isDark ? "border-slate-600 bg-slate-900" : "border-gray-300 bg-white"}
                  `}>
                    {rememberMe && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </div>
                Keep me unlocked for 7 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isSendingOtp}
              className="w-full py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 theme-button disabled:opacity-60 disabled:pointer-events-none"
            >
              <KeyRound size={20} />
              {isSendingOtp
                ? "Sending code..."
                : isSetup
                  ? (step === "confirm" ? "Confirm & Secure" : "Continue")
                  : "Unlock Now"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default PinPage;
