// MathLive (the visual equation field) is ~800 KB, so it's fetched the first
// time someone edits an equation, never on page load.
import { loadKatex } from "./katex";

type MathLive = typeof import("mathlive");

let loading: Promise<MathLive> | null = null;

export function loadMathLive(): Promise<MathLive> {
  loading ??= Promise.all([import("mathlive"), loadKatex()])
    .then(([ml]) => {
      // Fonts come from KaTeX's stylesheet (same KaTeX_* families), and no
      // keyclick sounds: nothing is ever fetched from MathLive's CDN.
      ml.MathfieldElement.fontsDirectory = null;
      ml.MathfieldElement.soundsDirectory = null;
      return ml;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}
