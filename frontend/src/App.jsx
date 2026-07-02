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

  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

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

  return (
    <div className="relative min-h-screen">
      {/* Landscape Background */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/bg.png')" }}
      >
        {/* Subtle dark overlay to ensure text and glassmorphism remain crisp and readable */}
        <div className="absolute inset-0 bg-slate-900/40"></div>
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
