import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../lib/axios.js";
import toast from "react-hot-toast";
import sendMail from "../lib/sendMail.js";
import { triggerSync } from "../lib/syncEngine.js";
import { clearLocalDB, markPinConfigured } from "../lib/db.js";
import { deriveKeyFromPin } from "../lib/crypto.js";

const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const useAuthStore = create(
  persist(
    (set, get) => ({
      authUser: null,
      isSigningUp: false,
      isLoggingIn: false,
      isUpdatingProfile: false,
      isCheckingAuth: true,
      isThemeChanging: false,
      themeMode: localStorage.getItem("themeMode") || "dark",
      _hasHydrated: false,
      _cachedAt: null,
      pin: null,
      cryptoKey: null,

      initCryptoKey: async (pinValue, userId) => {
        if (!pinValue || !userId) return null;
        try {
          const key = await deriveKeyFromPin(pinValue, userId);
          set({ cryptoKey: key, pin: pinValue });
          return key;
        } catch (err) {
          console.error("Failed to derive encryption key:", err);
          return null;
        }
      },

      checkPin: async () => {
        const state = get();
        if (state.cryptoKey) return true;

        const pinData = localStorage.getItem("pin");
        if (pinData && state.authUser) {
          try {
            const parsed = JSON.parse(pinData);
            if (new Date().getTime() > parsed.expiry) {
              localStorage.removeItem("pin");
              return false;
            }
            const userId = state.authUser._id || state.authUser.id;
            await state.initCryptoKey(parsed.value, userId);
            return true;
          } catch (e) {
            return false;
          }
        }
        return false;
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      toggleThemeMode: () =>
        set((state) => {
          const newMode = state.themeMode === "dark" ? "light" : "dark";
          localStorage.setItem("themeMode", newMode);
          return { themeMode: newMode };
        }),

      checkAuth: async () => {
        const { authUser, _cachedAt } = get();
        set({ isCheckingAuth: true });

        if (!navigator.onLine) {
          if (
            authUser &&
            _cachedAt &&
            Date.now() - _cachedAt < SESSION_TTL_MS
          ) {
            console.log(
              "Offline: using cached auth (expires in",
              Math.round(
                (SESSION_TTL_MS - (Date.now() - _cachedAt)) / 86400000,
              ),
              "days)",
            );
            set({ isCheckingAuth: false });
            return;
          }
          set({ authUser: null, _cachedAt: null, isCheckingAuth: false });
          return;
        }

        try {
          const res = await axiosInstance.get("/auth/check");
          set({ authUser: res.data, _cachedAt: Date.now() });
          triggerSync(res.data._id);
        } catch (error) {
          if (error.code === "ERR_NETWORK") {
            if (
              authUser &&
              _cachedAt &&
              Date.now() - _cachedAt < SESSION_TTL_MS
            ) {
              console.log("Network error: using cached auth data");
              set({ isCheckingAuth: false });
              return;
            }
          }
          if (error.response?.status !== 401) {
            console.log("Error in checkAuth: ", error);
          }
          set({ authUser: null, _cachedAt: null });
        } finally {
          set({ isCheckingAuth: false });
        }
      },

      logout: async () => {
        try {
          await axiosInstance.post("/auth/logout");
          localStorage.removeItem("pin");
          set({ authUser: null, _cachedAt: null, cryptoKey: null, pin: null });
          clearLocalDB();
          toast.success("Logout Successful");
        } catch (error) {
          console.log("Error in logout: ", error);
          toast.error(error.response?.data?.message || error.message);
        }
      },

      login: async (formData) => {
        set({ isLoggingIn: true });
        try {
          const res = await axiosInstance.post("/auth/login", formData);
          set({ authUser: res.data, _cachedAt: Date.now(), cryptoKey: null, pin: null });
          triggerSync(res.data._id);
          toast.success("Logged in Successfully");
        } catch (error) {
          console.log("Error in login: ", error);
          toast.error(error.response?.data?.message || error.message);
        } finally {
          set({ isLoggingIn: false });
        }
      },

      signup: async (formData, pin, rememberMe = false) => {
        set({ isSigningUp: true });
        try {
          const res = await axiosInstance.post("/auth/signup", formData);
          set({ authUser: res.data, _cachedAt: Date.now() });
          
          if (pin) {
            await get().initCryptoKey(pin, res.data._id || res.data.id);
            await markPinConfigured(res.data._id || res.data.id);
            if (rememberMe) {
              const expiry = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
              localStorage.setItem(
                "pin",
                JSON.stringify({ value: pin, expiry })
              );
            }
          }

          triggerSync(res.data._id);
          toast.success("Signed up successfully.");

          const welcomeHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; padding: 40px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Our App!</h1>
          <p style="color: #94a3b8; font-size: 16px; margin-top: 12px;">We're thrilled to have you on board.</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
          <p style="font-size: 20px; color: #e2e8f0; margin: 0;">Hi <strong style="color: #60a5fa; font-weight: 600;">${formData.fullName}</strong>,</p>
          <p style="font-size: 16px; color: #cbd5e1; margin-top: 16px; line-height: 1.6;">Your account has been created successfully. You can now explore all the features and start your journey with us.</p>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="https://www.notejs.in/" style="background: linear-gradient(to right, #3b82f6, #4f46e5); color: #ffffff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);">Get Started</a>
        </div>
      </div>`;

          sendMail(formData.email, "Welcome to Our App!", welcomeHtml);
        } catch (error) {
          console.log("Error in signup: ", error);
          toast.error(error.response?.data?.message || error.message);
        } finally {
          set({ isSigningUp: false });
        }
      },

      updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
          const res = await axiosInstance.put("/auth/updateProfile", data);
          set({ authUser: res.data, _cachedAt: Date.now() });
          toast.success("Profile Updated Successfully");
        } catch (error) {
          toast.error(error.response?.data?.message || error.message);
        } finally {
          set({ isUpdatingProfile: false });
        }
      },

      setTheme: async (image) => {
        set({ isThemeChanging: true });
        try {
          const res = await axiosInstance.put("/auth/setBackgroundImg", image);
          set({ authUser: res.data, _cachedAt: Date.now() });
          toast.success("Theme changed successfully");
        } catch (error) {
          toast.error(error.response?.data?.message || error.message);
        } finally {
          set({ isThemeChanging: false });
        }
      },

      pendingGoogleUser: null,

      googleLogin: async (access_token, isSignUp = false) => {
        set({ isLoggingIn: true });
        try {
          const res = await axiosInstance.post("/auth/google", {
            access_token,
          });
          
          if (isSignUp) {
            set({ pendingGoogleUser: res.data });
            toast.success("Google authenticated. Please secure your vault with a PIN.");
            return res.data;
          }

          set({ authUser: res.data, _cachedAt: Date.now(), cryptoKey: null, pin: null });
          triggerSync(res.data._id);
          toast.success("Logged in with Google!");
          return res.data;
        } catch (error) {
          console.log("Error in googleLogin: ", error);
          toast.error(
            error.response?.data?.message || "Google authentication failed",
          );
          return null;
        } finally {
          set({ isLoggingIn: false });
        }
      },

      finalizeGoogleSignup: async (pin, rememberMe = false) => {
        const { pendingGoogleUser } = get();
        if (!pendingGoogleUser) return;
        
        set({ isSigningUp: true });
        try {
          await get().initCryptoKey(pin, pendingGoogleUser._id || pendingGoogleUser.id);
          await markPinConfigured(pendingGoogleUser._id || pendingGoogleUser.id);
          if (rememberMe) {
            const expiry = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
            localStorage.setItem(
              "pin",
              JSON.stringify({ value: pin, expiry })
            );
          }
          set({ authUser: pendingGoogleUser, _cachedAt: Date.now(), pendingGoogleUser: null });
          triggerSync(pendingGoogleUser._id);
          toast.success("Vault secured. Welcome!");
        } catch (error) {
          console.error("Error finalizing Google signup", error);
          toast.error("Failed to secure vault.");
        } finally {
          set({ isSigningUp: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        authUser: state.authUser,
        themeMode: state.themeMode,
        _cachedAt: state._cachedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state && !state.authUser) {
          clearLocalDB();
        }
      },
    },
  ),
);
