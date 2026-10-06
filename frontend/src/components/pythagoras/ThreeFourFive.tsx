import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { strike } from "../../lib/monochord";

// Easter egg: type 3, 4, 5 anywhere outside a text field and Euclid I.47
// draws itself, squares and all, with the 3:4:5 chord (played even with
// sounds off: typing it is asking for it).
const SEQ = ["3", "4", "5"];

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.closest("math-field") !== null);

// Right angle at the origin, leg a = 3 up, leg b = 4 right; each square
// stands outside its side. The hypotenuse runs P(0,-3) -> Q(4,0) and its
// outward normal is (3,-4).
const U = 40;
const pts = (...xy: number[]) => xy.map((v) => v * U).join(" ");
const SHAPES = [
  { d: pts(0, 0, 0, -3, -3, -3, -3, 0), fill: "var(--byrne-red)", len: 12, delay: 0.7, label: "9", at: [-1.5, -1.5] },
  { d: pts(0, 0, 4, 0, 4, 4, 0, 4), fill: "var(--byrne-yellow)", len: 16, delay: 1.1, label: "16", at: [2, 2] },
  { d: pts(0, -3, 4, 0, 7, -4, 3, -7), fill: "var(--byrne-blue)", len: 20, delay: 1.5, label: "25", at: [3.5, -3.5] },
];

const sketch = (len: number, delay: number, dur = 0.9): CSSProperties =>
  ({ "--len": len * U, "--delay": `${delay}s`, "--dur": `${dur}s` }) as CSSProperties;

export default function ThreeFourFive() {
  const [run, setRun] = useState(0); // bumps to replay

  const fire = useCallback(() => {
    setRun((n) => n + 1);
    strike("triple", { force: true });
  }, []);

  useEffect(() => {
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      pos = e.key === SEQ[pos] ? pos + 1 : e.key === SEQ[0] ? 1 : 0;
      if (pos === SEQ.length) {
        pos = 0;
        fire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  useEffect(() => {
    if (!run) return;
    const id = setTimeout(() => setRun(0), 5500);
    return () => clearTimeout(id);
  }, [run]);

  if (!run) return null;

  return (
    <div key={run} className="pointer-events-none fixed inset-0 z-[90] flex flex-col items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--bg) 60%, transparent)", animation: "pyth-fade .4s ease-out" }} />
      <svg viewBox={`${-3.6 * U} ${-7.6 * U} ${11.2 * U} ${12.2 * U}`} className="pyth-sketch relative w-[min(70vw,520px)] max-h-[70vh]">
        {SHAPES.map((s) => (
          <g key={s.label}>
            <polygon points={s.d} fill={s.fill} style={{ opacity: 0, animation: `pyth-fade .5s ${s.delay + 0.5}s forwards` }} />
            <polygon className="stroke" points={s.d} fill="none" stroke="var(--fg)" strokeWidth={2} strokeLinejoin="round" style={sketch(s.len, s.delay)} />
            <text
              x={s.at[0] * U}
              y={s.at[1] * U + 11}
              textAnchor="middle"
              fill="var(--win)"
              style={{ font: "600 32px var(--font-content)", opacity: 0, animation: `pyth-fade .4s ${s.delay + 0.9}s forwards` }}
            >
              {s.label}
            </text>
          </g>
        ))}
        <polygon className="stroke" points={pts(0, 0, 4, 0, 0, -3)} fill="var(--win)" stroke="var(--fg)" strokeWidth={2.5} strokeLinejoin="round" style={sketch(12, 0, 0.7)} />
        <path d={`M ${0.5 * U} 0 V ${-0.5 * U} H 0`} fill="none" stroke="var(--fn)" strokeWidth={2} style={sketch(1, 0.6, 0.3)} />
      </svg>
      <p className="relative mt-5 text-[24px] tracking-[.2em] uppercase text-[var(--fg)]" style={{ opacity: 0, animation: "pyth-fade .5s 2.6s forwards" }}>
        9 + 16 = 25
      </p>
    </div>
  );
}
