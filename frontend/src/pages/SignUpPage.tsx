import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import toast from "react-hot-toast";
import { Link } from "react-router";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import AuthFrame, { AuthHeading, CodeField, GoogleGlyph } from "../components/ui/AuthFrame";
import { useCopy } from "../lib/voice";
import api from "../lib/axios";
import { errorMessage, errorStatus, errorBody } from "../lib/errors";

/** The sign-up form, before it becomes a SignupPayload. */
interface SignUpForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Which of the two password fields a row is editing. */
type PasswordField = "password" | "confirmPassword";

const SignUpPage = () => {
  const { isJs, t } = useCopy();
  const [formData, setFromData] = useState<SignUpForm>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [takeOtp, setTakeOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const { isSigningUp, signup, googleLogin } = useAuthStore();

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      await googleLogin(codeResponse.access_token);
    },
    onError: (error) => {
      console.log("Google Login Failed:", error);
      toast.error("Google Sign Up was unsuccessful");
    },
  });

  const validateForm = () => {
    if (!formData.fullName.trim()) return toast.error("Full name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(formData.email))
      return toast.error("Invalid email format");
    if (!formData.password) return toast.error("Password is required");
    if (formData.password.length < 6)
      return toast.error("Password must be at least 6 characters");
    if (formData.password !== formData.confirmPassword)
      return toast.error("Passwords do not match");

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = validateForm();
    if (success) {
      setIsSendingOtp(true);
      try {
        await api.post("/otp", {
          email: formData.email,
        });
        setTakeOtp(true);
        setResendTimer(60);
        setResendCount(0);
        toast.success("OTP sent to your email");
      } catch (error) {
        if (errorStatus(error) === 429) {
          const secs = errorBody(error)?.retryAfterSeconds || 3600;
          setResendTimer(secs);
          toast.error(
            errorMessage(
              error,
              `Too many requests. Try again in ${Math.ceil(secs / 60)} minute(s).`,
            ),
          );
        } else {
          toast.error(errorMessage(error, "Failed to send OTP"));
        }
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  const handleResendOtp = async () => {
    setIsSendingOtp(true);
    try {
      await api.post("/otp", { email: formData.email });

      const nextCount = resendCount + 1;
      const waitTimeInSeconds = 60 + nextCount * 120;

      setResendTimer(waitTimeInSeconds);
      setResendCount(nextCount);
      toast.success("OTP resent to your email");
    } catch (error) {
      if (errorStatus(error) === 429) {
        const secs = errorBody(error)?.retryAfterSeconds || 3600;
        setResendTimer(secs);
        toast.error(
          errorMessage(
            error,
            `Too many requests. Try again in ${Math.ceil(secs / 60)} minute(s).`,
          ),
        );
      } else {
        toast.error(errorMessage(error, "Failed to send OTP"));
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingOtp(true);
    try {
      const res = await api.post<{ verificationToken?: string }>(
        "/otp/verify",
        {
          email: formData.email,
          otp,
          purpose: "signup",
        },
      );

      if (!res.data?.verificationToken) {
        toast.error("Verification failed. Please try again.");
        return;
      }

      toast.success("OTP verified successfully");

      await signup({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        verificationToken: res.data.verificationToken,
      });
    } catch (error) {
      toast.error(errorMessage(error, "Invalid OTP"));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const passwordInput = (
    value: string,
    key: PasswordField,
    show: boolean,
    setShow: (show: boolean) => void,
    placeholder: string,
    autoComplete: string,
  ): ReactNode => (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        className="ide-input !pl-9 !pr-10"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => setFromData({ ...formData, [key]: e.target.value })}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );

  return (
    <AuthFrame
      fileName={
        takeOtp
          ? t({ js: "verify.js", common: "Check your email", pythagoras: "The oath" })
          : t({ js: "signup.js", common: "Create account", pythagoras: "Join the school" })
      }
    >
      {!takeOtp ? (
        <>
          <AuthHeading
            js={
              <>
                <h1 className="text-xl mb-1">
                  <span className="tok-kw">async function</span> <span className="tok-fn">signup</span>
                  <span className="tok-punc">() {"{"}</span>
                </h1>
                <p className="text-[12.5px] tok-com mb-6">{"// create an account — your notes sync across your devices"}</p>
              </>
            }
            title={t({ js: "", common: "Create your account", pythagoras: "Join the mathematikoi" })}
            sub={t({
              js: "",
              common: "Your notes will sync across all your devices.",
              pythagoras: "The Pythagoreans who studied, rather than only listened, were the mathematikoi, “those who learn”.",
            })}
          />

          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="ide-btn w-full justify-center !py-2.5 mb-5"
          >
            <GoogleGlyph />
            {isJs ? (
              <span>
                <span className="tok-fn">signUpWith</span>
                <span className="tok-punc">(</span>Google<span className="tok-punc">)</span>
              </span>
            ) : (
              <span>Sign up with Google</span>
            )}
          </button>

          <div className="flex items-center gap-3 mb-5 text-[11px] tok-dim">
            <span className="flex-1 border-t ide-divider" />
            {isJs ? "// or" : "or"}
            <span className="flex-1 border-t ide-divider" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <CodeField kw="let" name="fullName" label="Full name">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
                <input
                  type="text"
                  placeholder={isJs ? "'Ada Lovelace'" : t({ js: "", common: "Ada Lovelace", pythagoras: "Theano of Croton" })}
                  className="ide-input !pl-9"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={(e) => setFromData({ ...formData, fullName: e.target.value })}
                />
              </div>
            </CodeField>

            <CodeField kw="let" name="email" label="Email">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
                <input
                  type="email"
                  placeholder={isJs ? "'you@example.com'" : "you@example.com"}
                  className="ide-input !pl-9"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFromData({ ...formData, email: e.target.value })}
                />
              </div>
            </CodeField>

            <CodeField kw="let" name="password" label="Password">
              {passwordInput(formData.password, "password", showPassword, setShowPassword, isJs ? "'at least 6 chars'" : "At least 6 characters", "new-password")}
            </CodeField>

            <CodeField kw="let" name="confirmPassword" label="Confirm password">
              {passwordInput(
                formData.confirmPassword,
                "confirmPassword",
                showConfirmPassword,
                setShowConfirmPassword,
                isJs ? "'same again'" : "Same again",
                "new-password",
              )}
            </CodeField>

            <button
              type="submit"
              className="ide-btn ide-btn-solid w-full justify-center !py-2.5 mt-2"
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t({ js: "await sendOtp(email)…", common: "Sending code…" })}
                </>
              ) : (
                t({ js: "await sendOtp(email);", common: "Continue", pythagoras: "Take the oath" })
              )}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-5">
          <button
            type="button"
            onClick={() => setTakeOtp(false)}
            className="ide-btn ide-btn-ghost !px-2 !py-1 text-xs -ml-2"
          >
            <ArrowLeft className="size-3.5" />
            {t({ js: "history.back()", common: "Back" })}
          </button>

          {isJs ? (
            <div>
              <h1 className="text-xl mb-1">
                <span className="tok-kw">await</span> <span className="tok-fn">verify</span>
                <span className="tok-punc">(</span>otp<span className="tok-punc">)</span>
              </h1>
              <p className="text-[12.5px] tok-com">
                {"// we sent a 6-digit code to "}
                <span className="tok-str not-italic">"{formData.email}"</span>
              </p>
            </div>
          ) : (
            <div>
              <h1 className="text-[26px] font-semibold leading-tight mb-1" style={{ fontFamily: "var(--font-content)" }}>
                {t({ js: "", common: "Check your email", pythagoras: "Your oath, by email" })}
              </h1>
              <p className="text-[14px] tok-dim">
                We sent a 6-digit code to <span className="text-[var(--fg)] font-medium">{formData.email}</span>
              </p>
            </div>
          )}

          <CodeField kw="const" name="otp" label="Code">
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                className="ide-input !pl-9 text-center tracking-[0.5em] !text-lg tok-str"
                onChange={(e) => setOtp(e.target.value)}
                value={otp}
              />
            </div>
          </CodeField>

          <button
            type="submit"
            className="ide-btn ide-btn-solid w-full justify-center !py-2.5"
            disabled={isVerifyingOtp || isSigningUp || otp.length < 6}
          >
            {isVerifyingOtp || isSigningUp ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isSigningUp
                  ? t({ js: "creating account…", common: "Creating account…" })
                  : t({ js: "verifying…", common: "Verifying…" })}
              </>
            ) : (
              t({ js: "verify(otp);", common: "Verify", pythagoras: "Swear it" })
            )}
          </button>

          <div className="text-center text-[12.5px]">
            {resendTimer > 0 ? (
              isJs ? (
                <p className="tok-dim">
                  <span className="tok-fn">setTimeout</span>
                  <span className="tok-punc">(</span>resend<span className="tok-punc">, </span>
                  <span className="tok-num">
                    {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, "0")}
                  </span>
                  <span className="tok-punc">)</span>
                </p>
              ) : (
                <p className="tok-dim">
                  Resend the code in{" "}
                  <span className="tabular-nums text-[var(--fg)]">
                    {Math.floor(resendTimer / 60)}:{(resendTimer % 60).toString().padStart(2, "0")}
                  </span>
                </p>
              )
            ) : (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isSendingOtp}
                className="tok-fn hover:underline disabled:opacity-50"
              >
                {isSendingOtp
                  ? t({ js: "sending…", common: "Sending…" })
                  : t({ js: "resendOtp()", common: "Resend code" })}
              </button>
            )}
          </div>
        </form>
      )}

      {!takeOtp && isJs && <p className="text-lg tok-punc mt-5">{"}"}</p>}

      <p className="text-[12.5px] text-center mt-4 tok-dim">
        {t({ js: "// already have an account? ", common: "Already have an account? ", pythagoras: "Already a student? " })}
        <Link to="/login" className="tok-fn hover:underline">
          {t({ js: "login()", common: "Sign in", pythagoras: "Enter the Academy" })}
        </Link>
      </p>
    </AuthFrame>
  );
};

export default SignUpPage;
