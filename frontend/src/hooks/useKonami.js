import { useEffect } from "react";

// ↑ ↑ ↓ ↓ ← → ← → B A — the most famous cheat code, as a tiny hook.
const SEQUENCE = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
];

export function useKonami(onUnlock) {
  useEffect(() => {
    let pos = 0;
    const onKey = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = key === SEQUENCE[pos] ? pos + 1 : key === SEQUENCE[0] ? 1 : 0;
      if (pos === SEQUENCE.length) {
        pos = 0;
        onUnlock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUnlock]);
}
