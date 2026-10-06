import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { Camera, Loader2, Trash2, LogOut, Upload, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router";
import { compressImage, timeAgo } from "../lib/utils";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useNotes } from "../hooks/useNotes";
import AppShell from "../components/shell/AppShell";
import Navbar from "../components/Navbar";
import ThemePicker from "../components/shell/ThemePicker";
import { ThemeBadge } from "../components/ui/Themed";
import { useCopy, type Copy } from "../lib/voice";

/** A note-count milestone shown as a chip on the profile. */
interface Achievement {
  at: number;
  name: string;
  hint: string;
}

// Small, honest "achievements" based on how many notes you have, named
// in each theme's own terms.
const ACHIEVEMENTS: Copy<Achievement[]> = {
  js: [
    { at: 1, name: "Hello, World", hint: "wrote your first note" },
    { at: 5, name: "Hoisted", hint: "5 notes up top" },
    { at: 10, name: "Callback Hell Survivor", hint: "10 notes deep" },
    { at: 25, name: "Event Loop", hint: "25 notes and still spinning" },
    { at: 50, name: "Full Stack", hint: "50 notes" },
    { at: 100, name: "npm install brain", hint: "100 notes" },
  ],
  common: [
    { at: 1, name: "First page", hint: "wrote your first note" },
    { at: 5, name: "A handful", hint: "5 notes" },
    { at: 10, name: "Ten pages", hint: "10 notes" },
    { at: 25, name: "Notebook", hint: "25 notes" },
    { at: 50, name: "Bookshelf", hint: "50 notes" },
    { at: 100, name: "Commonplace book", hint: "100 notes" },
  ],
  pythagoras: [
    { at: 1, name: "Axiom", hint: "your first proposition" },
    { at: 5, name: "Lemma", hint: "5 propositions" },
    { at: 10, name: "Tetractys", hint: "10 = 1 + 2 + 3 + 4" },
    { at: 25, name: "Theorem", hint: "25 propositions" },
    { at: 50, name: "Corollary", hint: "50 propositions" },
    { at: 100, name: "Elements", hint: "100 propositions" },
  ],
};

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
  } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const { notes } = useNotes();
  const wallpaperRef = useRef<HTMLInputElement>(null);
  const { isJs, t } = useCopy();

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
  const achievements = t(ACHIEVEMENTS);
  const unlocked = achievements.filter((a) => noteCount >= a.at);
  const nextUp = achievements.find((a) => noteCount < a.at);
  const joined = authUser.createdAt?.split("T")[0];

  return (
    <AppShell toolbar={<Navbar crumb={t({ js: "profile.js", common: "Profile", pythagoras: "Geometer" })} />}>
      <div className="max-w-4xl mx-auto px-3 md:px-6 py-6 md:py-8">
        <div className="flex flex-col-reverse md:flex-row gap-8 md:gap-10">
          {!isJs && (
            <PlainProfile
              name={authUser.fullName}
              email={authUser.email}
              joined={joined ? timeAgo(authUser.createdAt) : null}
              noteCount={noteCount}
              unlocked={unlocked}
              nextUp={nextUp}
              isDark={themeMode === "dark"}
              toggleThemeMode={toggleThemeMode}
              onWallpaper={() => wallpaperRef.current?.click()}
              wallpaperDisabled={!isOnline || isThemeChanging}
              isThemeChanging={isThemeChanging}
              isOnline={isOnline}
              onBin={() => navigate("/recycleBin")}
              onLogout={logout}
            />
          )}
          {/* Object literal (JS theme); the file input is shared */}
          <input type="file" accept="image/*" ref={wallpaperRef} className="hidden" onChange={handleWallpaper} />
          {isJs && (
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
          )}

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
                      <span className="text-[11px] text-white/90">
                        {isOnline ? t({ js: "avatar = upload()", common: "Change photo" }) : t({ js: "offline", common: "Offline" })}
                      </span>
                    </>
                  )}
                </label>
              </div>
              <ThemeBadge className="absolute -bottom-2 -right-2 w-8 h-8 text-sm shadow-lg" />
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
              {isJs && "// "}
              {!isOnline
                ? t({ js: "profile updates unavailable offline", common: "Profile changes need a connection" })
                : isUpdatingProfile
                  ? t({ js: "uploading…", common: "Uploading…" })
                  : t({ js: "click the image to update", common: "Click the photo to change it" })}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

const a11yNext = (a: Achievement): string => `Next: ${a.hint}`;

interface PlainProfileProps {
  name: string;
  email: string;
  joined: string | null;
  noteCount: number;
  unlocked: Achievement[];
  nextUp: Achievement | undefined;
  isDark: boolean;
  toggleThemeMode: () => void;
  onWallpaper: () => void;
  wallpaperDisabled: boolean;
  isThemeChanging: boolean;
  isOnline: boolean;
  onBin: () => void;
  onLogout: () => void;
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[minmax(110px,30%)_1fr] gap-3 py-2.5 border-b ide-divider items-center">
    <span className="text-[13px] tok-dim">{label}</span>
    <div className="min-w-0 text-[var(--fg)]">{children}</div>
  </div>
);

// The profile in plain words, for the Common and Pythagoras themes.
function PlainProfile(p: PlainProfileProps) {
  const { t, theme } = useCopy();
  return (
    <div className="flex-1 min-w-0 text-[14px]">
      <h1 className="text-2xl md:text-3xl font-semibold mb-1" style={{ fontFamily: "var(--font-content)" }}>
        {p.name}
      </h1>
      <p className="tok-dim mb-5">
        {t({ js: "", common: "Your account and preferences", pythagoras: "Member of the school" })}
      </p>

      <Row label="Email">
        <span className="break-all">{p.email}</span>
      </Row>
      <Row label={t({ js: "", common: "Member since", pythagoras: "Enrolled" })}>{p.joined ?? "—"}</Row>
      <Row label={t({ js: "", common: "Notes", pythagoras: "Propositions" })}>
        <span className="tabular-nums">{p.noteCount}</span>
      </Row>
      <Row label="Theme">
        <div className="max-w-sm">
          <ThemePicker />
        </div>
      </Row>
      <Row label="Appearance">
        <div className="math-tabs" role="radiogroup" aria-label="Appearance">
          <button type="button" role="radio" aria-checked={!p.isDark} aria-selected={!p.isDark} onClick={() => p.isDark && p.toggleThemeMode()}>
            <Sun className="size-3.5 inline -mt-0.5 mr-1" />Light
          </button>
          <button type="button" role="radio" aria-checked={p.isDark} aria-selected={p.isDark} onClick={() => !p.isDark && p.toggleThemeMode()}>
            <Moon className="size-3.5 inline -mt-0.5 mr-1" />Dark
          </button>
        </div>
      </Row>
      <Row label="Wallpaper">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={p.wallpaperDisabled} onClick={p.onWallpaper} className="ide-btn !py-1 !px-2 text-xs">
            {p.isThemeChanging ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {p.isThemeChanging ? "Uploading…" : "Upload your own"}
          </button>
          <span className="text-[12px] tok-dim">
            {p.isOnline ? "Replaces the theme's artwork" : "Needs a connection"}
          </span>
        </div>
      </Row>
      <Row label={t({ js: "", common: "Milestones", pythagoras: "Proofs earned" })}>
        <div className="flex flex-wrap gap-2">
          {p.unlocked.length === 0 && (
            <span className="text-[12.5px] tok-dim">
              {t({ js: "", common: "Write a note to earn your first.", pythagoras: "State an axiom to earn your first." })}
            </span>
          )}
          {p.unlocked.map((a) => (
            <span key={a.name} className="ide-chip !text-[var(--fg)]" title={a.hint}>
              <span className="tok-js">{theme === "pythagoras" ? "△" : "★"}</span> {a.name}
            </span>
          ))}
          {p.nextUp && (
            <span className="ide-chip opacity-60" title={a11yNext(p.nextUp)}>
              {theme === "pythagoras" ? "▽" : "☆"} {p.nextUp.at - p.noteCount} to go
            </span>
          )}
        </div>
      </Row>

      <div className="flex flex-wrap gap-3 mt-6">
        <button type="button" onClick={p.onBin} className="ide-btn">
          <Trash2 className="size-4 tok-warn" />
          {t({ js: "", common: "Open the bin", pythagoras: "Erased propositions" })}
        </button>
        <button type="button" onClick={p.onLogout} className="ide-btn ide-btn-danger">
          <LogOut className="size-4" />
          {t({ js: "", common: "Sign out", pythagoras: "Depart" })}
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
