import { useEffect, useState } from "react";

// The rearrangement proof of a² + b² = c², in Byrne's colours.
//
// A square of side a+b holds four copies of the right triangle (a, b, c).
// Arranged one way, the space they leave is the tilted square c². Slid
// (never rotated) into the other arrangement, the same space becomes a²
// plus b². Same square, same four triangles, so c² = a² + b².
//
// Each triangle is drawn in local coordinates with its right angle at the
// origin, leg a along +x and leg b along +y, then placed by translate+rotate.

const A = 3;
const B = 4;
const S = A + B;

type Place = { x: number; y: number; r: number };

// [tilted c² arrangement, a² + b² arrangement] for each triangle.
const MOVES: [Place, Place][] = [
  [{ x: 0, y: 0, r: 0 }, { x: 0, y: A, r: 0 }],
  [{ x: S, y: 0, r: 90 }, { x: S, y: 0, r: 90 }],
  [{ x: S, y: S, r: 180 }, { x: A, y: S, r: 180 }],
  [{ x: 0, y: S, r: 270 }, { x: A, y: A, r: 270 }],
];

const TRI_FILL = ["var(--byrne-yellow)", "var(--byrne-red)", "var(--byrne-blue)", "var(--fg)"];

interface ProofAnimationProps {
  /** Pixel size of the square. */
  size?: number;
  /** Show the c² / a² + b² caption. */
  caption?: boolean;
  /** ms per arrangement. */
  period?: number;
  className?: string;
}

export default function ProofAnimation({ size = 168, caption = true, period = 2600, className = "" }: ProofAnimationProps) {
  const [split, setSplit] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSplit((s) => !s), period);
    return () => clearInterval(id);
  }, [period]);

  const u = size / S;
  const move = "transform 900ms cubic-bezier(.65,0,.35,1)";
  const fade = "opacity 600ms ease";

  return (
    <figure className={`inline-flex flex-col items-center gap-2 ${className}`} aria-label="Animated proof that a squared plus b squared equals c squared">
      <svg width={size + 2} height={size + 2} viewBox={`-1 -1 ${size + 2} ${size + 2}`} aria-hidden="true">
        {/* the leftover space, coloured */}
        <polygon
          points={`${A * u},0 ${S * u},${A * u} ${B * u},${S * u} 0,${B * u}`}
          fill="var(--byrne-blue)"
          style={{ opacity: split ? 0 : 0.85, transition: fade }}
        />
        <rect x={0} y={0} width={A * u} height={A * u} fill="var(--byrne-red)" style={{ opacity: split ? 0.85 : 0, transition: fade }} />
        <rect x={A * u} y={A * u} width={B * u} height={B * u} fill="var(--byrne-yellow)" style={{ opacity: split ? 0.85 : 0, transition: fade }} />

        {MOVES.map((m, i) => {
          const p = m[split ? 1 : 0];
          return (
            <g key={i} style={{ transform: `translate(${p.x * u}px, ${p.y * u}px) rotate(${p.r}deg)`, transition: move }}>
              <polygon
                points={`0,0 ${A * u},0 0,${B * u}`}
                fill="var(--win)"
                stroke="var(--fg)"
                strokeWidth={1.25}
                strokeLinejoin="round"
              />
              {/* a tiny right-angle mark, Byrne-style colour on one triangle each */}
              <path d={`M ${0.55 * u} 0 V ${0.55 * u} H 0`} fill="none" stroke={TRI_FILL[i]} strokeWidth={1.5} />
            </g>
          );
        })}
        <rect x={0} y={0} width={size} height={size} fill="none" stroke="var(--fg)" strokeWidth={1.5} />
      </svg>
      {caption && (
        <figcaption className="text-[13px] tracking-wider tabular-nums" aria-live="off">
          <span style={{ opacity: split ? 0.35 : 1, transition: fade }}>
            <b style={{ color: "var(--byrne-blue)" }}>c²</b>
          </span>
          <span className="tok-dim"> = </span>
          <span style={{ opacity: split ? 1 : 0.35, transition: fade }}>
            <b style={{ color: "var(--byrne-red)" }}>a²</b>
            <span className="tok-dim"> + </span>
            <b style={{ color: "var(--byrne-yellow)" }}>b²</b>
          </span>
        </figcaption>
      )}
    </figure>
  );
}
