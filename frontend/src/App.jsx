import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { triggerSync } from "./lib/syncEngine";
import { localDB } from "./lib/db.js";

import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import NotePage from "./pages/NotePage";
import ProfilePage from "./pages/ProfilePage";
import DelNotePage from "./pages/DelNotePage.jsx";
import RecycleBinPage from "./pages/RecycleBinPage.jsx";
import { useAuthStore } from "./stores/useAuthStore.js";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import PinPage from "./pages/PinPage.jsx";
import SyncLoader from "./components/SyncLoader";
import { useOnlineStatus } from "./hooks/useOnlineStatus";

const App = () => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const isOnline = useOnlineStatus();

  const { authUser, checkAuth, isCheckingAuth, themeMode, _hasHydrated } =
    useAuthStore();

  useEffect(() => {
    if (_hasHydrated) {
      checkAuth();
    }
  }, [_hasHydrated, checkAuth]);

  useEffect(() => {
    if (authUser && authUser._id) {
      triggerSync(authUser._id);

      // Client-Side Data Governance: Clean up expired notes locally
      const cleanupExpiredNotes = async () => {
        try {
          const notes = await localDB.notes
            .filter(
              (note) =>
                note.is_deleted === true && note.user_id === authUser._id,
            )
            .toArray();

          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          const expiredNoteIds = [];

          for (const note of notes) {
            if (now - new Date(note.updated_at).getTime() > thirtyDaysMs) {
              expiredNoteIds.push(note.id);
            }
          }

          if (expiredNoteIds.length > 0) {
            await localDB.notes.bulkDelete(expiredNoteIds);
            console.log(
              `[Client Cleanup] Deleted ${expiredNoteIds.length} expired notes from localDB.`,
            );
          }
        } catch (error) {
          console.error("Error during local cleanup of expired notes:", error);
        }
      };

      cleanupExpiredNotes();

      const handleOnline = () => triggerSync(authUser._id);
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          triggerSync(authUser._id);
        }
      };

      window.addEventListener("online", handleOnline);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("online", handleOnline);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }
  }, [authUser]);

  const mainColor = authUser?.main_colour || "#3b82f6";
  const lightAccent = authUser?.accent_colour || "#6366f1";
  const darkAccent = authUser?.accent_colour2 || "#8b5cf6";

  const isDark = themeMode === "dark";
  const accentColor = isDark ? darkAccent : lightAccent;

  useEffect(() => {
    document.documentElement.style.setProperty("--theme-main", mainColor);
    document.documentElement.style.setProperty("--theme-accent", accentColor);
    document.documentElement.style.setProperty(
      "--theme-accent2",
      isDark ? lightAccent : darkAccent,
    );
  }, [mainColor, accentColor, lightAccent, darkAccent, isDark]);

  // Show loading spinner only when we have no user data at all (not yet hydrated or still checking)
  if (!_hasHydrated || (isCheckingAuth && !authUser)) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="size-10 animate-spin text-white" />
      </div>
    );
  }

  const themeStyles = {
    "--theme-main": mainColor,
    "--theme-accent": accentColor,
    "--theme-accent2": isDark ? lightAccent : darkAccent,
  };

  return (
    <div className="relative min-h-screen" style={themeStyles}>
      <style>{`
        .theme-text {
          color: var(--theme-main);
        }
        .theme-gradient-text {
          background-image: linear-gradient(to right, var(--theme-main), var(--theme-accent));
          -webkit-background-clip: text;
          color: transparent;
        }
        .theme-bg-glass {
          background-color: color-mix(in srgb, var(--theme-main) 15%, rgba(0, 0, 0, 0.4));
          border-color: color-mix(in srgb, var(--theme-main) 30%, rgba(255, 255, 255, 0.15));
        }
        .theme-bg-glass:hover {
          background-color: color-mix(in srgb, var(--theme-main) 20%, rgba(0, 0, 0, 0.5));
          border-color: color-mix(in srgb, var(--theme-main) 50%, rgba(255, 255, 255, 0.25));
          box-shadow: 0 8px 30px color-mix(in srgb, var(--theme-main) 20%, transparent);
        }
        .theme-button {
          background: linear-gradient(to right, var(--theme-main), var(--theme-accent));
          box-shadow: 0 4px 15px color-mix(in srgb, var(--theme-main) 30%, transparent);
          color: #fff;
          border: none;
        }
        .theme-button:hover {
          box-shadow: 0 6px 25px color-mix(in srgb, var(--theme-main) 50%, transparent);
        }
        .theme-button-outline {
          background-color: color-mix(in srgb, var(--theme-main) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--theme-main) 40%, transparent);
          color: color-mix(in srgb, var(--theme-main) 90%, #fff);
        }
        .theme-button-outline:hover {
          background-color: color-mix(in srgb, var(--theme-main) 25%, transparent);
          border-color: color-mix(in srgb, var(--theme-main) 60%, transparent);
        }
        .theme-button-accent {
          background-color: color-mix(in srgb, var(--theme-accent) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
          color: color-mix(in srgb, var(--theme-accent) 90%, #fff);
        }
        .theme-button-accent:hover {
          background-color: color-mix(in srgb, var(--theme-accent) 25%, transparent);
          border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
        }
      `}</style>
      {/* Landscape Background */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${authUser?.backgroundImg || "/bg.png"}')`,
        }}
      >
        {/* Subtle dark overlay to ensure text and glassmorphism remain crisp and readable */}
        <div
          className={`absolute inset-0 transition-colors duration-700 ${isDark ? "bg-slate-900/75" : "bg-slate-900/30"}`}
        ></div>
      </div>
      <Routes location={backgroundLocation || location}>
        <Route
          path="/"
          element={authUser ? <HomePage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/createNote"
          element={authUser ? <CreatePage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/note/:id"
          element={authUser ? <NotePage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/profile"
          element={authUser ? <ProfilePage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/login"
          element={!authUser ? <LoginPage /> : <Navigate to={"/"} />}
        />
        <Route
          path="/signup"
          element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />}
        />
        <Route
          path="/recycleBin"
          element={authUser ? <RecycleBinPage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/delNote/:id"
          element={authUser ? <DelNotePage /> : <Navigate to={"/login"} />}
        />
        <Route
          path="/pin"
          element={authUser ? <PinPage /> : <Navigate to={"/login"} />}
        />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/createNote" element={<CreatePage isModal />} />
          <Route path="/note/:id" element={<NotePage isModal />} />
          <Route path="/delNote/:id" element={<DelNotePage isModal />} />
          <Route path="/pin" element={<PinPage isModal />} />
        </Routes>
      )}

      {/* Subtle Online/Offline Indicator */}
      <div
        className={`fixed bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur-md transition-all duration-300 z-50 opacity-50 hover:opacity-100 ${isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
      >
        <div
          className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`}
        ></div>
        {isOnline ? "System Online" : "Offline Mode"}
      </div>

      <SyncLoader />
    </div>
  );
};

export default App;
