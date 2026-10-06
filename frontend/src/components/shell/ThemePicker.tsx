import { Check } from "lucide-react";
import { THEMES } from "../../lib/themes";
import { useThemeStore } from "../../stores/useThemeStore";

// Three cards, each showing its theme's artwork.
const ThemePicker = () => {
  const { theme, setTheme } = useThemeStore();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => {
        const on = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(t.id)}
            title={t.blurb}
            className={`group relative flex flex-col overflow-hidden border text-left transition-colors rounded-[var(--radius)] ${
              on ? "border-[var(--kw)] shadow-[0_0_0_1px_var(--kw)]" : "border-[var(--line)] hover:border-[var(--fg-dim)]"
            }`}
          >
            <span
              className={`block h-14 bg-cover bg-center ${t.id === "pythagoras" ? "bg-[#f4efe2] !bg-contain bg-no-repeat" : ""}`}
              style={{ backgroundImage: `url('${t.swatch}')` }}
              aria-hidden="true"
            />
            <span className="flex items-center justify-between gap-1 px-1.5 py-1 text-[11.5px] leading-tight bg-[var(--panel)] normal-case tracking-normal">
              <span className="truncate">{t.name}</span>
              {on && <Check className="size-3 shrink-0 text-[var(--kw)]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemePicker;
