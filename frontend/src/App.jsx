import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router";

import HomePage from "./pages/HomePage";
import CreatePage from "./pages/CreatePage";
import NotePage from "./pages/NotePage";
import ProfilePage from "./pages/ProfilePage";
import { useAuthStore } from "./stores/useAuthStore.js";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";

const App = () => {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  const { authUser, checkAuth, isCheckingAuth, themeMode } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader2 className="size-10 animate-spin text-white" />
      </div>
    );
  }

  const mainColor = authUser?.main_colour || '#3b82f6';
  const lightAccent = authUser?.accent_colour || '#6366f1';
  const darkAccent = authUser?.accent_colour2 || '#8b5cf6';

  const isDark = themeMode === "dark";
  const accentColor = isDark ? darkAccent : lightAccent;

  const themeStyles = {
    '--theme-main': mainColor,
    '--theme-accent': accentColor,
    '--theme-accent2': isDark ? lightAccent : darkAccent,
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
          background-color: color-mix(in srgb, var(--theme-main) 10%, rgba(255,255,255,0.03));
          border-color: color-mix(in srgb, var(--theme-main) 20%, rgba(255,255,255,0.1));
        }
        .theme-bg-glass:hover {
          background-color: color-mix(in srgb, var(--theme-main) 20%, rgba(255,255,255,0.08));
          border-color: color-mix(in srgb, var(--theme-main) 40%, rgba(255,255,255,0.2));
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
        style={{ backgroundImage: `url('${authUser?.backgroundImg || '/bg.png'}')` }}
      >
        {/* Subtle dark overlay to ensure text and glassmorphism remain crisp and readable */}
        <div className={`absolute inset-0 transition-colors duration-700 ${isDark ? 'bg-slate-900/75' : 'bg-slate-900/30'}`}></div>
      </div>
      <Routes location={backgroundLocation || location}>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to={"/login"} />}/>
        <Route path="/createNote" element={authUser ? <CreatePage /> : <Navigate to={"/login"} />}/>
        <Route path="/note/:id" element={authUser ? <NotePage /> : <Navigate to={"/login"} />}/>
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to={"/login"} />}/>
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to={"/"} />}/>
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to={"/"} />}/>
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/createNote" element={<CreatePage isModal />} />
          <Route path="/note/:id" element={<NotePage isModal />} />
        </Routes>
      )}
    </div>
  );
};

export default App;
