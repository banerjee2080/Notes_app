import { useAuthStore } from "../stores/useAuthStore";
import { useState } from "react";
import { Link } from "react-router";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import AuthFrame, { CodeField, GoogleGlyph } from "../components/ui/AuthFrame";
import type { LoginPayload } from "../types/user";
import toast from "react-hot-toast";
import { useGoogleLogin } from "@react-oauth/google";

const LoginPage = () => {
  const { login, isLoggingIn, googleLogin } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginPayload>({
    email: "",
    password: "",
  });

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: (codeResponse) => {
      googleLogin(codeResponse.access_token);
    },
    onError: (error) => {
      console.log("Google Login Failed:", error);
      toast.error("Google Sign In was unsuccessful");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    login(formData);
  };

  return (
    <AuthFrame fileName="login.js">
      <h1 className="text-xl mb-1">
        <span className="tok-kw">async function</span> <span className="tok-fn">login</span>
        <span className="tok-punc">() {"{"}</span>
      </h1>
      <p className="text-[12.5px] tok-com mb-6">{"// welcome back — sign in to pick up where you left off"}</p>

      <button
        type="button"
        onClick={() => handleGoogleLogin()}
        className="ide-btn w-full justify-center !py-2.5 mb-5"
      >
        <GoogleGlyph />
        <span>
          <span className="tok-fn">signInWith</span>
          <span className="tok-punc">(</span>Google<span className="tok-punc">)</span>
        </span>
      </button>

      <div className="flex items-center gap-3 mb-5 text-[11px] tok-dim">
        <span className="flex-1 border-t ide-divider" />
        {"// or"}
        <span className="flex-1 border-t ide-divider" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <CodeField kw="const" name="email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
            <input
              type="email"
              placeholder="'you@example.com'"
              className="ide-input !pl-9"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>
        </CodeField>

        <CodeField kw="const" name="password">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--fg-dim)]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="'••••••'"
              className="ide-input !pl-9 !pr-10"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-dim)] hover:text-[var(--fg)]"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </CodeField>

        <button
          type="submit"
          className="ide-btn ide-btn-solid w-full justify-center !py-2.5 mt-2"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              await auth.login()…
            </>
          ) : (
            <>
              <span>return auth.login(email, password);</span>
            </>
          )}
        </button>
      </form>

      <p className="text-lg tok-punc mt-5">{"}"}</p>

      <p className="text-[12.5px] text-center mt-4 tok-dim">
        {"// no account? "}
        <Link to="/signup" className="tok-fn hover:underline">
          signup()
        </Link>
      </p>
    </AuthFrame>
  );
};

export default LoginPage;
