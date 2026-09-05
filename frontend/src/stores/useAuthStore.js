import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../lib/axios.js";
import toast from "react-hot-toast";
import { triggerSync } from "../lib/syncEngine.js";
import {
  clearLocalDB,
  markPinConfigured,
  localDB,
  saveVaultKey,
  getVaultKey,
  clearVaultKey,
} from "../lib/db.js";
import { deriveKeyFromPin, decryptData } from "../lib/crypto.js";

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
      cryptoKey: null,

      initCryptoKey: async (pinValue, userId) => {
        if (!pinValue || !userId) return null;
        try {
          const key = await deriveKeyFromPin(pinValue, userId);
          set({ cryptoKey: key });
          return key;
        } catch (err) {
          console.error("Failed to derive encryption key:", err);
          return null;
        }
      },

      checkPin: async () => {
        const state = get();
        if (state.cryptoKey) return true;
        if (!state.authUser) return false;

        const userId = state.authUser._id || state.authUser.id;
        const key = await getVaultKey(userId);
        if (!key) return false;

        try {
          const notes = await localDB.notes
            .where("user_id")
            .equals(userId)
            .toArray();

          const noteToVerify = notes.find((n) => !!n.iv_content);
          if (noteToVerify) {
            await decryptData(
              noteToVerify.content,
              noteToVerify.iv_content,
              key,
            );
          }

          set({ cryptoKey: key });
          return true;
        } catch (e) {
          console.error("Stored vault key failed verification", e);
          await clearVaultKey(userId);
          set({ cryptoKey: null });
          return false;
        }
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
        const state = get();
        const userId = state.authUser?._id || state.authUser?.id;
        try {
          await axiosInstance.post("/auth/logout");
          await clearVaultKey(userId);
          localStorage.removeItem("pin"); // legacy cleanup, safe to keep for a while
          set({ authUser: null, _cachedAt: null, cryptoKey: null });
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
          set({
            authUser: res.data,
            _cachedAt: Date.now(),
            cryptoKey: null,
            pin: null,
          });
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
            const userId = res.data._id || res.data.id;
            const key = await get().initCryptoKey(pin, userId);
            await markPinConfigured(userId);
            if (rememberMe && key) {
              await saveVaultKey(userId, key);
            }
          }

          triggerSync(res.data._id);
          toast.success("Signed up successfully.");
        } catch (error) {
          console.log("Error in signup: ", error);
          const code = error.response?.data?.code;
          if (code === "OTP_VERIFICATION_REQUIRED") {
            toast.error(
              "Email verification expired. Please verify your email again.",
            );
          } else {
            toast.error(error.response?.data?.message || error.message);
          }
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
            toast.success(
              "Google authenticated. Please secure your vault with a PIN.",
            );
            return res.data;
          }

          set({
            authUser: res.data,
            _cachedAt: Date.now(),
            cryptoKey: null,
            pin: null,
          });
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
          const userId = pendingGoogleUser._id || pendingGoogleUser.id;
          const key = await get().initCryptoKey(pin, userId);
          await markPinConfigured(userId);
          await get().initCryptoKey(
            pin,
            pendingGoogleUser._id || pendingGoogleUser.id,
          );
          await markPinConfigured(
            pendingGoogleUser._id || pendingGoogleUser.id,
          );
          if (rememberMe && key) {
            await saveVaultKey(userId, key);
          }
          set({
            authUser: pendingGoogleUser,
            _cachedAt: Date.now(),
            pendingGoogleUser: null,
          });
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
