import { useEffect } from "react";
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
import HistoryPage from "./pages/HistoryPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import CodeSpinner from "./components/ui/CodeSpinner.jsx";
import LogoutGuard from "./components/LogoutGuard.jsx";

const App = () => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  const { authUser, checkAuth, isCheckingAuth, themeMode, _hasHydrated } =
    useAuthStore();

  useEffect(() => {
    localStorage.removeItem("pin");
  }, []);

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

  useEffect(() => {
    document.documentElement.dataset.mode = isDark ? "dark" : "light";
  }, [isDark]);

  // Show loading screen only when we have no user data at all (not yet hydrated or still checking)
  if (!_hasHydrated || (isCheckingAuth && !authUser)) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
        <CodeSpinner label="Hoisting variables…" />
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
      {/* Wallpaper: the user's uploaded image sits behind the IDE window */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${authUser?.backgroundImg || "/bg.png"}')`,
        }}
      >
        <div
          className="absolute inset-0 transition-colors duration-700"
          style={{ background: "var(--wall-overlay)" }}
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
        <Route
          path="/history"
          element={authUser ? <HistoryPage /> : <Navigate to={"/login"} />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/createNote" element={<CreatePage isModal />} />
          <Route path="/note/:id" element={<NotePage isModal />} />
          <Route path="/delNote/:id" element={<DelNotePage isModal />} />
          <Route path="/pin" element={<PinPage isModal />} />
        </Routes>
      )}

      <LogoutGuard />
    </div>
  );
};

export default App;
