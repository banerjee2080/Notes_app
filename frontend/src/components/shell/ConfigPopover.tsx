import { useEffect, useRef, useState } from "react";
import { Settings, Loader2, Upload, Sun, Moon, LogOut, Volume2, VolumeX } from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { compressImage } from "../../lib/utils";
import { useThemeStore } from "../../stores/useThemeStore";
import { useVoice } from "../../lib/voice";
import ThemePicker from "./ThemePicker";
import { strike } from "../../lib/monochord";

// The gear in the toolbar opens this "// Config: { ... }" object literal.
// It holds the real settings: dark/vibrant mode, wallpaper theme, logout.
const ConfigPopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();
  const { authUser, themeMode, toggleThemeMode, setTheme, isThemeChanging, logout } =
    useAuthStore();
  const { theme, voice } = useVoice();
  const { soundOn, toggleSound } = useThemeStore();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      ref.current &&
      e.target instanceof Node &&
      !ref.current.contains(e.target) &&
      setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64Img = await compressImage(file, 1920, 0.7);
    await setTheme({ backgroundImg: base64Img });
    e.target.value = "";
  };

  const isDark = themeMode === "dark";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`ide-icon-btn !w-9 !h-9 ${open ? "!text-[var(--kw)] !border-[var(--line)] bg-[var(--panel-2)]" : ""}`}
        aria-expanded={open}
        aria-label="Settings"
        title="Config"
      >
        <Settings className={`size-[18px] transition-transform duration-500 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && voice && (
        <div className="absolute right-0 top-full mt-2 w-[min(340px,calc(100vw-24px))] z-50 ide-dialog p-4 text-[13.5px] space-y-4">
          <section className="space-y-2">
            <h3 className="text-[11.5px] uppercase tracking-[.12em] tok-dim">Theme</h3>
            <ThemePicker />
          </section>

          <section className="flex items-center justify-between gap-2">
            <span>Appearance</span>
            <div className="math-tabs" role="radiogroup" aria-label="Appearance">
              <button type="button" role="radio" aria-checked={!isDark} aria-selected={!isDark} onClick={() => isDark && toggleThemeMode()}>
                <Sun className="size-3.5 inline -mt-0.5 mr-1" />Light
              </button>
              <button type="button" role="radio" aria-checked={isDark} aria-selected={isDark} onClick={() => !isDark && toggleThemeMode()}>
                <Moon className="size-3.5 inline -mt-0.5 mr-1" />Dark
              </button>
            </div>
          </section>

          {theme === "pythagoras" && (
            <section className="flex items-center justify-between gap-2">
              <span>
                Monochord
                <span className="block text-[11.5px] tok-dim leading-snug">Actions sound their ratio: 3:2, 4:3, 2:1</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  toggleSound();
                  if (!soundOn) strike("fifth", { force: true });
                }}
                className="ide-btn !py-1 !px-2 text-xs"
                aria-pressed={soundOn}
              >
                {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                {soundOn ? "On" : "Off"}
              </button>
            </section>
          )}

          <section className="flex items-center justify-between gap-2">
            <span>
              Wallpaper
              <span className="block text-[11.5px] tok-dim leading-snug">
                {isOnline ? "Your own picture replaces the theme's artwork" : "Needs a connection"}
              </span>
            </span>
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
            <button
              type="button"
              onClick={() => isOnline && fileInputRef.current?.click()}
              disabled={isThemeChanging || !isOnline}
              className="ide-btn !py-1 !px-2 text-xs"
            >
              {isThemeChanging ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {isThemeChanging ? "Uploading…" : "Upload"}
            </button>
          </section>

          {authUser && (
            <section className="flex items-center justify-between gap-2 pt-3 border-t ide-divider">
              <span className="truncate tok-dim text-[12.5px]">{authUser.email}</span>
              <button type="button" onClick={logout} className="ide-btn ide-btn-danger !py-1 !px-2 text-xs shrink-0">
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </section>
          )}
        </div>
      )}

      {open && !voice && (
        <div className="absolute right-0 top-full mt-2 w-[min(330px,calc(100vw-24px))] z-50 ide-dialog p-4 text-[13px] leading-7">
          <div className="tok-com">{"// Config: {"}</div>

          <div className="pl-4">
            <div className="pb-2 leading-normal">
              <div>
                look<span className="tok-punc">: </span>
                <span className="tok-str">'{theme}'</span>
                <span className="tok-punc">,</span>
              </div>
              <div className="pt-1.5">
                <ThemePicker />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>
                theme<span className="tok-punc">: </span>
                <span className="tok-str">'{isDark ? "dark" : "vibrant"}'</span>
                <span className="tok-punc">,</span>
              </span>
              <button type="button" onClick={toggleThemeMode} className="ide-btn !py-1 !px-2 text-xs">
                {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                toggle()
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span>
                  palette<span className="tok-punc">:</span>
                </span>
                <span className="size-3.5 rounded-sm border ide-divider" style={{ background: "var(--theme-main)" }} title="main colour" />
                <span className="size-3.5 rounded-sm border ide-divider" style={{ background: "var(--theme-accent)" }} title="accent colour" />
                <span className="tok-punc">,</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span>
                wallpaper<span className="tok-punc">:</span>
              </span>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImageUpload}
              />
              <button
                type="button"
                onClick={() => isOnline && fileInputRef.current?.click()}
                disabled={isThemeChanging || !isOnline}
                className="ide-btn ide-btn-primary !py-1 !px-2 text-xs"
              >
                {isThemeChanging ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {isThemeChanging ? "await…" : "upload()"}
              </button>
            </div>
            <p className="text-[11.5px] leading-snug tok-com pb-1">
              {isOnline
                ? "// your wallpaper's colours become the syntax highlighting"
                : "// wallpaper changes need a connection"}
            </p>

            <div>
              strictMode<span className="tok-punc">: </span>
              <span className="tok-kw">true</span>
              <span className="tok-punc">,</span>
            </div>
            <div>
              coercion<span className="tok-punc">: </span>
              <span className="tok-str">'aggressive'</span>
              <span className="tok-punc">,</span>
            </div>

            {authUser && (
              <div className="pt-1">
                <div className="tok-com truncate text-[12px]">{"// "}{authUser.email}</div>
                <button type="button" onClick={logout} className="ide-btn ide-btn-danger !py-1 !px-2 text-xs mt-1">
                  <LogOut className="size-3.5" />
                  logout()
                </button>
              </div>
            )}
          </div>

          <div className="tok-punc">{"}"}</div>
        </div>
      )}
    </div>
  );
};

export default ConfigPopover;
