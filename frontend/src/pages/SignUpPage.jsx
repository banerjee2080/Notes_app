import { useState } from "react";
import { useAuthStore } from "../stores/useAuthStore.js";
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
import sendMail from "../lib/sendMail.js";
import { useGoogleLogin } from "@react-oauth/google";

const SignUpPage = () => {
  const [formData, setFromData] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [takeOtp, setTakeOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [sentOtp, setSentOtp] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const { isSigningUp, signup, googleLogin } = useAuthStore();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => {
      googleLogin(codeResponse.access_token);
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

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = validateForm();
    if (success) {
      setIsSendingOtp(true);
      const generatedOtp = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();
      setSentOtp(generatedOtp);

      const emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">Use the OTP below to complete your sign-up process.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 30px;">
          <span style="font-size: 48px; font-weight: 800; color: #60a5fa; letter-spacing: 12px; display: block; text-shadow: 0 0 20px rgba(96, 165, 250, 0.4);">${generatedOtp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>`;

      await sendMail(formData.email, "Your OTP Code", emailHtml);
      setIsSendingOtp(false);
      setTakeOtp(true);
      toast.success("OTP sent to your email");
    }
  };

  const verifyOtp = (e) => {
    e.preventDefault();
    if (otp === sentOtp) {
      signup(formData);
    } else {
      toast.error("Invalid OTP");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pt-20 pb-10 flex items-center justify-center p-4">
      {/* Glassmorphic Container */}
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-3xl relative overflow-hidden shadow-2xl shadow-black/50">
        {/* Subtle background glow effect */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="relative z-10">
          {!takeOtp ? (
            <div className="text-center mb-10">
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
                Create Account
              </h1>
              <p className="text-white/60 text-sm">Join us to get started</p>
            </div>
          ) : (
            <div className="text-center mb-10 relative">
              <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 relative before:absolute before:inset-0 before:bg-blue-500/20 before:rounded-full before:animate-ping">
                <Mail className="size-8 text-blue-400 relative z-10" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
                Check your email
              </h1>
              <p className="text-white/60 text-sm">
                We've sent a 6-digit code to <br />
                <span className="font-medium text-blue-400">
                  {formData.email}
                </span>
              </p>
            </div>
          )}

          {!takeOtp && (
            <div className="flex justify-center mb-6">
              <button
                type="button"
                onClick={() => handleGoogleLogin()}
                className="relative w-full py-3 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] backdrop-blur-xl text-white font-medium text-base transition-all duration-500 ease-out flex items-center justify-center group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
                <svg
                  className="w-5 h-5 mr-3 drop-shadow-md relative z-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="relative z-10 drop-shadow-md">Sign up with Google</span>
              </button>
            </div>
          )}

          {!takeOtp ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-white/40">
                    <User className="size-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full pl-12 pr-4 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all duration-300"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFromData({ ...formData, fullName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">
                  Email
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-white/40">
                    <Mail className="size-5" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all duration-300"
                    value={formData.email}
                    onChange={(e) =>
                      setFromData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">
                  Password
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-white/40">
                    <Lock className="size-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    className="w-full pl-12 pr-12 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all duration-300"
                    value={formData.password}
                    onChange={(e) =>
                      setFromData({ ...formData, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-4 text-white/40 hover:text-white/80 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" />
                    ) : (
                      <Eye className="size-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-full mt-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:pointer-events-none"
                disabled={isSendingOtp}
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="size-5 animate-spin mr-2" />
                    Sending OTP...
                  </>
                ) : (
                  "Sign Up"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              <button
                type="button"
                onClick={() => setTakeOtp(false)}
                className="flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors mb-4"
              >
                <ArrowLeft className="size-4 mr-1" />
                Back to Sign Up
              </button>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white/80">
                  Enter OTP
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-white/40">
                    <ShieldCheck className="size-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="6-digit code"
                    maxLength={6}
                    className="w-full pl-12 pr-4 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/50 transition-all duration-300 text-center tracking-widest text-lg font-medium"
                    onChange={(e) => setOtp(e.target.value)}
                    value={otp}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-full mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:pointer-events-none"
                disabled={isSigningUp || otp.length < 6}
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="size-5 animate-spin mr-2" />
                    Verifying & Creating account...
                  </>
                ) : (
                  "Verify OTP & Sign Up"
                )}
              </button>
            </form>
          )}

          <div className="text-center mt-8">
            <p className="text-sm text-white/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-400 font-medium hover:text-blue-300 hover:underline transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
