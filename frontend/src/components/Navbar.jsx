import { Link, useLocation } from "react-router";
import { PlusIcon, LogOut, Loader2, Menu, X } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useRef, useState } from "react";
import { compressImage } from "../lib/utils";

const Navbar = () => {
  const location = useLocation();
  const { authUser, logout, setTheme, isThemeChanging } = useAuthStore();
  const fileInputRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const base64Img = await compressImage(file, 1920, 0.7);
    await setTheme({ backgroundImg: base64Img });
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/20 border-b border-white/10 shadow-lg">
      <div className="mx-auto max-w-6xl p-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-3xl font-bold theme-gradient-text tracking-tight z-50"
          >
            Note.js
          </Link>
          
          {/* Mobile menu button */}
          <div className="md:hidden z-50">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              {isMobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              to={"/createNote"}
              state={{ backgroundLocation: location }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <PlusIcon className="size-5" />
              <span className="font-medium text-white">New Note</span>
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

      {/* Mobile Navigation Dropdown */}
      <div className={`md:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 overflow-hidden ${isMobileMenuOpen ? 'max-h-[500px] opacity-100 py-4' : 'max-h-0 opacity-0 py-0'}`}>
        <div className="flex flex-col gap-4 px-4">
          <Link
            to={"/createNote"}
            state={{ backgroundLocation: location }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-300"
          >
            <PlusIcon className="size-5 text-white" />
            <span className="font-medium text-white">New Note</span>
          </Link>

          {authUser && (
            <>
              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-3 py-3 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              >
                <img
                  src={authUser.profilePic || "/avatar.png"}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-white font-medium">Profile</span>
              </Link>
              
              <button 
                onClick={() => {
                   setIsMobileMenuOpen(false);
                   fileInputRef.current?.click();
                }}
                disabled={isThemeChanging}
                className={`py-3 theme-button-outline text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${isThemeChanging ? 'opacity-70 cursor-not-allowed' : ''}`}
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

              <button
                onClick={() => {
                   setIsMobileMenuOpen(false);
                   logout();
                }}
                className="flex justify-center items-center gap-2 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
              >
                <LogOut className="size-5" />
                <span className="font-medium">Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
export default Navbar;
