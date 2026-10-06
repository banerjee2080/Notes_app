import { useEffect, type ReactNode } from "react";
import type { ToastType } from "react-hot-toast";
import { strike } from "../../lib/monochord";

// Pythagoras theme with sound on: each toast plucks its ratio once.
// Success is a fifth (3:2), an error the grating limma (256:243).
const played = new Set<string>();

const ToastSound = ({ id, type, children }: { id: string; type: ToastType; children: ReactNode }) => {
  useEffect(() => {
    if (played.has(id) || type === "loading") return;
    played.add(id);
    strike(type === "success" ? "fifth" : type === "error" ? "limma" : "fourth");
  }, [id, type]);
  return <>{children}</>;
};

export default ToastSound;
