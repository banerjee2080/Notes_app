import { lazy, Suspense, useState } from "react";
import { LOADING_LINES, pick } from "../../lib/jsLore";
import { PYTH_LOADING } from "../../lib/pythagorasLore";
import { COMMON_LOADING } from "../../lib/commonLore";
import { useThemeStore } from "../../stores/useThemeStore";

const ProofAnimation = lazy(() => import("../pythagoras/ProofAnimation"));

interface CodeSpinnerProps {
  label?: string;
  className?: string;
}

// The loader, per theme: `{ }` that breathes (JS), three ink dots
// (Common), the rearrangement proof sliding (Pythagoras).
const CodeSpinner = ({ label, className = "" }: CodeSpinnerProps) => {
  const theme = useThemeStore((s) => s.theme);
  const [line] = useState(
    () => label || pick(theme === "js" ? LOADING_LINES : theme === "pythagoras" ? PYTH_LOADING : COMMON_LOADING),
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      {theme === "js" ? (
        <span className="brace-spinner text-3xl font-bold tok-kw">{"{ }"}</span>
      ) : theme === "pythagoras" ? (
        <Suspense fallback={<span className="h-[58px]" />}>
          <ProofAnimation size={56} caption={false} period={1100} />
        </Suspense>
      ) : (
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full bg-[var(--fn)] animate-pulse"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </span>
      )}
      <span className="text-xs tok-com">
        {theme === "js" && "// "}
        {line}
      </span>
    </div>
  );
};

export default CodeSpinner;
