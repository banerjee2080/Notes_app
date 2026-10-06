import type { ReactNode } from "react";
import { FileCode2, FileText, Triangle, type LucideProps } from "lucide-react";
import { useThemeStore } from "../../stores/useThemeStore";

/** A side remark: `// text` in the JS theme, the plain sentence elsewhere. */
export const Remark = ({ children }: { children: ReactNode }) => {
  const isJs = useThemeStore((s) => s.theme === "js");
  return (
    <>
      {isJs && "// "}
      {children}
    </>
  );
};

/** The app's badge: JS square, Common's round seal, Pythagoras' triangle. */
export const ThemeBadge = ({ className = "" }: { className?: string }) => {
  const theme = useThemeStore((s) => s.theme);
  const shape =
    theme === "common" ? "rounded-full !items-center !justify-center !p-0" : theme === "pythagoras" ? "pyth-triangle" : "";
  return (
    <span className={`js-badge ${shape} ${className}`} aria-hidden="true">
      {theme === "js" ? "JS" : theme === "common" ? "N" : "Π"}
    </span>
  );
};

/** The icon for "a note": a JS file, a page, or a triangle. */
export const NoteIcon = (props: LucideProps) => {
  const theme = useThemeStore((s) => s.theme);
  const Icon = theme === "js" ? FileCode2 : theme === "pythagoras" ? Triangle : FileText;
  return <Icon {...props} />;
};
