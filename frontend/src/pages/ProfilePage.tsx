import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { Camera, Loader2, Trash2, LogOut, Upload, Sun, Moon, Lock, LockOpen } from "lucide-react";
import { useNavigate } from "react-router";
import { compressImage, timeAgo } from "../lib/utils";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useDecryptedNotes } from "../hooks/useDecryptedNotes";
import AppShell from "../components/shell/AppShell";
import Navbar from "../components/Navbar";

/** A note-count milestone shown as a chip on the profile. */
interface Achievement {
  at: number;
  name: string;
  hint: string;
}

// Small, honest "achievements" based on how many notes you have.
const ACHIEVEMENTS: Achievement[] = [
  { at: 1, name: "Hello, World", hint: "wrote your first note" },
  { at: 5, name: "Hoisted", hint: "5 notes up top" },
  { at: 10, name: "Callback Hell Survivor", hint: "10 notes deep" },
  { at: 25, name: "Event Loop", hint: "25 notes and still spinning" },
  { at: 50, name: "Full Stack", hint: "50 notes" },
  { at: 100, name: "npm install brain", hint: "100 notes" },
];

interface PropProps {
  /** The key, rendered before the colon. */
  k: string;
  children: ReactNode;
  /** Trailing `// ...` note. */
  comment?: string | null;
}

// A line of the `const profile = { ... }` object literal.
const Prop = ({ k, children, comment }: PropProps) => (
  <div className="py-1.5 pl-5 md:pl-8 border-l ide-divider break-words">
    <span className="text-[var(--fg)]">{k}</span>
    <span className="tok-punc">: </span>
    {children}
    <span className="tok-punc">,</span>
    {comment && <span className="tok-com text-[12px]">{"  // "}{comment}</span>}
  </div>
);

const ProfilePage = () => {
  const {
    authUser,
    updateProfile,
    isUpdatingProfile,
    themeMode,
    toggleThemeMode,
    setTheme,
    isThemeChanging,
    logout,
    cryptoKey,
  } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { notes } = useDecryptedNotes();
  const wallpaperRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64Img = await compressImage(file, 800, 0.8);
    setSelectedImage(base64Img);
    await updateProfile({ profilePic: base64Img });
  };

  const handleWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64Img = await compressImage(file, 1920, 0.7);
    await setTheme({ backgroundImg: base64Img });
    e.target.value = "";
  };

  // The /profile route only renders for a signed-in user.
  if (!authUser) return null;

  const noteCount = notes?.length ?? 0;
  const unlocked = ACHIEVEMENTS.filter((a) => noteCount >= a.at);
  const nextUp = ACHIEVEMENTS.find((a) => noteCount < a.at);
  const joined = authUser.createdAt?.split("T")[0];

  return (
    <AppShell toolbar={<Navbar crumb="profile.js" />}>
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 md:py-8">
        <div className="flex flex-col-reverse md:flex-row gap-8 md:gap-10">
          {/* Object literal */}
          <div className="flex-1 min-w-0 text-[13.5px] leading-6">
            <div className="text-base md:text-lg mb-2">
              <span className="tok-kw">const</span> <span className="tok-fn">profile</span>{" "}
              <span className="tok-punc">= {"{"}</span>
            </div>

            <Prop k="name">
              <span className="tok-str">"{authUser.fullName}"</span>
            </Prop>
            <Prop k="email">
              <span className="tok-str">"{authUser.email}"</span>
            </Prop>
            <Prop k="memberSince" comment={joined ? timeAgo(authUser.createdAt) : null}>
              <span className="tok-kw">new</span> <span className="tok-fn">Date</span>
              <span className="tok-punc">(</span>
              <span className="tok-str">"{joined || "unknown"}"</span>
              <span className="tok-punc">)</span>
            </Prop>
            <Prop k="status">
              <span className="tok-str">"active"</span>
              <span className="ml-2 inline-block size-2 rounded-full bg-[var(--ok)] align-middle" />
            </Prop>
            <Prop k="notes" comment="notes.length">
              <span className="tok-num">{noteCount}</span>
            </Prop>
            <Prop k="vault" comment={cryptoKey ? "key in memory only" : "enter your PIN to unlock"}>
              <span className="inline-flex items-center gap-1.5">
                {cryptoKey ? <LockOpen className="size-3.5 tok-ok" /> : <Lock className="size-3.5 tok-warn" />}
                <span className="tok-str">"{cryptoKey ? "unlocked" : "locked"}"</span>
              </span>
            </Prop>

            {/* theme sub-object */}
            <div className="py-1.5 pl-5 md:pl-8 border-l ide-divider">
              <span className="text-[var(--fg)]">theme</span>
              <span className="tok-punc">: {"{"}</span>
              <div className="pl-5 border-l ide-divider my-1 space-y-2 py-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--fg)]">mode<span className="tok-punc">:</span></span>
                  <span className="tok-str">'{themeMode === "dark" ? "dark" : "vibrant"}'</span>
                  <span className="tok-punc">,</span>
                  <button type="button" onClick={toggleThemeMode} className="ide-btn !py-0.5 !px-2 text-xs">
                    {themeMode === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                    toggle()
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--fg)]">palette<span className="tok-punc">:</span></span>
                  <span className="tok-punc">[</span>
                  <span className="size-4 rounded-sm border ide-divider" style={{ background: "var(--theme-main)" }} />
                  <span className="size-4 rounded-sm border ide-divider" style={{ background: "var(--theme-accent)" }} />
                  <span className="tok-punc">],</span>
                  <span className="tok-com text-[12px]">{"// pulled from your wallpaper"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--fg)]">wallpaper<span className="tok-punc">:</span></span>
                  <span
                    className="w-16 h-9 rounded border ide-divider bg-cover bg-center"
                    style={{ backgroundImage: `url('${authUser.backgroundImg || "/bg.png"}')` }}
                  />
                  <input type="file" accept="image/*" ref={wallpaperRef} className="hidden" onChange={handleWallpaper} />
                  <button
                    type="button"
                    disabled={!isOnline || isThemeChanging}
                    onClick={() => wallpaperRef.current?.click()}
                    className="ide-btn ide-btn-primary !py-0.5 !px-2 text-xs"
                  >
                    {isThemeChanging ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    {isThemeChanging ? "await…" : "upload()"}
                  </button>
                  {!isOnline && <span className="tok-com text-[12px]">{"// needs a connection"}</span>}
                </div>
              </div>
              <span className="tok-punc">{"},"}</span>
            </div>

            {/* achievements */}
            <div className="py-1.5 pl-5 md:pl-8 border-l ide-divider">
              <span className="text-[var(--fg)]">achievements</span>
              <span className="tok-punc">: [</span>
              <div className="pl-5 flex flex-wrap gap-2 my-2">
                {unlocked.length === 0 && <span className="tok-com text-[12px]">{"// write a note to unlock your first"}</span>}
                {unlocked.map((a) => (
                  <span key={a.name} className="ide-chip !text-[var(--fg)]" title={a.hint}>
                    <span className="tok-js">★</span> {a.name}
                  </span>
                ))}
                {nextUp && (
                  <span className="ide-chip opacity-60" title={a11yNext(nextUp)}>
                    ☆ ??? <span className="tok-com">{"// "}{nextUp.at - noteCount} to go</span>
                  </span>
                )}
              </div>
              <span className="tok-punc">],</span>
            </div>

            <div className="tok-punc text-base md:text-lg mb-5">{"};"}</div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => navigate("/recycleBin")} className="ide-btn">
                <Trash2 className="size-4 tok-warn" />
                <span>
                  profile.<span className="tok-fn">recycleBin</span>()
                </span>
              </button>
              <button type="button" onClick={logout} className="ide-btn ide-btn-danger">
                <LogOut className="size-4" />
                profile.logout()
              </button>
            </div>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center md:w-56 shrink-0">
            <div className={`relative group ${!isOnline ? "cursor-not-allowed" : ""}`}>
              <div
                className={`size-36 rounded-xl overflow-hidden border-2 ide-divider relative transition-all duration-300 ${
                  !isOnline ? "grayscale-[50%]" : "group-hover:border-[var(--kw)]"
                }`}
              >
                <img
                  src={authUser.profilePic || selectedImage || "/avatar.png"}
                  alt="Profile picture"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <label
                  htmlFor={isOnline ? "avatar-upload" : ""}
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-all duration-300 bg-black/55 opacity-0 group-hover:opacity-100 ${
                    isOnline ? "cursor-pointer" : "cursor-not-allowed"
                  } ${isUpdatingProfile ? "opacity-100 pointer-events-none" : ""}`}
                >
                  {isUpdatingProfile ? (
                    <Loader2 className="size-7 text-white animate-spin" />
                  ) : (
                    <>
                      <Camera className={`size-7 ${isOnline ? "text-white" : "text-white/50"}`} />
                      <span className="text-[11px] text-white/90">{isOnline ? "avatar = upload()" : "offline"}</span>
                    </>
                  )}
                </label>
              </div>
              <span className="js-badge absolute -bottom-2 -right-2 w-8 h-8 text-sm shadow-lg">JS</span>
              <input
                type="file"
                id="avatar-upload"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUpdatingProfile || !isOnline}
              />
            </div>
            <p className="mt-5 text-xs tok-com text-center">
              {!isOnline
                ? "// profile updates unavailable offline"
                : isUpdatingProfile
                  ? "// uploading…"
                  : "// click the image to update"}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

const a11yNext = (a: Achievement): string => `Next: ${a.hint}`;

export default ProfilePage;
