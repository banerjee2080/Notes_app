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
import AuthFrame, { CodeField, GoogleGlyph } from "../components/ui/AuthFrame";
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
    <AuthFrame fileName={takeOtp ? "verify.js" : "signup.js"}>
      {!takeOtp ? (
        <>
          <h1 className="text-xl mb-1">
            <span className="tok-kw">async function</span> <span className="tok-fn">signup</span>
            <span className="tok-punc">() {"{"}</span>
          </h1>
          <p className="text-[12.5px] tok-com mb-6">{"// create an account — your notes sync across your devices"}</p>

          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            className="ide-btn w-full justify-center !py-2.5 mb-5"
          >
            <GoogleGlyph />
            <span>
              <span className="tok-fn">signUpWith</span>
              <span className="tok-punc">(</span>Google<span className="tok-punc">)</span>
            </span>
          </button>

          <div className="flex items-center gap-3 mb-5 text-[11px] tok-dim">
            <span className="flex-1 border-t ide-divider" />
            {"// or"}
            <span className="flex-1 border-t ide-divider" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <CodeField kw="let" name="fullName">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
                <input
                  type="text"
                  placeholder="'Ada Lovelace'"
                  className="ide-input !pl-9"
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={(e) => setFromData({ ...formData, fullName: e.target.value })}
                />
              </div>
            </CodeField>

            <CodeField kw="let" name="email">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
                <input
                  type="email"
                  placeholder="'you@example.com'"
                  className="ide-input !pl-9"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFromData({ ...formData, email: e.target.value })}
                />
              </div>
            </CodeField>

            <CodeField kw="let" name="password">
              {passwordInput(formData.password, "password", showPassword, setShowPassword, "'at least 6 chars'", "new-password")}
            </CodeField>

            <CodeField kw="let" name="confirmPassword">
              {passwordInput(
                formData.confirmPassword,
                "confirmPassword",
                showConfirmPassword,
                setShowConfirmPassword,
                "'same again'",
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
                  await sendOtp(email)…
                </>
              ) : (
                "await sendOtp(email);"
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
            history.back()
          </button>

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

          <CodeField kw="const" name="otp">
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
                {isSigningUp ? "creating account…" : "verifying…"}
              </>
            ) : (
              "verify(otp);"
            )}
          </button>

          <div className="text-center text-[12.5px]">
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
      )}

      {!takeOtp && <p className="text-lg tok-punc mt-5">{"}"}</p>}

      <p className="text-[12.5px] text-center mt-4 tok-dim">
        {"// already have an account? "}
        <Link to="/login" className="tok-fn hover:underline">
          login()
        </Link>
      </p>
    </AuthFrame>
  );
};

export default SignUpPage;
