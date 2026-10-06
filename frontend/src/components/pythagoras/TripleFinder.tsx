import { useEffect, useMemo, useRef, useState } from "react";
import { Triangle, X } from "lucide-react";
import toast from "react-hot-toast";
import { primitiveTriples, tripleLatex, type Triple } from "../../lib/pythagorasLore";
import { sendMathToEditor } from "../../lib/math/insertMathEvent";
import { strike } from "../../lib/monochord";

const TRIPLES = primitiveTriples(100);

// A right triangle drawn to scale, legs on the axes.
const MiniTriangle = ({ a, b }: { a: number; b: number }) => {
  const k = 26 / Math.max(a, b);
  const w = a * k;
  const h = b * k;
  return (
    <svg width={28} height={28} viewBox="-1 -1 28 28" aria-hidden="true" className="shrink-0">
      <polygon points={`0,26 ${w},26 0,${26 - h}`} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <line x1={0} y1={26} x2={w} y2={26} stroke="var(--byrne-red)" strokeWidth={2} />
      <line x1={0} y1={26} x2={0} y2={26 - h} stroke="var(--byrne-blue)" strokeWidth={2} />
    </svg>
  );
};

/** Gives an equation to the open note, or copies it if there isn't one. */
async function place(latex: string): Promise<void> {
  strike("triple");
  if (sendMathToEditor({ latex, kind: "inline" })) {
    toast.success("Inserted into the note", { id: "triple" });
    return;
  }
  try {
    await navigator.clipboard.writeText(`$${latex}$`);
    toast("Copied. Open a note and paste it", { id: "triple", icon: "△" });
  } catch {
    toast.error("Open a note to insert it", { id: "triple" });
  }
}

// Status-bar tool in the Pythagoras theme: Euclid's formula, live.
export default function TripleFinder() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [legA, setLegA] = useState("");
  const [legB, setLegB] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Free calculator: any two legs -> the hypotenuse, exact when it's whole.
  const solved = useMemo(() => {
    const a = Number(legA);
    const b = Number(legB);
    if (!(a > 0 && b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
    const sq = a * a + b * b;
    const c = Math.sqrt(sq);
    const whole = Number.isInteger(c);
    const fmt = (n: number) => String(+n.toFixed(6));
    const latex = whole
      ? `${fmt(a)}^2+${fmt(b)}^2=${fmt(c)}^2`
      : `c=\\sqrt{${fmt(a)}^2+${fmt(b)}^2}=\\sqrt{${fmt(sq)}}\\approx ${c.toFixed(4)}`;
    return { c, whole, latex };
  }, [legA, legB]);

  const pick = (t: Triple) => place(tripleLatex(t, scale));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 tok-fn hover:underline"
        aria-expanded={open}
        title="Pythagorean triples"
      >
        <span className="hidden sm:inline">Triples</span>
        <Triangle className="size-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pythagorean triples"
          className="absolute right-0 bottom-full mb-2 z-50 w-[min(340px,calc(100vw-24px))] ide-dialog text-[13px] normal-case tracking-normal"
        >
          <div className="ide-dialog-head">
            <span className="uppercase tracking-[.12em] text-[12px]">Triples · Euclid's formula</span>
            <button type="button" onClick={() => setOpen(false)} className="ide-icon-btn !w-6 !h-6" aria-label="Close">
              <X className="size-3.5" />
            </button>
          </div>

          <div className="px-3 pt-2.5 pb-1 tok-com text-[12.5px] leading-snug" style={{ fontFamily: "var(--font-content)" }}>
            For whole m &gt; n, coprime, not both odd: <i>a</i> = m²−n², <i>b</i> = 2mn, <i>c</i> = m²+n².
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 text-[12px]">
            <span className="tok-dim mr-1">scale</span>
            {[1, 2, 3, 4, 5].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setScale(k)}
                className={`ide-chip !px-2 tabular-nums ${scale === k ? "!border-[var(--kw)] !text-[var(--kw)]" : ""}`}
                aria-pressed={scale === k}
              >
                ×{k}
              </button>
            ))}
          </div>

          <ul className="max-h-56 overflow-y-auto ide-scroll px-1.5 pb-1.5">
            {TRIPLES.map((t) => (
              <li key={`${t.m}-${t.n}`}>
                <button
                  type="button"
                  onClick={() => pick(t)}
                  className="tree-item !normal-case !tracking-normal tabular-nums"
                  title={`m = ${t.m}, n = ${t.n}. Click to insert`}
                >
                  <MiniTriangle a={t.a} b={t.b} />
                  <span className="text-[var(--fg)]">
                    {t.a * scale}² + {t.b * scale}² = {t.c * scale}²
                  </span>
                  <span className="ml-auto tok-dim text-[11px]">
                    m{t.m} n{t.n}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t ide-divider px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <input className="ide-input !py-1 !w-20 tabular-nums" inputMode="decimal" placeholder="a" value={legA} onChange={(e) => setLegA(e.target.value)} aria-label="Leg a" />
              <span className="tok-dim">,</span>
              <input className="ide-input !py-1 !w-20 tabular-nums" inputMode="decimal" placeholder="b" value={legB} onChange={(e) => setLegB(e.target.value)} aria-label="Leg b" />
              <span className="tok-dim">→ c =</span>
              <span className={`tabular-nums ${solved?.whole ? "tok-ok font-semibold" : "text-[var(--fg)]"}`}>
                {solved ? (solved.whole ? solved.c : solved.c.toFixed(3)) : "?"}
              </span>
            </div>
            <button type="button" disabled={!solved} onClick={() => solved && place(solved.latex)} className="ide-btn ide-btn-primary !py-1 !px-2 text-xs w-full justify-center">
              Insert into note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
