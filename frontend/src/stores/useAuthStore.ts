import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { triggerSync } from "../lib/syncEngine";
import { clearLocalDB, countUnsyncedNotes } from "../lib/db";
import { errorMessage, errorStatus, errorBody, asApiError } from "../lib/errors";
import {
  userIdOf,
  type AuthUser,
  type LoginPayload,
  type SignupPayload,
} from "../types/user";

const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type ThemeMode = "dark" | "light";

/** Shown when logout finds notes the server has never received. */
export interface LogoutWarning {
  count: number;
}

export interface AuthState {
  authUser: AuthUser | null;
  isSigningUp: boolean;
  isLoggingIn: boolean;
  isUpdatingProfile: boolean;
  isCheckingAuth: boolean;
  isThemeChanging: boolean;
  themeMode: ThemeMode;
  _hasHydrated: boolean;
  _cachedAt: number | null;

  // Logout guard state
  isLoggingOut: boolean;
  logoutWarning: LogoutWarning | null;

  setHasHydrated: (hydrated: boolean) => void;
  toggleThemeMode: () => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  cancelLogout: () => void;
  confirmLogoutDiscard: () => Promise<void>;
  _finishLogout: (options: { discardUnsynced: boolean }) => Promise<boolean>;
  login: (formData: LoginPayload) => Promise<void>;
  signup: (formData: SignupPayload) => Promise<void>;
  updateProfile: (data: { profilePic: string }) => Promise<void>;
  setTheme: (image: { backgroundImg: string }) => Promise<void>;
  googleLogin: (accessToken: string) => Promise<AuthUser | null>;
}

/** The slice written to localStorage. */
type PersistedAuthState = Pick<AuthState, "authUser" | "themeMode" | "_cachedAt">;

const storedThemeMode = (): ThemeMode =>
  localStorage.getItem("themeMode") === "light" ? "light" : "dark";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      authUser: null,
      isSigningUp: false,
      isLoggingIn: false,
      isUpdatingProfile: false,
      isCheckingAuth: true,
      isThemeChanging: false,
      themeMode: storedThemeMode(),
      _hasHydrated: false,
      _cachedAt: null,

      // Logout guard state
      isLoggingOut: false,
      logoutWarning: null, // null, or { count } when unsynced notes block logout

      setHasHydrated: (hydrated) => {
        set({ _hasHydrated: hydrated });
      },

      toggleThemeMode: () =>
        set((state) => {
          const newMode: ThemeMode =
            state.themeMode === "dark" ? "light" : "dark";
          localStorage.setItem("themeMode", newMode);
          return { themeMode: newMode };
        }),

      checkAuth: async () => {
        const { authUser, _cachedAt } = get();
        set({ isCheckingAuth: true });

        if (!navigator.onLine) {
          if (authUser && _cachedAt && Date.now() - _cachedAt < SESSION_TTL_MS) {
            console.log(
              "Offline: using cached auth (expires in",
              Math.round((SESSION_TTL_MS - (Date.now() - _cachedAt)) / 86400000),
              "days)",
            );
            set({ isCheckingAuth: false });
            return;
          }
          set({ authUser: null, _cachedAt: null, isCheckingAuth: false });
          return;
        }

        try {
          const res = await axiosInstance.get<AuthUser>("/auth/check");
          set({ authUser: res.data, _cachedAt: Date.now() });
          triggerSync(res.data._id);
        } catch (error) {
          if (asApiError(error)?.code === "ERR_NETWORK") {
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
          if (errorStatus(error) !== 401) {
            console.log("Error in checkAuth: ", error);
          }
          set({ authUser: null, _cachedAt: null });
        } finally {
          set({ isCheckingAuth: false });
        }
      },

      // Step 1 of logout: never wipe anything the server hasn't confirmed.
      // Try one last sync; if notes are still pending, stop and ask.
      logout: async () => {
        if (get().isLoggingOut) return;

        const userId = userIdOf(get().authUser);
        set({ isLoggingOut: true });

        try {
          if (userId) await triggerSync(userId);

          const unsynced = await countUnsyncedNotes(userId);
          if (unsynced > 0) {
            set({ logoutWarning: { count: unsynced } });
            return;
          }

          set({ logoutWarning: null });
          await get()._finishLogout({ discardUnsynced: false });
        } finally {
          set({ isLoggingOut: false });
        }
      },

      cancelLogout: () => set({ logoutWarning: null }),

      // The user saw the warning and explicitly chose to throw the notes away.
      confirmLogoutDiscard: async () => {
        if (get().isLoggingOut) return;
        set({ isLoggingOut: true });
        try {
          const done = await get()._finishLogout({ discardUnsynced: true });
          if (done) set({ logoutWarning: null });
        } finally {
          set({ isLoggingOut: false });
        }
      },

      // Step 2 of logout: end the server session, then clean up locally.
      _finishLogout: async ({ discardUnsynced }) => {
        const userId = userIdOf(get().authUser);

        try {
          await axiosInstance.post("/auth/logout");
        } catch (error) {
          // 401 = the server session is already gone, so we're logged out anyway.
          if (errorStatus(error) !== 401) {
            console.log("Error in logout: ", error);
            toast.error(errorMessage(error));
            return false;
          }
        }

        // An edit could have landed (e.g. from another tab) after the check in
        // logout(). If so, keep those notes instead of silently deleting them.
        const lateEdits = discardUnsynced ? 0 : await countUnsyncedNotes(userId);
        await clearLocalDB({ keepUnsynced: lateEdits > 0 });

        set({ authUser: null, _cachedAt: null });

        if (lateEdits > 0) {
          toast.success(
            `Logged out. ${lateEdits} late edit(s) kept on this device - they'll sync when you sign back in.`,
          );
        } else {
          toast.success("Logout Successful");
        }
        return true;
      },

      login: async (formData) => {
        set({ isLoggingIn: true });
        try {
          const res = await axiosInstance.post<AuthUser>("/auth/login", formData);
          set({ authUser: res.data, _cachedAt: Date.now() });
          triggerSync(res.data._id);
          toast.success("Logged in Successfully");
        } catch (error) {
          console.log("Error in login: ", error);
          toast.error(errorMessage(error));
        } finally {
          set({ isLoggingIn: false });
        }
      },

      signup: async (formData) => {
        set({ isSigningUp: true });
        try {
          const res = await axiosInstance.post<AuthUser>("/auth/signup", formData);
          set({ authUser: res.data, _cachedAt: Date.now() });

          triggerSync(res.data._id);
          toast.success("Signed up successfully.");
        } catch (error) {
          console.log("Error in signup: ", error);
          const code = errorBody(error)?.code;
          if (code === "OTP_VERIFICATION_REQUIRED") {
            toast.error(
              "Email verification expired. Please verify your email again.",
            );
          } else {
            toast.error(errorMessage(error));
          }
        } finally {
          set({ isSigningUp: false });
        }
      },

      updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
          const res = await axiosInstance.put<AuthUser>(
            "/auth/updateProfile",
            data,
          );
          set({ authUser: res.data, _cachedAt: Date.now() });
          toast.success("Profile Updated Successfully");
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          set({ isUpdatingProfile: false });
        }
      },

      setTheme: async (image) => {
        set({ isThemeChanging: true });
        try {
          const res = await axiosInstance.put<AuthUser>(
            "/auth/setBackgroundImg",
            image,
          );
          set({ authUser: res.data, _cachedAt: Date.now() });
          toast.success("Theme changed successfully");
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          set({ isThemeChanging: false });
        }
      },

      googleLogin: async (accessToken) => {
        set({ isLoggingIn: true });
        try {
          const res = await axiosInstance.post<AuthUser>("/auth/google", {
            access_token: accessToken,
          });

          set({ authUser: res.data, _cachedAt: Date.now() });
          triggerSync(res.data._id);
          toast.success("Logged in with Google!");
          return res.data;
        } catch (error) {
          console.log("Error in googleLogin: ", error);
          toast.error(errorMessage(error, "Google authentication failed"));
          return null;
        } finally {
          set({ isLoggingIn: false });
        }
      },

    }),
    {
      name: "auth-storage",
      partialize: (state): PersistedAuthState => ({
        authUser: state.authUser,
        themeMode: state.themeMode,
        _cachedAt: state._cachedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state && !state.authUser) {
          // Signed out without going through logout() (e.g. session expired).
          // Clear everything except notes the server has never seen.
          clearLocalDB({ keepUnsynced: true });
        }
      },
    },
  ),
);
