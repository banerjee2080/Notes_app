import { Link, useLocation } from "react-router";
import { PlusIcon, LogOut, Loader2, Menu, X, Image as ImageIcon, Sun, Moon, Search, CalendarDays } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { useRef, useState } from "react";
import { compressImage } from "../lib/utils";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const Navbar = ({ searchQuery, setSearchQuery, dateFilter, setDateFilter }) => {
  const location = useLocation();
  const { authUser, logout, setTheme, isThemeChanging, themeMode, toggleThemeMode } = useAuthStore();
  const fileInputRef = useRef(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const isOnline = useOnlineStatus();

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
            {setDateFilter && (
              <div className="flex items-center">
                <div
                  className={`overflow-hidden transition-all duration-300 flex items-center ${
                    isDateOpen ? "w-40 opacity-100 mr-2" : "w-0 opacity-0 mr-0"
                  }`}
                >
                  <input
                    type="month"
                    value={dateFilter || ""}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full bg-black/40 border border-white/20 rounded-full py-1.5 px-4 text-white focus:outline-none focus:border-white/40 focus:bg-black/60 transition-all backdrop-blur-md text-sm h-10 [color-scheme:dark]"
                  />
                </div>
                <button
                  onClick={() => {
                    setIsDateOpen(!isDateOpen);
                    if (isSearchOpen) setIsSearchOpen(false);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border hover:scale-110 active:scale-95 ${
                    isDateOpen || dateFilter
                      ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/30"
                  }`}
                  title="Filter by Month"
                >
                  <CalendarDays className="size-5" />
                </button>
              </div>
            )}

            {setSearchQuery && (
              <div className="flex items-center">
                <div
                  className={`overflow-hidden transition-all duration-300 flex items-center ${
                    isSearchOpen ? "w-48 opacity-100 mr-2" : "w-0 opacity-0 mr-0"
                  }`}
                >
                  <input
                    type="text"
                    value={searchQuery || ""}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-black/40 border border-white/20 rounded-full py-1.5 px-4 text-white placeholder-white/50 focus:outline-none focus:border-white/40 focus:bg-black/60 transition-all backdrop-blur-md text-sm h-10"
                  />
                </div>
                <button
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isDateOpen) setIsDateOpen(false);
                  }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border hover:scale-110 active:scale-95 ${
                    isSearchOpen || searchQuery
                      ? "bg-white/20 text-white border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                      : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/30"
                  }`}
                  title="Search Notes"
                >
                  <Search className="size-5" />
                </button>
              </div>
            )}

            <Link
              to={"/createNote"}
              state={{ backgroundLocation: location }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
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
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <button
                  onClick={logout}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/10 hover:border-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
                  title="Logout"
                >
                  <LogOut className="size-5" />
                </button>

                <button
                  onClick={toggleThemeMode}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-110 hover:rotate-12 active:scale-95"
                  title={themeMode === 'dark' ? "Switch to Vibrant Mode" : "Switch to Dark Mode"}
                >
                  {themeMode === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="relative group flex items-center">
                  <button 
                    onClick={() => { if(isOnline) fileInputRef.current?.click(); }}
                    disabled={isThemeChanging || !isOnline}
                    className={`w-10 h-10 rounded-full theme-button-outline transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.2)] flex items-center justify-center hover:scale-110 active:scale-95 ${isThemeChanging || !isOnline ? 'opacity-70 cursor-not-allowed grayscale-[50%]' : ''}`}
                  >
                    {isThemeChanging ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <ImageIcon className="size-5" />
                    )}
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-black/80 backdrop-blur-md rounded-xl text-xs text-white/90 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-white/10 text-center pointer-events-none shadow-xl z-50">
                    {!isOnline ? "Background theme changes are unavailable while offline." : "Upload an image to automatically extract its vibrant colors and set your theme."}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      <div className={`md:hidden absolute top-full left-0 w-full bg-black/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 overflow-hidden ${isMobileMenuOpen ? 'max-h-[600px] opacity-100 py-4' : 'max-h-0 opacity-0 py-0'}`}>
        <div className="flex flex-col gap-4 px-4">
          
          {setSearchQuery && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
              <input
                type="text"
                value={searchQuery || ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              />
            </div>
          )}

          {setDateFilter && (
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-white/50" />
              <input
                type="month"
                value={dateFilter || ""}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all [color-scheme:dark]"
              />
            </div>
          )}

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
                  referrerPolicy="no-referrer"
                />
                <span className="text-white font-medium">Profile</span>
              </Link>
              
              <button
                onClick={() => {
                   setIsMobileMenuOpen(false);
                   toggleThemeMode();
                }}
                className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-white font-medium"
              >
                {themeMode === 'dark' ? (
                  <><Sun className="size-5" /> Switch to Vibrant Mode</>
                ) : (
                  <><Moon className="size-5" /> Switch to Dark Mode</>
                )}
              </button>
              
              <button 
                onClick={() => {
                   setIsMobileMenuOpen(false);
                   if (isOnline) fileInputRef.current?.click();
                }}
                disabled={isThemeChanging || !isOnline}
                className={`py-3 theme-button-outline text-sm font-medium rounded-lg flex items-center justify-center gap-2 ${isThemeChanging || !isOnline ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                 {isThemeChanging ? (
                   <>
                     <Loader2 className="size-4 animate-spin" />
                     Changing Theme...
                   </>
                 ) : (
                   <>
                     <ImageIcon className="size-4" />
                     {!isOnline ? "Theme Update Offline" : "Change Background"}
                   </>
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
