import { Link, useLocation } from "react-router";
import { PlusIcon, LogOut, Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useRef } from "react";

const Navbar = () => {
  const location = useLocation();
  const { authUser, logout, setTheme, isThemeChanging } = useAuthStore();
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Img = reader.result;
      await setTheme({ backgroundImg: base64Img });
    };
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/20 border-b border-white/10 shadow-lg">
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="text-3xl font-bold theme-gradient-text tracking-tight"
          >
            Note.js
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={"/createNote"}
              state={{ backgroundLocation: location }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <PlusIcon className="size-5" />
              <span className="font-medium">New Note</span>
            </Link>

            {authUser && (
              <>
                <Link
                  to="/profile"
                  className="w-10 h-10 rounded-full overflow-hidden border border-white/20 hover:border-white/50 transition-all duration-300 group relative flex items-center justify-center"
                  title="Profile"
                >
                  <img
                    src={authUser.profilePic || "/avatar.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <button
                  onClick={logout}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/10 hover:border-red-500/50 transition-all duration-300"
                  title="Logout"
                >
                  <LogOut className="size-5" />
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isThemeChanging}
                  className={`px-4 py-2 theme-button-outline text-sm font-medium rounded-lg transition-all duration-300 backdrop-blur-sm whitespace-nowrap shadow-[0_0_15px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 ${isThemeChanging ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isThemeChanging ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    "Change Theme"
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
