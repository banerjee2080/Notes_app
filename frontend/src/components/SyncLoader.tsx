import { CloudSync } from "lucide-react";
import { useSyncStore } from "../stores/useSyncStore";
import { useAuthStore } from "../stores/useAuthStore";

const SyncLoader = () => {
  const { isSyncing } = useSyncStore();
  const { themeMode } = useAuthStore();
  
  const isDark = themeMode === "dark";

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${
        isSyncing ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div 
        className={`flex items-center gap-3 px-5 py-3 rounded-2xl backdrop-blur-2xl border transition-all duration-300 ${
          isDark 
            ? "bg-black/40 border-[var(--theme-accent)]/30" 
            : "bg-white/60 border-[var(--theme-accent)]/40"
        }`}
        style={{
          boxShadow: `0 8px 32px color-mix(in srgb, var(--theme-accent) ${isDark ? '25%' : '35%'}, transparent)`
        }}
      >
        <div className="relative flex items-center justify-center">
          <CloudSync 
            className="size-6 relative z-10" 
            style={{ 
              color: "var(--theme-accent)",
              animation: "bounce 2s infinite", 
            }} 
          />
          <div 
            className="absolute inset-0 rounded-full animate-ping opacity-60"
            style={{ backgroundColor: "var(--theme-accent)" }}
          ></div>
        </div>
        <span 
          className="font-semibold tracking-wide text-sm bg-clip-text text-transparent"
          style={{ backgroundImage: "linear-gradient(to right, var(--theme-accent), var(--theme-main))" }}
        >
          Syncing to Cloud...
        </span>
      </div>
    </div>
  );
};

export default SyncLoader;
