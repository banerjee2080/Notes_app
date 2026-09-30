import { useState } from "react";
import { LOADING_LINES, pick } from "../../lib/jsLore";

interface CodeSpinnerProps {
  label?: string;
  className?: string;
}

// `{ }` that breathes, with a random "Hoisting variables…" style caption.
const CodeSpinner = ({ label, className = "" }: CodeSpinnerProps) => {
  const [line] = useState(() => label || pick(LOADING_LINES));
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <span className="brace-spinner text-3xl font-bold tok-kw">{"{ }"}</span>
      <span className="text-xs tok-com">{"// "}{line}</span>
    </div>
  );
};

export default CodeSpinner;
