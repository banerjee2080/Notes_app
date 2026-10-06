// The monochord: Pythagoras' one-string instrument, on which he is said to
// have found that consonance is whole-number ratios. The Pythagoras theme
// plucks it for feedback, if the user switches sound on (it starts off).
import { useThemeStore } from "../stores/useThemeStore";

const ROOT = 196; // G3

/** Ratios to the root, played as a short arpeggio. */
export const INTERVALS = {
  octave: [1, 2],
  fifth: [1, 3 / 2],
  fourth: [1, 4 / 3],
  /** 3:4:5, the sides of the first triple, as a chord. */
  triple: [1, 4 / 3, 5 / 3],
  /** The tetractys' ratios: 1, 4:3, 3:2, 2. */
  tetractys: [1, 4 / 3, 3 / 2, 2],
  /** The limma, 256:243, the Pythagorean semitone. Rubs on purpose. */
  limma: [1, 256 / 243],
} satisfies Record<string, number[]>;

export type Interval = keyof typeof INTERVALS;

let ctx: AudioContext | null = null;

function pluck(ac: AudioContext, freq: number, at: number, gain: number): void {
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);

  // A string is mostly its fundamental with a few soft overtones.
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(freq * 6, at);
  tone.frequency.exponentialRampToValueAtTime(freq * 1.5, at + 1.2);
  tone.connect(out).connect(ac.destination);

  for (const [mult, level, type] of [
    [1, 1, "triangle"],
    [2, 0.35, "sine"],
    [3, 0.12, "sine"],
  ] as const) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(tone);
    osc.start(at);
    osc.stop(at + 1.7);
  }
}

/** Plays `interval` if the Pythagoras theme is on and sound is enabled. */
export function strike(interval: Interval, { force = false } = {}): void {
  const { theme, soundOn } = useThemeStore.getState();
  if (!force && (theme !== "pythagoras" || !soundOn)) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime + 0.01;
    INTERVALS[interval].forEach((r, i) => pluck(ctx!, ROOT * r, now + i * 0.07, 0.07));
  } catch {
    // no audio device / blocked: silence is fine
  }
}
